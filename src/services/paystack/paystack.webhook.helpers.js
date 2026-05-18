import { loanRepaymentService } from "../../db/vendor/loanRepayment.db.js";
import { upsertSubscriptionInvoice } from "../../db/vendor/sub.plans.db.js";
import pool from "../../lib/connect.js";
import { settleAdCampaignFromChargeSuccess } from "../../modules/ads/services/ads.settlement.service.js";
const LOG = (label, data) => {
   const timestamp = new Date().toISOString();
   const logEntry = {
      timestamp,
      label: `[BILLING:${label}]`,
      data: typeof data === "object" ? JSON.stringify(data, null, 2) : data,
   };
   console.log(logEntry.label, logEntry.data);
};
async function handleSubscriptionCreated(data) {
   try {
      LOG("WEBHOOK_SUBSCRIPTION_CREATED", data.status);
      const customerCode = data.customer?.customer_code;
      if (!customerCode) return;

      await pool.query(
         `INSERT INTO paystack_subscription_events (customer_code, subscription_code, next_payment_date, card_account_name) VALUES ($1, $2, $3, $4) ON CONFLICT (customer_code) DO UPDATE SET subscription_code = EXCLUDED.subscription_code, next_payment_date = EXCLUDED.next_payment_date, card_account_name = EXCLUDED.card_account_name`,
         [
            customerCode,
            data.subscription_code,
            data.next_payment_date ? new Date(data.next_payment_date) : null,
            data.authorization.account_name,
         ],
      );

      LOG("SUBSCRIPTION_CREATE_STORED", { customerCode, account_name: data.authorization.account_name });
   } catch (error) {
      LOG("WEBHOOK_SUBSCRIPTION_CREATED_ERROR", {
         message: error.message,
         stack: error.stack,
      });
   }
}

async function handleLoanRepayment(data) {
   const { amount, metadata, reference } = data;
   const nairaAmount = amount / 100;
   const { loan_id } = metadata;

   if (!loan_id) {
      console.error("Loan ID missing from metadata");
      return;
   }
   try {
      await loanRepaymentService.recordLoanPayment(loan_id, nairaAmount, reference);
   } catch (error) {
      console.error("Error processing loan repayment:", error);
      throw error;
   }
}

