import pool from "../../lib/connect.js";

export async function getSubPlans() {
   const { rows } = await pool.query(
      `SELECT id, plan_name, billing_cycle, amount, currency, features, popular
     FROM subscription_plans`,
   );
   return rows;
}

export async function getPlanCode(planId) {
   if (!planId) throw new Error("planId is required");

   const { rows } = await pool.query("SELECT paystack_plan_code FROM subscription_plans WHERE id = $1", [planId]);

   return rows[0]?.paystack_plan_code ?? null;
}

/* -------------------- SUBSCRIPTIONS -------------------- */

export async function upsertVendorSubscription(payload) {
   const {
      vendor_id,
      plan_id,
      status,
      current_period_start,
      current_period_end,
      created_at,
      paystack_authorization_code,
      paystack_customer_code,
      last4,
      card_type,
      card_expires_month,
      card_expires_year,
      paystack_reference,
   } = payload;

   if (!vendor_id || !plan_id) {
      throw new Error("vendor_id and plan_id are required");
   }

   const { rows } = await pool.query(
      `
    INSERT INTO vendor_subscriptions (
      vendor_id,
      plan_id,
      status,
      current_period_start,
      current_period_end,
      created_at,
      last4,
      card_type,
      card_expires_month,
      card_expires_year,
      paystack_authorization_code,
      paystack_customer_code,
      paystack_reference
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    ON CONFLICT (vendor_id) DO UPDATE SET
      plan_id = EXCLUDED.plan_id,
      status = EXCLUDED.status,
      current_period_start = COALESCE(EXCLUDED.current_period_start, vendor_subscriptions.current_period_start),
      current_period_end = COALESCE(EXCLUDED.current_period_end, vendor_subscriptions.current_period_end),
      created_at = COALESCE(EXCLUDED.created_at, vendor_subscriptions.created_at),
      last4 = COALESCE(EXCLUDED.last4, vendor_subscriptions.last4),
      card_type = COALESCE(EXCLUDED.card_type, vendor_subscriptions.card_type),
      card_expires_month = COALESCE(EXCLUDED.card_expires_month, vendor_subscriptions.card_expires_month),
      card_expires_year = COALESCE(EXCLUDED.card_expires_year, vendor_subscriptions.card_expires_year),
      paystack_authorization_code = COALESCE(EXCLUDED.paystack_authorization_code, vendor_subscriptions.paystack_authorization_code),
      paystack_customer_code = COALESCE(EXCLUDED.paystack_customer_code, vendor_subscriptions.paystack_customer_code),
      paystack_reference = COALESCE(EXCLUDED.paystack_reference, vendor_subscriptions.paystack_reference),
      updated_at = NOW()
    RETURNING *
    `,
      [
         vendor_id,
         plan_id,
         status,
         current_period_start,
         current_period_end,
         created_at,
         last4,
         card_type,
         card_expires_month,
         card_expires_year,
         paystack_authorization_code,
         paystack_customer_code,
         paystack_reference,
      ],
   );
   return rows[0];
}

export async function getVendorSubscription(vendorId) {
   const { rows } = await pool.query(
      `
    SELECT vs.plan_id, vs.last4, vs.paystack_subscription_code, vs.card_type, vs.card_expires_month, vs.card_expires_year, vs.card_account_name, vs.status, sp.plan_name, sp.amount, si.amount AS vendor_sub_amount
    FROM vendor_subscriptions vs
    JOIN subscription_invoices si ON si.paystack_reference = vs.paystack_reference
    JOIN subscription_plans sp ON sp.id = vs.plan_id
    WHERE vs.vendor_id = $1 
    `,
      [vendorId],
   );
   return rows[0] ?? null;
}

/* -------------------- TRANSACTIONS -------------------- */

export async function storePendingSubscription(reference, vendorId, planId, interval, email, amount, planName) {
   const metadata = { vendorId, planId, interval, planName };

   const { rows } = await pool.query(
      `
    INSERT INTO transactions (reference, vendor_id, amount, email, status, metadata)
    VALUES ($1,$2,$3,$4,'pending',$5::jsonb)
    ON CONFLICT (reference)
    DO UPDATE SET metadata = EXCLUDED.metadata RETURNING *
    `,
      [reference, vendorId, amount, email, JSON.stringify(metadata)],
   );

   return rows[0];
}

export async function getRecentTransactionByRef(reference) {
   if (!reference) return null;

   const { rows } = await pool.query(
      "SELECT id, vendor_id, metadata, amount, created_at FROM transactions WHERE reference = $1",
      [reference],
   );

   if (!rows[0]) return null;

   const meta = rows[0].metadata || {};

   return {
      id: rows[0].id,
      vendorId: meta.vendorId ?? rows[0].vendor_id,
      planId: meta.planId,
      interval: meta.interval,
      planName: meta.planName,
      amount: rows[0].amount,
      created_at: rows[0].created_at,
   };
}

