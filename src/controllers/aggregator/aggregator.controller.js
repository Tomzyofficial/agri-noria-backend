import { aggregatorDb } from "../../db/aggregator/aggregator.db.js";
import crypto from "crypto";
import PDFDocument from "pdfkit";
import { cloudinary } from "../../lib/cloudinary.img.js";
import { verifyVendorToken } from "../../sessions/vendor.auth.session.js";
import axios from "axios";
import { getWalletByOwner, createWallet, depositLockedFunds } from "../../db/pipeline/pipeline.db.js";
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

   // Verify & Stamp Agreement (Public - buyer facing)
   verifyAndStampAgreement: async (req, res) => {
      try {
         const { token } = req.params;
         const agreement = await aggregatorDb.getAgreementByToken(token);
         if (!agreement) return res.status(404).json({ success: false, error: "Agreement not found" });

         if (agreement.status === "accepted" || agreement.status === "stamped") {
            return res.status(400).json({ success: false, error: "Agreement has already been accepted" });
         }

         const { buyer_signature } = req.body || {};

         const updated = await aggregatorDb.updateAgreementStatus(agreement.id, "accepted", {
            ...(buyer_signature ? { buyer_signature } : {}),
         });

         return res.status(200).json({ success: true, data: updated });
      } catch (error) {
         console.error("Error verifying/stamping agreement:", error);
         return res.status(500).json({ success: false, error: error.message });
      }
   },

   // Download Agreement PDF (Public) - generates on-the-fly and streams to browser
   downloadAgreementPDF: async (req, res) => {
      try {
         const { token } = req.params;
         const agreement = await aggregatorDb.getAgreementByToken(token);
         if (!agreement) return res.status(404).json({ success: false, error: "Agreement not found" });

         // Generate PDF on the fly and stream it
         const doc = new PDFDocument({ margin: 50 });

         res.setHeader("Content-Type", "application/pdf");
         res.setHeader(
            "Content-Disposition",
            `inline; filename="agreement-${agreement.id.substring(0, 8)}.pdf"`
         );

         doc.pipe(res);
         drawPDFDocument(doc, agreement);
         doc.end();
      } catch (error) {
         console.error("Error generating PDF:", error);
         return res.status(500).json({ success: false, error: error.message });
      }
   },
};

