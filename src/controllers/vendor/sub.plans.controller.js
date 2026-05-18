import pool from "../../lib/connect.js";
import {
   getSubPlans,
   getPlanCode,
   getVendorSubscription,
   storePendingSubscription,
   getRecentTransactionByRef,
   markTransactionComplete,
   upsertSubscriptionInvoice,
   upsertVendorSubscription,
} from "../../db/vendor/sub.plans.db.js";
import { verifyVendorToken } from "../../sessions/vendor.auth.session.js";
import { initializePaystack, verifyPaystackTransaction } from "../../lib/services/paystack.service.js";

const LOG = (label, data) => {
   const timestamp = new Date().toISOString();
   const logEntry = {
      timestamp,
      label: `[BILLING:${label}]`,
      data: typeof data === "object" ? JSON.stringify(data, null, 2) : data,
   };
   console.log(logEntry.label, logEntry.data);
};

// Enhanced signature verification with better error handling
/* function verifyPaystackSignature(rawBody, signature) {
   try {
      if (!rawBody || !signature) {
         LOG("SIGNATURE_VERIFICATION_MISSING_DATA", {
            hasBody: !!rawBody,
            hasSignature: !!signature,
         });
         return false;
      }

      if (!process.env.PAYSTACK_SECRET_KEY) {
         LOG("SIGNATURE_VERIFICATION_NO_SECRET", {});
         return false;
      }

      const hmac = crypto.createHmac("sha512", process.env.PAYSTACK_SECRET_KEY);
      const bodyString = typeof rawBody === "string" ? rawBody : JSON.stringify(rawBody);
      const hash = hmac.update(bodyString).digest("hex");

      const isValid = hash === signature;

      if (!isValid) {
         LOG("SIGNATURE_VERIFICATION_MISMATCH", {
            expected: hash.substring(0, 20) + "...",
            received: signature.substring(0, 20) + "...",
            bodyLength: bodyString.length,
         });
      }

      return isValid;
   } catch (error) {
      LOG("SIGNATURE_VERIFICATION_ERROR", {
         message: error.message,
         stack: error.stack,
      });
      return false;
   }
} */

const subPlansController = {};

// Get current vendor subscription for UI
subPlansController.getCurrent = async (req, res) => {
   try {
      const payload = await verifyVendorToken(req);
      if (!payload?.id) {
         return res.status(401).json({ success: false, error: "Unauthorized" });
      }
      const subscription = await getVendorSubscription(payload.id);
      return res.status(200).json({ success: true, subscription: subscription || null });
   } catch {
      return res.status(500).json({ success: false, error: "Internal server error" });
   }
};

// Get all subscription plans
subPlansController.getPlans = async (_, res) => {
   const plans = await getSubPlans();
   return res.status(200).json({ success: true, data: plans });
};

// Initialize subscription
subPlansController.initialize = async (req, res) => {
   try {
      const payload = await verifyVendorToken(req);
      if (!payload?.id) {
         return res.status(401).json({ success: false, error: "Unauthorized" });
      }
      const { email, vendorId, planId, planName, amount, interval } = req.body;
      if (!vendorId || !planId || !amount || !email || !planName) {
         return res.status(400).json({
            success: false,
            error: "Missing required fields: vendorId, planId, amount, email, and planName are required",
         });
      }
      if (vendorId !== payload.id) {
         return res.status(403).json({ success: false, error: "Vendor ID does not match authenticated user" });
      }

      // Validate amount and email format
      if (amount <= 0) {
         return res.status(400).json({
            success: false,
            error: "Amount must be greater than zero",
         });
      }

      // Get or create plan code
      const planCodeResult = await getPlanCode(planId);
      if (!planCodeResult) {
         return res.status(400).json({
            success: false,
            error: "Failed to get plan details",
         });
      }

      const paystackPlanCode = planCodeResult;

      // For paystack callbck
      const accountTypeRoutes = {
         farmer: "/dashboard/store/",
         seller: "/dashboard/store/",
         storage_facility: "/dashboard/sub-store/",
         logistics: "/dashboard/logistics/",
         admin: "/dashboard/admin/",
      };

      const targetRoute = accountTypeRoutes[payload.account_type?.toLowerCase()];

      const initResponse = await initializePaystack("/transaction/initialize", {
         body: {
            email,
            amount: amount * 100,
            plan: paystackPlanCode,
            metadata: { planId, vendorId, interval: interval, planName },
            callback_url: `${process.env.APP_BASEURL}${targetRoute}billing`,
         },
      });

      const reference = initResponse.data.reference;

      await storePendingSubscription(reference, vendorId, planId, interval, email, amount, planName);

      return res.status(200).json({
         success: true,
         data: {
            authorization_url: initResponse.data.authorization_url,
            access_code: initResponse.data.access_code,
            reference,
         },
      });
   } catch (error) {
      LOG("INITIALIZE_ERROR", { message: error.message, stack: error.stack });
      return res.status(500).json({
         success: false,
         error: error.message || "Internal server error. Try again.",
      });
   }
};

