import { loanRepaymentService } from "../../db/vendor/not-in-useloanRepayment.db.js";
import { upsertSubscriptionInvoice } from "../../db/vendor/sub.plans.db.js";
import {
  getEcosystemOrderPaymentByReference,
  recordEcosystemPaystackVerification,
} from "../../db/pipeline/pipeline.db.js";
import pool from "../connect.js";
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

    LOG("SUBSCRIPTION_CREATE_STORED", {
      customerCode,
      account_name: data.authorization.account_name,
    });
  } catch (error) {
    LOG("WEBHOOK_SUBSCRIPTION_CREATED_ERROR", {
      message: error.message,
      stack: error.stack,
    });
  }
}

// async function handleLoanRepayment(data) {
//    const { amount, metadata, reference } = data;
//    const nairaAmount = amount / 100;
//    const { loan_id } = metadata;

//    if (!loan_id) {
//       console.error("Loan ID missing from metadata");
//       return;
//    }
//    try {
//       await loanRepaymentService.recordLoanPayment(loan_id, nairaAmount, reference);
//    } catch (error) {
//       console.error("Error processing loan repayment:", error);
//       throw error;
//    }
// }

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

    await pool.query(
      `UPDATE vendor_subscriptions SET status = 'past_due',  updated_at = NOW() WHERE id = $1`,
      [subscription.id],
    );

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
      [
        status === "success" ? "paid" : "pending",
        paid_at ? new Date(paid_at) : null,
        data.transaction?.reference,
      ],
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
    LOG("WEBHOOK_INVOICE_UPDATE_ERROR", {
      message: error.message,
      stack: error.stack,
    });
  }
}

async function handleAggregatorEscrow(data) {
  const { amount, metadata, reference } = data;
  const nairaAmount = amount / 100;
  const { agreement_id } = metadata;

  if (!agreement_id) {
    console.error("Agreement ID missing from metadata");
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Update agreement status
    await client.query(
      "UPDATE buyer_agreements SET status = 'paid', payment_status = 'escrow', paystack_reference = $1, updated_at = NOW() WHERE id = $2",
      [reference, agreement_id],
    );

    // Create escrow record
    await client.query(
      "INSERT INTO escrow_payments (agreement_id, amount, status) VALUES ($1, $2, 'held')",
      [agreement_id, nairaAmount],
    );

    // Find all finance users and add to their wallets
    const financeUsersRes = await client.query(
      "SELECT id FROM vendors WHERE role = 'Finance' OR role = 'finance' LIMIT 1",
    );

    if (financeUsersRes.rows.length > 0) {
      const financeUserId = financeUsersRes.rows[0].id;

      // Ensure finance wallet exists
      const financeWalletRes = await client.query(
        "SELECT * FROM finance_wallets WHERE finance_user_id = $1",
        [financeUserId],
      );

      let financeWalletId;
      if (financeWalletRes.rows.length === 0) {
        const createRes = await client.query(
          "INSERT INTO finance_wallets (finance_user_id) VALUES ($1) RETURNING id",
          [financeUserId],
        );
        financeWalletId = createRes.rows[0].id;
      } else {
        financeWalletId = financeWalletRes.rows[0].id;
      }

      // Add to finance wallet (held in escrow)
      await client.query(
        "UPDATE finance_wallets SET balance = balance + $1, held_in_escrow = held_in_escrow + $1 WHERE id = $2",
        [nairaAmount, financeWalletId],
      );

      // Record finance transaction
      await client.query(
        "INSERT INTO finance_wallet_transactions (finance_wallet_id, type, amount, description, agreement_id, status) VALUES ($1, $2, $3, $4, $5, $6)",
        [
          financeWalletId,
          "received_escrow",
          nairaAmount,
          `Escrow received from Paystack for Agreement ${agreement_id.substring(0, 8)}`,
          agreement_id,
          "completed",
        ],
      );

      // Update escrow status
      await client.query(
        "UPDATE escrow_payments SET status = 'received_by_finance' WHERE agreement_id = $1",
        [agreement_id],
      );
    }

    await client.query("COMMIT");
    LOG("AGGREGATOR_ESCROW_STORED", {
      agreement_id,
      reference,
      amount: nairaAmount,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error processing aggregator escrow:", error);
    throw error;
  } finally {
    client.release();
  }
}

async function handleEcosystemOrderPayment(data) {
  const { reference, status, id, paid_at, channel, currency } = data;
  try {
    LOG("WEBHOOK_ECOSYSTEM_ORDER_PAYMENT", { reference, status });
    if (status !== "success") return;

    const payment = await getEcosystemOrderPaymentByReference(reference);
    if (!payment) {
      LOG("WEBHOOK_ECOSYSTEM_ORDER_PAYMENT_NOT_FOUND", { reference });
      return;
    }

    if (
      payment.status === "paystack_verified" ||
      payment.status === "finance_confirmed"
    ) {
      LOG("WEBHOOK_ECOSYSTEM_ORDER_PAYMENT_ALREADY_PROCESSED", { reference });
      return;
    }

    const expectedAmountKobo = Math.round(Number(payment.amount) * 100);
    if (data.amount !== expectedAmountKobo) {
      LOG("WEBHOOK_ECOSYSTEM_ORDER_PAYMENT_AMOUNT_MISMATCH", {
        expectedAmountKobo,
        amount: data.amount,
      });
      return;
    }

    await recordEcosystemPaystackVerification(payment.id, String(id), {
      ...(payment.metadata || {}),
      paystack: {
        status,
        paid_at,
        channel,
        currency,
      },
    });
    LOG("WEBHOOK_ECOSYSTEM_ORDER_PAYMENT_PROCESSED", {
      paymentId: payment.id,
      reference,
    });
  } catch (error) {
    LOG("WEBHOOK_ECOSYSTEM_ORDER_PAYMENT_ERROR", {
      message: error.message,
      stack: error.stack,
    });
  }
}

async function handleWalletFunding(data) {
   const { amount, metadata, reference, status } = data;
   if (status !== "success") return;
   
   const nairaAmount = amount / 100;
   const { target, vendor_id, role } = metadata;
   
   if (!vendor_id) {
      console.error("Vendor ID missing from metadata for wallet funding");
      return;
   }
   
   try {
      if (target === "ecosystem") {
         await fundEcosystemWallet(nairaAmount, reference, vendor_id);
      } else {
         let wallet = await getWalletByOwner(vendor_id, role || 'institution');
         if (!wallet) {
            wallet = await createWallet(vendor_id, role || 'institution');
         }
         await fundPersonalWallet(wallet.id, nairaAmount, reference);
      }
      LOG("WEBHOOK_WALLET_FUNDING_PROCESSED", { target, vendor_id, amount: nairaAmount, reference });
   } catch (error) {
      console.error("Error processing wallet funding:", error);
      throw error;
   }
}

export {
  handleSubscriptionCreated,
  handleChargeSuccess,
  // handleLoanRepayment,
  handleSubscriptionDisabled,
  handleSubscriptionNotRenew,
  handleInvoiceCreated,
  handleInvoicePaymentFailed,
  handleInvoiceUpdate,
  handleAggregatorEscrow,
  handleEcosystemOrderPayment,
};