// Helper: Generate PDF URL (returns a self-hosted URL instead of uploading to Cloudinary)
async function generateAgreementPDF(agreement, buyer, aggregator) {
   // Instead of uploading to a third-party service, we point to our own endpoint
   // that generates the PDF on-the-fly when accessed.
   const backendUrl = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 3000}`;
   return `${backendUrl}/api/aggregator/agreement-pdf/${agreement.secure_token}`;
}

// Helper: Draw the PDF document content
function drawPDFDocument(doc, agreement) {
   const product = typeof agreement.product_details === "string"
      ? JSON.parse(agreement.product_details)
      : agreement.product_details || {};

   const formatCurrency = (amount) => {
      const num = parseFloat(amount) || 0;
      return "₦" + num.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
   };

   const formatDate = (date) => {
      if (!date) return "N/A";
      return new Date(date).toLocaleDateString("en-NG", {
         year: "numeric", month: "long", day: "numeric"
      });
   };

   // === HEADER ===
   doc.fontSize(22).font("Helvetica-Bold").fillColor("#1a5c2e")
      .text("AGRI-NORIA", { align: "center" });
   doc.fontSize(10).font("Helvetica").fillColor("#666666")
      .text("Agricultural Procurement Platform", { align: "center" });
   doc.moveDown(0.5);

   // Divider
   doc.strokeColor("#1a5c2e").lineWidth(2)
      .moveTo(50, doc.y).lineTo(545, doc.y).stroke();
   doc.moveDown(1);

   // === TITLE ===
   doc.fontSize(16).font("Helvetica-Bold").fillColor("#333333")
      .text("PROCUREMENT AGREEMENT", { align: "center" });
   doc.moveDown(0.3);
   doc.fontSize(9).font("Helvetica").fillColor("#888888")
      .text(`Agreement ID: ${agreement.id}`, { align: "center" });
   doc.fontSize(9)
      .text(`Date: ${formatDate(agreement.created_at)}`, { align: "center" });
   doc.moveDown(1);

   // === PARTIES SECTION ===
   doc.fontSize(12).font("Helvetica-Bold").fillColor("#1a5c2e")
      .text("PARTIES");
   doc.strokeColor("#dddddd").lineWidth(0.5)
      .moveTo(50, doc.y).lineTo(545, doc.y).stroke();
   doc.moveDown(0.5);

   // Aggregator
   doc.fontSize(10).font("Helvetica-Bold").fillColor("#333333")
      .text("Aggregator (Seller):");
   doc.fontSize(10).font("Helvetica").fillColor("#555555");
   if (agreement.aggregator_company) doc.text(`  Company: ${agreement.aggregator_company}`);
   const aggName = [agreement.aggregator_fname, agreement.aggregator_lname].filter(Boolean).join(" ");
   if (aggName) doc.text(`  Representative: ${aggName}`);
   if (agreement.aggregator_email) doc.text(`  Email: ${agreement.aggregator_email}`);
   doc.moveDown(0.5);

   // Buyer
   doc.fontSize(10).font("Helvetica-Bold").fillColor("#333333")
      .text("Buyer:");
   doc.fontSize(10).font("Helvetica").fillColor("#555555");
   if (agreement.buyer_name) doc.text(`  Name: ${agreement.buyer_name}`);
   if (agreement.buyer_company) doc.text(`  Company: ${agreement.buyer_company}`);
   if (agreement.buyer_email) doc.text(`  Email: ${agreement.buyer_email}`);
   if (agreement.buyer_phone) doc.text(`  Phone: ${agreement.buyer_phone}`);
   if (agreement.buyer_address) doc.text(`  Address: ${agreement.buyer_address}`);
   doc.moveDown(1);

   // === PRODUCT DETAILS ===
   doc.fontSize(12).font("Helvetica-Bold").fillColor("#1a5c2e")
      .text("PRODUCT DETAILS");
   doc.strokeColor("#dddddd").lineWidth(0.5)
      .moveTo(50, doc.y).lineTo(545, doc.y).stroke();
   doc.moveDown(0.5);

   doc.fontSize(10).font("Helvetica").fillColor("#555555");
   if (product.commodity) doc.text(`  Commodity: ${product.commodity}`);
   if (product.quantity) doc.text(`  Quantity: ${product.quantity} ${product.unit || "units"}`);
   if (product.price) doc.text(`  Unit Price: ${formatCurrency(product.price)}`);
   if (product.location) doc.text(`  Location: ${product.location}`);
   if (product.quality_grade) doc.text(`  Quality Grade: ${product.quality_grade}`);
   if (product.delivery_date) doc.text(`  Expected Delivery: ${formatDate(product.delivery_date)}`);

   doc.moveDown(0.5);
   doc.fontSize(11).font("Helvetica-Bold").fillColor("#333333")
      .text(`  Total Procurement Value: ${formatCurrency(agreement.financing_amount)}`);
   doc.moveDown(0.5);
   doc.fontSize(10).font("Helvetica").fillColor("#555555")
      .text(`  Type: ${agreement.is_pre_harvest ? "Pre-Harvest (Scenario A)" : "Post-Harvest (Scenario B)"}`);
   doc.moveDown(1);

   // === TERMS & CONDITIONS ===
   if (agreement.terms_and_conditions) {
      doc.fontSize(12).font("Helvetica-Bold").fillColor("#1a5c2e")
         .text("TERMS & CONDITIONS");
      doc.strokeColor("#dddddd").lineWidth(0.5)
         .moveTo(50, doc.y).lineTo(545, doc.y).stroke();
      doc.moveDown(0.5);

      doc.fontSize(9).font("Helvetica").fillColor("#555555")
         .text(agreement.terms_and_conditions, { align: "justify", lineGap: 3 });
      doc.moveDown(1);
   }

   // === SIGNATURE SECTION ===
   doc.fontSize(12).font("Helvetica-Bold").fillColor("#1a5c2e")
      .text("SIGNATURES");
   doc.strokeColor("#dddddd").lineWidth(0.5)
      .moveTo(50, doc.y).lineTo(545, doc.y).stroke();
   doc.moveDown(1);

   const sigY = doc.y;

   // Aggregator signature
   doc.fontSize(10).font("Helvetica").fillColor("#555555")
      .text("____________________________", 50, sigY)
      .text(agreement.aggregator_company || "Aggregator", 50, sigY + 18)
      .text("(Aggregator)", 50, sigY + 32);

   // Buyer signature
   doc.text("____________________________", 320, sigY)
      .text(agreement.buyer_name || "Buyer", 320, sigY + 18)
      .text("(Buyer)", 320, sigY + 32);

   doc.moveDown(4);

   // === FOOTER ===
   const footerY = doc.page.height - 60;
   doc.fontSize(8).font("Helvetica").fillColor("#aaaaaa")
      .text(
         "This document was generated by the Agri-Noria Platform. For inquiries, contact support@agri-noria.com",
         50, footerY, { align: "center", width: 495 }
      );
   doc.text(
      `Generated on ${new Date().toLocaleDateString("en-NG", { year: "numeric", month: "long", day: "numeric" })}`,
      50, footerY + 12, { align: "center", width: 495 }
   );
}