// Verify payment and create subscription. This is the source of truth for new subscriptions.
subPlansController.verifyPayment = async (req, res) => {
   try {
      const payload = await verifyVendorToken(req);
      if (!payload?.id) {
         return res.status(401).json({ success: false, error: "Unauthorized" });
      }

      const ref = req.query.ref;

      const verifyRes = await verifyPaystackTransaction(ref);
      if (verifyRes.data?.status !== "success") {
         return res.status(400).json({ success: false, error: "Payment verification not successful" });
      }

      await markTransactionComplete(ref);

      const recentransaction = await getRecentTransactionByRef(ref);
      if (!recentransaction) {
         return res.status(404).json({ success: false, error: "No recent record transaction found" });
      }

      const periodStart = new Date(verifyRes.data.paid_at);
      const periodEnd = new Date(periodStart);
      recentransaction.interval === "annually"
         ? periodEnd.setFullYear(periodEnd.getFullYear() + 1)
         : periodEnd.setMonth(periodEnd.getMonth() + 1);

      // This is the source of truth for active subscriptions.
      const subscription = await upsertVendorSubscription({
         vendor_id: recentransaction.vendorId,
         plan_id: recentransaction.planId,
         status: "active",
         current_period_start: periodStart,
         current_period_end: periodEnd,
         created_at: recentransaction.created_at,
         last4: verifyRes.data.authorization.last4,
         card_type: verifyRes.data.authorization.card_type,
         card_expires_month: verifyRes.data.authorization.exp_month,
         card_expires_year: verifyRes.data.authorization.exp_year,
         paystack_authorization_code: verifyRes.data.authorization.authorization_code,
         paystack_customer_code: verifyRes.data.customer.customer_code,
         paystack_reference: verifyRes.data.reference,
      });

      // Check for deferred subscription events that arrived before verifyPayment and update subscription if found
      const deferred = await pool.query(
         `SELECT subscription_code, next_payment_date, card_account_name FROM paystack_subscription_events WHERE customer_code = $1`,
         [verifyRes.data.customer.customer_code],
      );

      if (deferred.rowCount > 0) {
         await pool.query(
            `UPDATE vendor_subscriptions SET paystack_subscription_code = $1, current_period_end = COALESCE($2, current_period_end), card_account_name = COALESCE($3, card_account_name) WHERE id = $4`,
            [
               deferred.rows[0].subscription_code,
               deferred.rows[0].next_payment_date,
               deferred.rows[0].card_account_name,
               subscription.id,
            ],
         );
      }

      /**
       * Invoice for initial charge
       * Must be idempotent on paystack_reference
       */
      await upsertSubscriptionInvoice({
         vendor_id: recentransaction.vendorId,
         subscription_id: subscription.id,
         amount: recentransaction.amount,
         paystack_reference: ref,
         period_start: periodStart,
         period_end: periodEnd,
         paid_at: new Date(verifyRes.data.paid_at),
         created_at: new Date(recentransaction.created_at),
      });

      res.json({ success: true });
   } catch (error) {
      LOG("VERIFY_PAYMENT_ERROR", { message: error.message, stack: error.stack });
      res.status(500).json({ success: false, error: "Error verifying payment" });
   }
};

