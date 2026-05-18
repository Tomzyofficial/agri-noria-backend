import { aggregatorDb } from "../../db/aggregator/aggregator.db.js";
import crypto from "crypto";
import PDFDocument from "pdfkit";
import { cloudinary } from "../../lib/cloudinary.img.js";
import { verifyVendorToken } from "../../sessions/vendor.auth.session.js";
import axios from "axios";
import { getWalletByOwner } from "../../db/pipeline/pipeline.db.js";
import pool from "../../lib/connect.js";
import { createAuditLog } from "../../utils/auditLogger.js";

export const aggregatorController = {
   // Onboarding / Profile setup
   setupProfile: async (req, res) => {
      try {
         const payload = await verifyVendorToken(req);
         if (!payload) return res.status(401).json({ success: false, error: "Unauthorized" });

         const { company_name, registration_details, company_logo_url } = req.body;
         const profile = await aggregatorDb.createProfile(
            payload.id,
            company_name,
            registration_details,
            company_logo_url,
         );
         return res.status(201).json({ success: true, data: profile });
      } catch (error) {
         return res.status(500).json({ success: false, error: error.message });
      }
   },

   getProfile: async (req, res) => {
      try {
         const payload = await verifyVendorToken(req);
         if (!payload) return res.status(401).json({ success: false, error: "Unauthorized" });

         const profile = await aggregatorDb.getProfileByVendorId(payload.id);
         return res.status(200).json({ success: true, data: profile });
      } catch (error) {
         return res.status(500).json({ success: false, error: error.message });
      }
   },

   // Create Buyer & Agreement Form
   createBuyerRegistration: async (req, res) => {
      try {
         const payload = await verifyVendorToken(req);
         if (!payload) return res.status(401).json({ success: false, error: "Unauthorized" });

         const { buyer_info, product_details, is_pre_harvest, terms_and_conditions } = req.body;

         // Calculate total procurement value (formerly financing amount)
         const quantity = parseFloat(product_details.quantity || 0);
         const unit_price = parseFloat(product_details.price || 0);
         const total_value = quantity * unit_price;

         // 1. Create Buyer
         const buyer = await aggregatorDb.createBuyer(payload.id, buyer_info);

         // 2. Generate secure tokens
         const secure_token = crypto.randomBytes(24).toString("hex");
         const payment_token = crypto.randomBytes(24).toString("hex");

         // 3. Create Agreement
         const agreement = await aggregatorDb.createAgreement({
            aggregator_id: payload.id,
            buyer_id: buyer.id,
            product_details,
            financing_amount: total_value, // We store the calculated total here
            is_pre_harvest,
            secure_token,
            terms_and_conditions,
         });

         // 4. Update with payment token
         await aggregatorDb.updateAgreementStatus(agreement.id, "pending", { payment_token });

         // 5. Generate PDF
         const pdfUrl = await generateAgreementPDF(agreement, buyer, payload);

         await aggregatorDb.updateAgreementStatus(agreement.id, "sent", { agreement_pdf_url: pdfUrl });

         // Log action
         await createAuditLog(
            payload.id,
            payload.email,
            "CREATE",
            "Buyer Agreement",
            `Created procurement agreement for ${buyer_info.buyer_name}. Total Value: ₦${total_value.toLocaleString()}`,
            req.ip
         );

         return res.status(201).json({
            success: true,
            data: {
               agreement_id: agreement.id,
               pdf_url: pdfUrl,
               acceptance_link: `${process.env.FRONTEND_APP_URL}/review-agreement/${secure_token}`,
               payment_link: `${process.env.FRONTEND_APP_URL}/payment-link/${payment_token}`,
            },
         });
      } catch (error) {
         console.error("Error in buyer registration:", error);
         return res.status(500).json({ success: false, error: error.message });
      }
   },

   // Get agreement for review (Public)
   getAgreementForReview: async (req, res) => {
      try {
         const { token } = req.params;
         const agreement = await aggregatorDb.getAgreementByToken(token);
         if (!agreement) return res.status(404).json({ success: false, error: "Agreement not found" });

         return res.status(200).json({ success: true, data: agreement });
      } catch (error) {
         return res.status(500).json({ success: false, error: error.message });
      }
   },

   // Upload signed agreement
   uploadSignedAgreement: async (req, res) => {
      try {
         const payload = await verifyVendorToken(req);
         if (!payload) return res.status(401).json({ success: false, error: "Unauthorized" });

         const { agreement_id, signed_pdf_url } = req.body;
         const updated = await aggregatorDb.updateAgreementStatus(agreement_id, "signed", { signed_pdf_url });

         return res.status(200).json({ success: true, data: updated });
      } catch (error) {
         return res.status(500).json({ success: false, error: error.message });
      }
   },

   // Paystack Integration: Initialize Payment
   initializePayment: async (req, res) => {
      try {
         const { token } = req.params;
         const agreement = await aggregatorDb.getAgreementByToken(token);
         if (!agreement) return res.status(404).json({ success: false, error: "Agreement not found" });

         // For Scenario A, check if signed and approved
         if (agreement.is_pre_harvest && agreement.status !== "signed" && agreement.status !== "approved") {
            return res
               .status(400)
               .json({ success: false, error: "Agreement must be signed before payment for pre-harvest crops." });
         }

         const amount_kobo = agreement.financing_amount * 100; // Paystack uses kobo

         const response = await axios.post(
            "https://api.paystack.co/transaction/initialize",
            {
               email: agreement.buyer_email,
               amount: amount_kobo,
               metadata: {
                  agreement_id: agreement.id,
                  aggregator_id: agreement.aggregator_id,
                  category: "aggregator_escrow",
               },
               callback_url: `${process.env.FRONTEND_APP_URL}/payment-success?agreement_id=${agreement.id}`,
            },
            {
               headers: {
                  Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
               },
            },
         );

         return res.status(200).json({ success: true, data: response.data.data });
      } catch (error) {
         console.error("Paystack init error:", error.response?.data || error.message);
         return res.status(500).json({ success: false, error: error.message });
      }
   },

   // List for dashboard
   getAgreements: async (req, res) => {
      try {
         const payload = await verifyVendorToken(req);
         if (!payload) return res.status(401).json({ success: false, error: "Unauthorized" });

         const agreements = await aggregatorDb.getAgreementsByAggregator(payload.id);
         return res.status(200).json({ success: true, data: agreements });
      } catch (error) {
         return res.status(500).json({ success: false, error: error.message });
      }
   },

   // Escrow Release - FINANCE ONLY
   releaseEscrow: async (req, res) => {
      try {
         const payload = await verifyVendorToken(req);
         if (!payload) return res.status(401).json({ success: false, error: "Unauthorized" });

         // Only finance and super admin can release escrow
         const role = payload.account_type?.toLowerCase();
         if (role !== "finance" && role !== "super admin") {
            return res.status(403).json({ success: false, error: "Only Finance role can release escrow" });
         }

         const { agreement_id, target_wallet_id, release_amount } = req.body;

         if (!agreement_id || !target_wallet_id) {
            return res.status(400).json({ success: false, error: "Missing required fields" });
         }

         // Get the agreement
         const agreement = await aggregatorDb.getAgreementById(agreement_id);
         if (!agreement || agreement.payment_status !== "escrow") {
            return res.status(400).json({ success: false, error: "Agreement not in escrow status" });
         }

         // Get finance wallet for this finance user
         let financeWallet = await aggregatorDb.getFinanceWallet(payload.id);
         if (!financeWallet) {
            financeWallet = await aggregatorDb.createFinanceWallet(payload.id);
         }

         // Release escrow from finance wallet to target wallet
         const amount = release_amount || agreement.financing_amount;
         await aggregatorDb.releaseEscrowFromFinance(
            financeWallet.id,
            payload.id,
            agreement_id,
            target_wallet_id,
            amount,
         );

         // Log action
         await createAuditLog(
            payload.id,
            payload.email,
            "RELEASE",
            "Escrow",
            `Released ${amount} from escrow for agreement ${agreement_id} to wallet ${target_wallet_id}`,
            req.ip
         );

         return res.status(200).json({
            success: true,
            message: "Escrow released successfully to wallet",
            data: {
               agreement_id,
               amount_released: amount,
               released_to: target_wallet_id,
            },
         });
      } catch (error) {
         console.error("Error releasing escrow:", error);
         return res.status(500).json({ success: false, error: error.message });
      }
   },

   // Get all finance wallets - FINANCE/SUPER ADMIN ONLY
   getFinanceWallets: async (req, res) => {
      try {
         const payload = await verifyVendorToken(req);
         if (!payload) return res.status(401).json({ success: false, error: "Unauthorized" });

         const role = payload.account_type?.toLowerCase();
         if (role !== "finance" && role !== "super admin") {
            return res
               .status(403)
               .json({ success: false, error: "Only Finance and Super Admin can view finance wallets" });
         }

         const wallets = await aggregatorDb.getAllFinanceWallets();
         return res.status(200).json({ success: true, data: wallets });
      } catch (error) {
         return res.status(500).json({ success: false, error: error.message });
      }
   },

   // Get my finance wallet - FINANCE ONLY
   getMyFinanceWallet: async (req, res) => {
      try {
         const payload = await verifyVendorToken(req);
         if (!payload) return res.status(401).json({ success: false, error: "Unauthorized" });

         const role = payload.account_type?.toLowerCase();
         if (role !== "finance" && role !== "super admin") {
            return res.status(403).json({ success: false, error: "Only Finance role can access finance wallets" });
         }

         let wallet = await aggregatorDb.getFinanceWallet(payload.id);
         if (!wallet) {
            wallet = await aggregatorDb.createFinanceWallet(payload.id);
         }

         return res.status(200).json({ success: true, data: wallet });
      } catch (error) {
         return res.status(500).json({ success: false, error: error.message });
      }
   },

   // Marketplace Data
   getMarketplaceData: async (req, res) => {
      try {
         const payload = await verifyVendorToken(req);
         if (!payload) return res.status(401).json({ success: false, error: "Unauthorized" });

         const data = await aggregatorDb.getMarketplaceData();
         return res.status(200).json({ success: true, data });
      } catch (error) {
         return res.status(500).json({ success: false, error: error.message });
      }
   },

   // Update Settings
   updateSettings: async (req, res) => {
      try {
         const payload = await verifyVendorToken(req);
         if (!payload) return res.status(401).json({ success: false, error: "Unauthorized" });

         const updatedProfile = await aggregatorDb.updateProfile(payload.id, req.body);
         return res.status(200).json({ success: true, data: updatedProfile });
      } catch (error) {
         return res.status(500).json({ success: false, error: error.message });
      }
   },

   // Get Aggregator's Personal Wallet
   getWallet: async (req, res) => {
      try {
         const payload = await verifyVendorToken(req);
         if (!payload) return res.status(401).json({ success: false, error: "Unauthorized" });

         const walletData = await getWalletByOwner(payload.id, "aggregator");
         return res.status(200).json({ success: true, data: walletData });
      } catch (error) {
         return res.status(500).json({ success: false, error: error.message });
      }
   },
};