async function handleChargeSuccess(data) {
   LOG("WEBHOOK_CHARGE_SUCCESS", { reference: data.reference });

   const client = await pool.connect();

   try {
      const reference = data.reference;
      const customerCode = data.customer?.customer_code;

      if (!reference || !customerCode) {
         LOG("WEBHOOK_CHARGE_SUCCESS_INVALID", { reference, customerCode });
         return;
      }

      await client.query("BEGIN");

      // Idempotency Check
      const existingInvoice = await client.query(
         `SELECT 1 FROM subscription_invoices WHERE paystack_reference = $1 FOR UPDATE`,
         [reference],
      );

      if (existingInvoice.rowCount > 0) {
         LOG("WEBHOOK_CHARGE_SUCCESS_DUPLICATE", { reference });
         await client.query("ROLLBACK");
         return;
      }

      //  Lock subscription row to prevent race conditions.
      const subResult = await client.query(
         `SELECT vs.id, vs.vendor_id, vs.plan_id, vs.pending_plan_id, vs.status, sp.billing_cycle
          FROM vendor_subscriptions vs JOIN subscription_plans sp ON sp.id = vs.plan_id
          WHERE vs.paystack_customer_code = $1
          FOR UPDATE`,
         [customerCode],
      );

      if (subResult.rowCount === 0) {
         LOG("WEBHOOK_CHARGE_SUCCESS_NO_SUB", { reference, customerCode });
         await client.query("ROLLBACK");
         return;
      }

      const subscription = subResult.rows[0];

      // Calculate new billing period
      const periodStart = new Date(data.paid_at);
      const periodEnd = new Date(periodStart);

      if (subscription.billing_cycle === "annually") {
         periodEnd.setFullYear(periodEnd.getFullYear() + 1);
      } else {
         periodEnd.setMonth(periodEnd.getMonth() + 1);
      }

      // Always sync latest card authorization + restore active status
      await client.query(
         `UPDATE vendor_subscriptions SET current_period_start = $1, current_period_end = $2,
         paystack_authorization_code = $3, last4 = $4, card_type = $5, card_expires_month = $6,
          card_expires_year = $7, status = 'active', updated_at = NOW() WHERE id = $8`,
         [
            periodStart,
            periodEnd,
            data.authorization?.authorization_code,
            data.authorization?.last4,
            data.authorization?.card_type,
            data.authorization?.exp_month,
            data.authorization?.exp_year,
            subscription.id,
         ],
      );

      // Insert invoice (safe — idempotency already ensured)
      await client.query(
         `INSERT INTO subscription_invoices (vendor_id, subscription_id, amount, status, paystack_reference,
         period_start, period_end, paid_at, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
         [
            subscription.vendor_id,
            subscription.id,
            data.amount / 100,
            "paid",
            reference,
            periodStart,
            periodEnd,
            new Date(data.paid_at),
            new Date(data.created_at),
         ],
      );

      // Apply scheduled downgrade/upgrade AFTER renewal
      if (subscription.pending_plan_id) {
         await client.query(
            `UPDATE vendor_subscriptions SET plan_id = pending_plan_id, pending_plan_id = NULL,
            updated_at = NOW() WHERE id = $1`,
            [subscription.id],
         );

         LOG("WEBHOOK_PLAN_SWITCH_APPLIED", {
            subscriptionId: subscription.id,
            newPlanId: subscription.pending_plan_id,
         });
      }

      await client.query("COMMIT");

      LOG("WEBHOOK_CHARGE_SUCCESS_APPLIED", {
         subscriptionId: subscription.id,
         reference,
      });
   } catch (error) {
      await client.query("ROLLBACK");

      LOG("WEBHOOK_CHARGE_SUCCESS_ERROR", {
         message: error.message,
         stack: error.stack,
      });
   } finally {
      client.release();
   }
}

async function handleSubscriptionDisabled(data) {
   try {
      LOG("WEBHOOK_SUBSCRIPTION_DISABLED", { data });

      if (!data?.subscription_code) {
         return;
      }

      const result = await pool.query(
         `UPDATE vendor_subscriptions SET status = 'cancelled', cancel_at_period_end = true, cancelled_at = NOW(), updated_at = NOW() WHERE paystack_subscription_code = $1 RETURNING id, vendor_id`,
         [data.subscription_code],
      );

      LOG("WEBHOOK_SUBSCRIPTION_DISABLED_UPDATE", {
         rowCount: result.rowCount,
         subscription: result.rows[0],
      });
   } catch (error) {
      LOG("WEBHOOK_SUBSCRIPTION_DISABLED_ERROR", {
         message: error.message,
         stack: error.stack,
      });
   }
}

async function handleSubscriptionNotRenew(data) {
   try {
      LOG("WEBHOOK_SUBSCRIPTION_NOT_RENEWED", data.status);

      if (!data?.subscription_code) {
         return;
      }

      const result = await pool.query(
         `UPDATE vendor_subscriptions SET status = 'not_renewing', cancel_at_period_end = true, will_not_renew_at = NOW(), updated_at = NOW() WHERE paystack_subscription_code = $1
          RETURNING id, vendor_id`,
         [data.subscription_code],
      );

      LOG("WEBHOOK_SUBSCRIPTION_NOT_RENEWING_UPDATE", {
         rowCount: result.rowCount,
         subscription: result.rows[0],
      });
   } catch (error) {
      LOG("WEBHOOK_SUBSCRIPTION_NOT_RENEWING_ERROR", {
         message: error.message,
         stack: error.stack,
      });
   }
}

async function handleInvoiceCreated(data) {
   try {
      LOG("WEBHOOK_INVOICE_CREATED", { data });

      const subscriptionCode = data.subscription?.subscription_code;
      if (!subscriptionCode) return;

      const subResult = await pool.query(
         `SELECT id, vendor_id, paystack_reference FROM vendor_subscriptions WHERE paystack_subscription_code = $1`,
         [subscriptionCode],
      );

      if (subResult.rowCount === 0) return;

      const subscriptionRow = subResult.rows[0];

      await upsertSubscriptionInvoice({
         vendor_id: subscriptionRow.vendor_id,
         subscription_id: subscriptionRow.id,
         amount: data.amount / 100,
         status: data.status,
         paystack_reference: subscriptionRow.paystack_reference,
         period_start: data.period_start ? new Date(data.period_start) : null,
         period_end: data.period_end ? new Date(data.period_end) : null,
         paid_at: null,
         created_at: new Date(data.created_at),
      });

      LOG("WEBHOOK_INVOICE_CREATED_STORED", {
         subscriptionId: subscriptionRow.id,
      });
   } catch (error) {
      LOG("WEBHOOK_INVOICE_CREATED_ERROR", {
         message: error.message,
         stack: error.stack,
      });
   }
}

async function handleInvoicePaymentFailed(data) {
   try {
      LOG("WEBHOOK_INVOICE_PAYMENT_FAILED", { data });

      const subscriptionCode = data.subscription?.subscription_code;
      if (!subscriptionCode) return;

      const subResult = await pool.query(
         `SELECT id, vendor_id FROM vendor_subscriptions 
          WHERE paystack_subscription_code = $1`,
         [subscriptionCode],
      );

      if (subResult.rowCount === 0) {
         LOG("WEBHOOK_INVOICE_PAYMENT_FAILED_NO_SUB", { subscriptionCode });
         return;
      }

      const subscription = subResult.rows[0];

      await pool.query(
         `UPDATE subscription_invoices SET status = 'failed', updated_at = NOW() WHERE id = (SELECT id FROM subscription_invoices WHERE subscription_id = $1 AND status != 'paid' ORDER BY created_at DESC LIMIT 1)`,
         [subscription.id],
      );

      await pool.query(`UPDATE vendor_subscriptions SET status = 'past_due',  updated_at = NOW() WHERE id = $1`, [
         subscription.id,
      ]);

      LOG("WEBHOOK_INVOICE_PAYMENT_FAILED_PROCESSED", {
         subscriptionId: subscription.id,
         vendorId: subscription.vendor_id,
      });
   } catch (error) {
      LOG("WEBHOOK_INVOICE_PAYMENT_FAILED_ERROR", {
         message: error.message,
         stack: error.stack,
      });
   }
}

async function handleInvoiceUpdate(data) {
   try {
      LOG("WEBHOOK_INVOICE_UPDATE", "data received");

      const { subscription, customer, status, paid_at } = data;
      if (!subscription?.subscription_code || !customer?.customer_code) return;

      // Update invoice status
      const result = await pool.query(
         `UPDATE subscription_invoices SET status = $1, paid_at = $2, updated_at = NOW() WHERE paystack_reference = $3 RETURNING id, vendor_id, subscription_id`,
         [status === "success" ? "paid" : "pending", paid_at ? new Date(paid_at) : null, data.transaction?.reference],
      );

      if (result.rowCount > 0 && status === "success") {
         const invoice = result.rows[0];

         // Calculate next period end based on subscription billing cycle
         const subResult = await pool.query(
            `SELECT sp.billing_cycle FROM vendor_subscriptions vs JOIN subscription_plans sp ON sp.id = vs.plan_id WHERE vs.id = $1`,
            [invoice.subscription_id],
         );

         if (subResult.rowCount > 0) {
            const billingCycle = subResult.rows[0].billing_cycle;
            const periodStart = new Date(paid_at);
            const nextPeriodEnd = new Date(periodStart);

            if (billingCycle === "annually") {
               nextPeriodEnd.setFullYear(nextPeriodEnd.getFullYear() + 1);
            } else {
               nextPeriodEnd.setMonth(nextPeriodEnd.getMonth() + 1);
            }

            await pool.query(
               `UPDATE vendor_subscriptions SET status = 'active', current_period_start = $1, current_period_end = $2, updated_at = NOW() WHERE id = $3`,
               [periodStart, nextPeriodEnd, invoice.subscription_id],
            );
         }

         LOG("WEBHOOK_INVOICE_UPDATE_PROCESSED", {
            invoiceId: invoice.id,
            vendorId: invoice.vendor_id,
            status,
         });
      }
   } catch (error) {
      LOG("WEBHOOK_INVOICE_UPDATE_ERROR", { message: error.message, stack: error.stack });
   }
}

async function handleAdCampaignChargeSuccess(data) {
   try {
      const result = await settleAdCampaignFromChargeSuccess(data);
      LOG("WEBHOOK_AD_CAMPAIGN_SETTLED", result);
   } catch (error) {
      LOG("WEBHOOK_AD_CAMPAIGN_ERROR", { message: error.message, stack: error.stack });
      throw error;
   }
}

export {
   handleAdCampaignChargeSuccess,
   handleSubscriptionCreated,
   handleChargeSuccess,
   handleLoanRepayment,
   handleSubscriptionDisabled,
   handleSubscriptionNotRenew,
   handleInvoiceCreated,
   handleInvoicePaymentFailed,
   handleInvoiceUpdate,
};