// Cancel subscription
subPlansController.cancel = async (req, res) => {
   try {
      const payload = await verifyVendorToken(req);
      if (!payload?.id) {
         return res.status(401).json({ success: false, error: "Unauthorized" });
      }

      const currentSubscription = await getVendorSubscription(payload.id);

      if (!currentSubscription) {
         return res.status(404).json({ success: false, error: "No active subscription found" });
      }

      if (!currentSubscription.paystack_subscription_code) {
         return res.status(400).json({ success: false, error: "Subscription cannot be cancelled - no Paystack code" });
      }

      const subDetailRes = await fetch(
         `https://api.paystack.co/subscription/${currentSubscription.paystack_subscription_code}`,
         {
            headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
         },
      );
      const subDetail = await subDetailRes.json();

      if (!subDetail.status) throw new Error("Could not retrieve subscription details.");

      const emailToken = subDetail.data.email_token;

      // Cancel subscription via Paystack API (correct endpoint)
      const cancelResponse = await fetch(`https://api.paystack.co/subscription/disable`, {
         method: "POST",
         headers: {
            Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
            "Content-Type": "application/json",
         },
         body: JSON.stringify({
            code: currentSubscription.paystack_subscription_code,
            token: emailToken,
         }),
      });

      const cancelData = await cancelResponse.json();
      if (!cancelResponse.ok) {
         LOG("CANCEL_SUBSCRIPTION_ERROR", cancelData);
         return res.status(400).json({
            success: false,
            error: cancelData.message || "Failed to cancel subscription",
         });
      }

      return res.status(200).json({
         success: true,
         message: "Subscription cancelled successfully",
      });
   } catch (error) {
      LOG("CANCEL_SUBSCRIPTION_CONTROLLER_ERROR", { message: error.message, stack: error.stack });
      return res.status(500).json({
         success: false,
         error: error.message || "Internal server error. Please try again later.",
      });
   }
};

// Used for updating card
subPlansController.getManageLink = async (req, res) => {
   try {
      const payload = await verifyVendorToken(req);
      if (!payload?.id) {
         return res.status(401).json({ success: false, error: "Unauthorized" });
      }

      const subscription = await getVendorSubscription(payload.id);
      if (!subscription?.paystack_subscription_code) {
         return res.status(404).json({
            success: false,
            error: "Active subscription not found",
         });
      }

      const paystackResponse = await fetch(
         `https://api.paystack.co/subscription/${subscription.paystack_subscription_code}/manage/link`,
         {
            method: "GET",
            headers: {
               Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
            },
         },
      );

      if (!paystackResponse.ok) {
         const text = await paystackResponse.text();
         console.error("Paystack manage link error:", text);
         return res.status(400).json({
            success: false,
            error: "Unable to generate manage link",
         });
      }

      const paystackData = await paystackResponse.json();

      return res.status(200).json({
         success: true,
         url: paystackData.data.link,
      });
   } catch (err) {
      console.error("[BILLING:GET_MANAGE_LINK_CRITICAL_ERROR]", err);
      return res.status(500).json({
         success: false,
         error: "Internal server error. Please try again later.",
      });
   }
};

// Upgrade subscription - Using Paystack management link
subPlansController.upgrade = async (req, res) => {
   try {
      const payload = await verifyVendorToken(req);
      if (!payload?.id) {
         return res.status(401).json({ success: false, error: "Unauthorized" });
      }

      const { targetPlanId } = req.body;
      if (!targetPlanId) {
         return res.status(400).json({
            success: false,
            error: "Target plan ID is required",
         });
      }

      const client = await pool.connect();

      try {
         await client.query("BEGIN");

         // Lock current subscription row
         const currentSubResult = await client.query(
            `SELECT vs.*, sp.amount FROM vendor_subscriptions vs JOIN subscription_plans sp ON sp.id = vs.plan_id WHERE vs.vendor_id = $1 FOR UPDATE`,
            [payload.id],
         );

         if (currentSubResult.rowCount === 0) {
            await client.query("ROLLBACK");
            return res.status(404).json({
               success: false,
               error: "No active subscription found",
            });
         }

         const currentSubscription = currentSubResult.rows[0];

         //  Fetch target plan
         const targetPlanResult = await client.query(`SELECT * FROM subscription_plans WHERE id = $1`, [targetPlanId]);

         if (targetPlanResult.rowCount === 0) {
            await client.query("ROLLBACK");
            return res.status(404).json({
               success: false,
               error: "Target plan not found",
            });
         }

         const targetPlan = targetPlanResult.rows[0];

         // Validate upgrade (must be more expensive)
         if (targetPlan.amount <= currentSubscription.amount) {
            await client.query("ROLLBACK");
            return res.status(400).json({
               success: false,
               error: "Target plan must be more expensive for upgrade",
            });
         }

         //  Prevent duplicate scheduling
         if (currentSubscription.pending_plan_id === targetPlanId) {
            await client.query("ROLLBACK");
            return res.status(400).json({
               success: false,
               error: "Upgrade already scheduled",
            });
         }

         // Schedule upgrade (no Paystack mutation)
         await client.query(
            `UPDATE vendor_subscriptions SET pending_plan_id = $1, updated_at = NOW(), cancel_at_period_end = false WHERE id = $2 AND vendor_id = $3`,
            [targetPlanId, currentSubscription.id, payload.id],
         );

         await client.query("COMMIT");

         return res.status(200).json({
            success: true,
            message: "Upgrade scheduled successfully for next billing cycle.",
         });
      } catch {
         await client.query("ROLLBACK");
         return res.status(500).json({
            success: false,
            error: "Internal server error. Please try again later.",
         });
      } finally {
         client.release();
      }
   } catch (error) {
      LOG("UPGRADE_SUBSCRIPTION_CONTROLLER_ERROR", {
         message: error.message,
         stack: error.stack,
      });

      return res.status(500).json({
         success: false,
         error: "Internal server error. Please try again later.",
      });
   }
};

