import { repaymentDb } from "../../db/marketplace/marketplace.db.js";

// ============ STAGE 14: REPAYMENT & RECONCILIATION ============

export const createFinancingRepayment = async (req, res) => {
   try {
      const { id: userId, account_type: role } = req.user;

      if (role !== "finance" && role !== "super admin") {
         return res.status(403).json({ error: "Only Finance can create repayment records" });
      }

      const { agreement_id, original_amount, interest_rate } = req.body;

      if (!agreement_id || !original_amount) {
         return res.status(400).json({ error: "Missing required fields" });
      }

      const repayment = await repaymentDb.createFinancingRepayment(agreement_id, original_amount, interest_rate || 0);

      res.status(201).json({
         success: true,
         message: "Financing repayment record created",
         repayment,
      });
   } catch (err) {
      console.error("Create repayment error:", err);
      res.status(500).json({ error: err.message });
   }
};

export const recordRepayment = async (req, res) => {
   try {
      const { id: userId, account_type: role } = req.user;

      if (role !== "finance" && role !== "super admin") {
         return res.status(403).json({ error: "Only Finance can record repayments" });
      }

      const { repayment_id, amount_paid, payment_method, reference_id } = req.body;

      const transaction = await repaymentDb.recordRepaymentTransaction(
         repayment_id,
         amount_paid,
         payment_method,
         reference_id,
      );

      res.status(201).json({
         success: true,
         message: "Repayment recorded successfully",
         transaction,
      });
   } catch (err) {
      console.error("Record repayment error:", err);
      res.status(500).json({ error: err.message });
   }
};

export const updateCreditScore = async (req, res) => {
   try {
      const { id: userId, account_type: role } = req.user;

      if (role !== "super admin") {
         return res.status(403).json({ error: "Only Super Admin can update credit scores" });
      }

      const { vendor_id, repayment_score, yield_score, compliance_score, payment_reliability_score } = req.body;

      const creditScore = await repaymentDb.updateCreditScore(vendor_id, {
         repayment_score,
         yield_score,
         compliance_score,
         payment_reliability_score,
      });

      res.status(200).json({
         success: true,
         message: "Credit score updated",
         creditScore,
      });
   } catch (err) {
      console.error("Update credit score error:", err);
      res.status(500).json({ error: err.message });
   }
};

export const getCreditScore = async (req, res) => {
   try {
      const { vendor_id } = req.params;
      const creditScore = await repaymentDb.getCreditScore(vendor_id);

      if (!creditScore) {
         return res.status(404).json({ error: "Credit score not found" });
      }

      res.status(200).json({
         success: true,
         creditScore,
      });
   } catch (err) {
      console.error("Get credit score error:", err);
      res.status(500).json({ error: err.message });
   }
};

export default {
   createFinancingRepayment,
   recordRepayment,
   updateCreditScore,
   getCreditScore,
};