export async function markTransactionComplete(reference) {
   await pool.query(`UPDATE transactions SET status = 'success' WHERE reference = $1`, [reference]);
}

/* -------------------- INVOICES -------------------- */

export async function upsertSubscriptionInvoice(payload) {
   const {
      vendor_id,
      subscription_id,
      amount,
      status,
      paystack_reference,
      period_start,
      period_end,
      paid_at,
      created_at,
   } = payload;

   if (!vendor_id || !subscription_id) return;

   await pool.query(
      `
    INSERT INTO subscription_invoices (
      vendor_id, subscription_id, amount, status,
      paystack_reference, period_start, period_end, paid_at, created_at
    )
    VALUES ($1, $2, $3, 'paid', $4, $5, $6, $7, $8, $9)
    ON CONFLICT (paystack_reference) DO NOTHING`,
      [vendor_id, subscription_id, amount, status, paystack_reference, period_start, period_end, paid_at, created_at],
   );
}

/* export async function cancelVendorSubscription(vendorId, reason = null) {
   const { rows } = await pool.query(
      `UPDATE vendor_subscriptions SET status = 'cancelled', cancelled_at = NOW(), cancellation_reason = $1, updated_at = NOW()
       WHERE vendor_id = $2 RETURNING *`,
      [reason, vendorId],
   );
   return rows[0] || null;
} */

/* export async function updateSubscriptionStatus(vendorId, status, metadata = {}) {
   const updates = ["status = $1", "updated_at = NOW()"];
   const values = [status, vendorId];
   let paramIndex = 3;

   if (metadata.cancelled_at) {
      updates.push(`cancelled_at = $${paramIndex++}`);
      values.push(metadata.cancelled_at);
   }
   if (metadata.will_not_renew_at) {
      updates.push(`will_not_renew_at = $${paramIndex++}`);
      values.push(metadata.will_not_renew_at);
   }
   if (metadata.card_expiring_at) {
      updates.push(`card_expiring_at = $${paramIndex++}`);
      values.push(metadata.card_expiring_at);
   }
   if (metadata.card_expires_month) {
      updates.push(`card_expires_month = $${paramIndex++}`);
      values.push(metadata.card_expires_month);
   }
   if (metadata.card_expires_year) {
      updates.push(`card_expires_year = $${paramIndex++}`);
      values.push(metadata.card_expires_year);
   }

   const { rows } = await pool.query(
      `UPDATE vendor_subscriptions SET ${updates.join(", ")} WHERE vendor_id = $2 RETURNING *`,
      values,
   );
   return rows[0] || null;
} */

/* export async function getSubscriptionByPaystackCodes(customerCode, subscriptionCode = null) {
   let query = `SELECT vs.*, sp.plan_name, sp.billing_cycle, sp.amount, sp.currency, sp.features
               FROM vendor_subscriptions vs
               JOIN subscription_plans sp ON sp.id = vs.plan_id
               WHERE vs.paystack_customer_code = $1`;
   const params = [customerCode];

   if (subscriptionCode) {
      query += ` AND vs.paystack_subscription_code = $2`;
      params.push(subscriptionCode);
   }

   const { rows } = await pool.query(query, params);
   return rows[0] || null;
} */

/* export async function getSubscriptionInvoices(vendorId, status = null) {
   let query = `SELECT si.*, vs.plan_id, sp.plan_name
               FROM subscription_invoices si
               JOIN vendor_subscriptions vs ON vs.id = si.subscription_id
               JOIN subscription_plans sp ON sp.id = vs.plan_id
               WHERE si.vendor_id = $1`;
   const params = [vendorId];

   if (status) {
      query += ` AND si.status = $2`;
      params.push(status);
   }

   query += ` ORDER BY si.created_at DESC`;

   const { rows } = await pool.query(query, params);
   return rows;
} */

/* export async function updateSubscriptionPlan(vendorId, newPlanId, effectiveDate = null) {
   const updates = ["plan_id = $1", "updated_at = NOW()"];
   const values = [newPlanId, vendorId];

   if (effectiveDate) {
      updates.push(`plan_change_effective_date = $3`);
      updates.push(`pending_plan_id = $1`);
      values.push(effectiveDate);
   }

   const { rows } = await pool.query(
      `UPDATE vendor_subscriptions SET ${updates.join(", ")} WHERE vendor_id = $2 RETURNING *`,
      values,
   );
   return rows[0] || null;
}
 */