// Helper: Generate PDF
async function generateAgreementPDF(agreement, buyer, aggregator) {
   return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      let buffers = [];
      doc.on("data", buffers.push.bind(buffers));
      doc.on("end", () => {
         let pdfData = Buffer.concat(buffers);
         const base64 = pdfData.toString("base64");
         const dataURI = `data:application/pdf;base64,${base64}`;
         cloudinary.uploader
            .upload(dataURI, { resource_type: "auto", folder: "agreements" })
            .then((result) => resolve(result.secure_url))
            .catch((err) => {
               console.warn("Cloudinary upload failed, using fallback URL.", err.message);
               resolve("https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf");
            });
      });

      // --- PDF THEME ---
      const greenTheme = "#10B981";
      const darkTheme = "#1F2937";

      // Header
      doc.fillColor(greenTheme).fontSize(28).text("AGRONORIA", { align: "center", characterSpacing: 2 });
      doc.fillColor(darkTheme).fontSize(14).text("Procurement & Purchase Agreement", { align: "center" });
      doc.moveDown(2);

      // Section: Parties
      doc.rect(50, doc.y, 500, 25).fill(greenTheme);
      doc.fillColor("#FFFFFF").fontSize(10).text("CONTRACTING PARTIES", 60, doc.y + 7);
      doc.moveDown(2);

      doc.fillColor(darkTheme).fontSize(10);
      doc.text("AGGREGATOR (Seller Side):", 50, doc.y, { bold: true });
      doc.text(`${aggregator.fname} ${aggregator.lname}`, 200, doc.y - 10);
      doc.moveDown(0.5);
      doc.text("BUYER (Purchaser):", 50, doc.y, { bold: true });
      doc.text(`${buyer.buyer_name}`, 200, doc.y - 10);
      doc.moveDown(0.5);
      doc.text("COMPANY:", 50, doc.y, { bold: true });
      doc.text(`${buyer.company_name || "N/A"}`, 200, doc.y - 10);
      doc.moveDown(2);

      // Section: Commodity Details
      doc.rect(50, doc.y, 500, 25).fill(darkTheme);
      doc.fillColor("#FFFFFF").text("COMMODITY & ORDER SPECIFICATIONS", 60, doc.y + 7);
      doc.moveDown(2);

      doc.fillColor(darkTheme);
      const startY = doc.y;
      doc.text("ITEM", 50, startY, { bold: true });
      doc.text("QUANTITY", 200, startY, { bold: true });
      doc.text("UNIT PRICE", 350, startY, { bold: true });
      doc.text("TOTAL VALUE", 450, startY, { bold: true });

      doc.moveTo(50, startY + 15).lineTo(550, startY + 15).stroke();
      doc.moveDown(1);

      doc.text(agreement.product_details.commodity, 50, doc.y);
      doc.text(`${agreement.product_details.quantity}`, 200, doc.y - 10);
      doc.text(`N${parseFloat(agreement.product_details.price).toLocaleString()}`, 350, doc.y - 10);
      doc.fillColor(greenTheme).text(`N${parseFloat(agreement.financing_amount).toLocaleString()}`, 450, doc.y - 10);

      doc.moveDown(3);

      // Section: Terms
      doc.fillColor(darkTheme).fontSize(12).text("Terms & Conditions", { underline: true });
      doc.moveDown(1);
      doc.fontSize(9).text(agreement.terms_and_conditions || "This agreement is subject to the standard platform fulfillment and quality control guidelines. Payments are held in secure escrow until delivery verification.", { width: 500, align: "justify" });

      // Signatures
      doc.moveDown(5);
      const sigY = doc.y;
      doc.moveTo(50, sigY).lineTo(200, sigY).stroke();
      doc.text("Aggregator Signature", 50, sigY + 5);

      doc.moveTo(350, sigY).lineTo(500, sigY).stroke();
      doc.text("Buyer Signature & Stamp", 350, sigY + 5);

      doc.fontSize(8).fillColor("#9CA3AF").text(`Generated securely by Agronoria Platform on ${new Date().toLocaleDateString()}`, 50, 750, { align: "center" });

      doc.end();
   });
}