// Downgrade subscription
subPlansController.downgrade = async (req, res) => {
   try {
      const payload = await verifyVendorToken(req);
      if (!payload?.id) {
         return res.status(401).json({ success: false, error: "Unauthorized" });
      }

      const { targetPlanId } = req.body;
      if (!targetPlanId) {
         return res.status(400).json({ success: false, error: "Target plan ID is required" });
      }

      const currentSubscription = await getVendorSubscription(payload.id);
      if (!currentSubscription) {
         return res.status(404).json({ success: false, error: "No active subscription found" });
      }

      // Get target plan details
      const targetPlanResult = await pool.query(`SELECT * FROM subscription_plans WHERE id = $1`, [targetPlanId]);

      if (targetPlanResult.rowCount === 0) {
         return res.status(404).json({ success: false, error: "Target plan not found" });
      }

      const targetPlan = targetPlanResult.rows[0];

      // Validate downgrade (target plan should be less expensive)
      if (targetPlan.amount >= currentSubscription.vendor_sub_amount) {
         return res.status(400).json({
            success: false,
            error: "Target plan must be less expensive for downgrade",
         });
      }

      if (!currentSubscription.paystack_subscription_code) {
         return res.status(400).json({ success: false, error: "Cannot downgrade - no Paystack subscription code" });
      }

      await pool.query(
         `UPDATE vendor_subscriptions SET pending_plan_id = $1, cancel_at_period_end = false, updated_at = NOW() WHERE vendor_id = $2`,
         [targetPlanId, payload.id],
      );

      return res.status(200).json({
         success: true,
         message: "Downgrade scheduled successfully for next billing cycle",
      });
   } catch (error) {
      LOG("DOWNGRADE_SUBSCRIPTION_CONTROLLER_ERROR", { message: error.message, stack: error.stack });
      return res.status(500).json({
         success: false,
         error: "Internal server error. Please try again later.",
      });
   }
};

// Reactivate subscription
/* subPlansController.reactivate = async (req, res) => {
   try {
      const payload = await verifyVendorToken(req);
      if (!payload?.id) {
         return res.status(401).json({ success: false, error: "Unauthorized" });
      }
      const currentSubscription = await getVendorSubscription(payload.id);
      if (!currentSubscription) {
         return res.status(404).json({ success: false, error: "No subscription found" });
      }

      if (currentSubscription.status !== "cancelled" && currentSubscription.status !== "not_renewing") {
         return res.status(400).json({ success: false, error: "Subscription is not eligible for reactivation" });
      }

      if (!currentSubscription.paystack_subscription_code) {
         return res.status(400).json({ success: false, error: "Cannot reactivate - no Paystack subscription code" });
      }

      const subDetailRes = await fetch(
         `https://api.paystack.co/subscription/${currentSubscription.paystack_subscription_code}`,
         {
            headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
         },
      );
      const subDetail = await subDetailRes.json();

      if (!subDetail.status) throw new Error("Could not retrieve subscription details from Paystack");

      const emailToken = subDetail.data.email_token;

      // Reactivate subscription via Paystack API
      const reactivateResponse = await fetch(`https://api.paystack.co/subscription/enable`, {
         method: "POST",
         headers: {
            Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
            "Content-Type": "application/json",
         },
         body: JSON.stringify({
            code: currentSubscription.paystack_subscription_code,
            token: emailToken,
         }),
      });

      const reactivateData = await reactivateResponse.json();
      if (!reactivateResponse.ok) {
         LOG("REACTIVATE_SUBSCRIPTION_ERROR", reactivateData);
         return res.status(400).json({
            success: false,
            error: reactivateData.message || "Failed to reactivate subscription",
         });
      }

      // Update local subscription status
      await pool.query(
         `UPDATE vendor_subscriptions SET status = 'active',  will_not_renew_at = NULL, cancelled_at = NULL, updated_at = NOW() WHERE vendor_id = $1`,
         [payload.id],
      );

      return res.status(200).json({
         success: true,
         message: "Subscription reactivated successfully",
      });
   } catch (error) {
      LOG("REACTIVATE_SUBSCRIPTION_CONTROLLER_ERROR", { message: error.message, stack: error.stack });
      return res.status(500).json({
         success: false,
         error: error.message || "An error occurred while reactivating subscription",
      });
   }
}; */

