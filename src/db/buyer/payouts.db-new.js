// Adjust this import path to match your project structure
// (you're using plain `pg`, so this should export a configured `pg` Pool).
import pool from "../../lib/connect.js";

/**
 * Locks the order row so a manual "verify" click and the periodic auto-release
 * job can't both process the same order at once. Must be called inside a
 * transaction (client from pool.connect(), not the pool itself).
 *
 * Returns null if the order doesn't exist or isn't in a releasable state.
 */
export async function lockOrderForRelease(client, orderId) {
  const { rows } = await client.query(
    `SELECT id, status, updated_at
     FROM orders
     WHERE id = $1
     FOR UPDATE`,
    [orderId],
  );

  const order = rows[0];
  if (!order) return null;
  if (order.status !== "Delivered") return null; // already Completed, or not yet Delivered

  return order;
}

/**
 * Locks and returns payouts for this order that still need action
 * (pending = never attempted, failed = attempted and bounced, eligible for retry).
 * Payouts already `processing` are excluded — a webhook is still expected for those.
 * Payouts already `completed` are excluded — nothing to do.
 */
export async function lockPendingOrFailedPayouts(client, orderId) {
  const { rows } = await client.query(
    `SELECT
       p.id, p.order_id, p.recipient_vendor_id, p.net_amount, p.currency, p.status,
       vba.account_name, vba.account_number, vba.bank_code,
       vba.paystack_recipient_code, vba.id AS bank_account_id
     FROM payouts p
     JOIN vendor_bank_accounts vba ON vba.vendor_id = p.recipient_vendor_id
     WHERE p.order_id = $1
       AND p.status IN ('pending', 'failed')
     FOR UPDATE OF p`,
    [orderId],
  );

  return rows;
}

/** Checks whether an order currently has ANY payouts that are not yet completed. */
export async function hasIncompletePayouts(client, orderId) {
  const { rows } = await client.query(
    `SELECT 1 FROM payouts WHERE order_id = $1 AND status != 'completed' LIMIT 1`,
    [orderId],
  );
  return rows.length > 0;
}

/** Caches a newly-created Paystack recipient_code so we never recreate it. */
export async function saveRecipientCode(client, bankAccountId, recipientCode) {
  await client.query(
    `UPDATE vendor_bank_accounts SET paystack_recipient_code = $2 WHERE id = $1`,
    [bankAccountId, recipientCode],
  );
}

/** Marks a payout as in-flight after the bulk transfer call has accepted it. */
export async function markPayoutProcessing(
  client,
  payoutId,
  { reference, transferResponse },
) {
  await client.query(
    `UPDATE payouts
     SET status = 'processing',
         transfer_reference = $2,
         transfer_response = $3::jsonb,
         updated_at = NOW()
     WHERE id = $1`,
    [payoutId, reference, JSON.stringify(transferResponse)],
  );
}

/** Marks a payout as failed immediately (e.g. bulk call rejected it synchronously). */
export async function markPayoutFailedImmediate(
  client,
  payoutId,
  { reference, failureReason, transferResponse },
) {
  await client.query(
    `UPDATE payouts
     SET status = 'failed',
         transfer_reference = COALESCE($2, transfer_reference),
         failure_reason = $3,
         transfer_response = $4::jsonb,
         updated_at = NOW()
     WHERE id = $1`,
    [
      payoutId,
      reference,
      failureReason,
      JSON.stringify(transferResponse || {}),
    ],
  );
}

/** Called from the webhook handler once Paystack confirms a transfer succeeded. */
export async function markPayoutCompletedByReference(
  client,
  reference,
  transferResponse,
) {
  const { rows } = await client.query(
    `UPDATE payouts
     SET status = 'completed',
         released_at = NOW(),
         transfer_response = $2::jsonb,
         updated_at = NOW()
     WHERE transfer_reference = $1
     RETURNING id, order_id`,
    [reference, JSON.stringify(transferResponse)],
  );
  return rows[0] || null;
}

/** Called from the webhook handler once Paystack confirms a transfer failed/reversed. */
export async function markPayoutFailedByReference(
  client,
  reference,
  { failureReason, transferResponse },
) {
  const { rows } = await client.query(
    `UPDATE payouts
     SET status = 'failed',
         failure_reason = $2,
         transfer_response = $3::jsonb,
         updated_at = NOW()
     WHERE transfer_reference = $1
     RETURNING id, order_id`,
    [reference, failureReason, JSON.stringify(transferResponse)],
  );
  return rows[0] || null;
}

export async function markOrderCompleted(client, orderId) {
  await client.query(
    `UPDATE orders SET status = 'Completed', updated_at = NOW() WHERE id = $1`,
    [orderId],
  );
}

/**
 * Orders eligible for the periodic job:
 *  - Delivered more than 24h ago and never actioned, OR
 *  - Delivered, already attempted, and still have pending/failed payouts (retry).
 */
export async function findOrdersEligibleForAutoRelease() {
  const { rows } = await pool.query(
    `SELECT DISTINCT o.id
     FROM orders o
     WHERE o.status = 'Delivered'
       AND (
         o.updated_at < NOW() - INTERVAL '24 hours'
         OR EXISTS (
           SELECT 1 FROM payouts p
           WHERE p.order_id = o.id AND p.status IN ('pending', 'failed')
         )
       )`,
  );
  return rows.map((r) => r.id);
}