// Get subscription management options (upgrade/downgrade/cancel/reactivate)
// not in use
/* subPlansController.getManagementOptions = async (req, res) => {
   try {
      const payload = await verifyVendorToken(req);
      if (!payload?.id) {
         return res.status(401).json({ success: false, error: "Unauthorized" });
      }

      // Get current subscription
      const currentSubscription = await getVendorSubscription(payload.id);

      // Get all available plans
      const allPlans = await getSubPlans();

      // Filter plans for upgrade/downgrade options
      const upgradeOptions = currentSubscription
         ? allPlans.filter((plan) => plan.amount > currentSubscription.amount)
         : allPlans;

      const downgradeOptions = currentSubscription
         ? allPlans.filter((plan) => plan.amount < currentSubscription.amount)
         : [];

      // Determine available actions
      const availableActions = {
         canUpgrade: upgradeOptions.length > 0,
         canDowngrade: downgradeOptions.length > 0,
         canCancel: !!currentSubscription && currentSubscription.status === "active",
         canReactivate: !!currentSubscription && ["cancelled", "not_renewing"].includes(currentSubscription.status),
         canInitialize: !currentSubscription,
      };

      return res.status(200).json({
         success: true,
         data: {
            currentSubscription: currentSubscription || null,
            availableActions,
            upgradeOptions,
            downgradeOptions,
            allPlans,
         },
      });
   } catch (error) {
      LOG("GET_MANAGEMENT_OPTIONS_ERROR", { message: error.message, stack: error.stack });
      return res.status(500).json({
         success: false,
         error: error.message || "An error occurred while fetching management options",
      });
   }
}; */

// Get subscription history and invoices
subPlansController.getHistory = async (req, res) => {
   try {
      const payload = await verifyVendorToken(req);

      if (!payload?.id) {
         return res.status(401).json({ success: false, error: "Unauthorized" });
      }

      const { page = 1, pageSize = 2 } = req.query;
      const offset = (page - 1) * pageSize;

      // Get subscription invoices with pagination
      const { rows: invoicesResult } = await pool.query(
         `SELECT si.amount, si.paystack_reference, si.paid_at, si.status, si.currency, si.period_start, si.period_end, tr.metadata
         FROM subscription_invoices AS si JOIN transactions AS tr ON si.paystack_reference = tr.reference WHERE si.vendor_id = $1
         ORDER BY si.created_at DESC LIMIT $2 OFFSET $3`,
         [payload.id, pageSize, offset],
      );

      // Get total count for pagination
      const { rows: countResult } = await pool.query(
         `SELECT COUNT(*) as total FROM subscription_invoices WHERE vendor_id = $1`,
         [payload.id],
      );

      const total = parseInt(countResult[0]?.total || 0);

      return res.status(200).json({
         success: true,
         data: {
            invoices: invoicesResult,
            pagination: {
               total,
            },
         },
      });
   } catch (error) {
      LOG("GET_SUBSCRIPTION_HISTORY_ERROR", { message: error.message, stack: error.stack });
      return res.status(500).json({
         success: false,
         error: error.message || "An error occurred while fetching subscription history",
      });
   }
};

export default subPlansController;
