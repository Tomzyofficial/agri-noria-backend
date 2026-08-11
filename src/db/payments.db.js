import pool from "../lib/connect.js";

// Create a new payment record
export async function createPayment(paymentData) {
  const {
    order_id,
    payer_id,
    amount,
    currency = "NGN",
    payment_provider,
    provider_reference,
    provider_payment_code,
    status,
    escrow_status,
    payment_method,
    metadata = {},
  } = paymentData;

  const query = `
    INSERT INTO payments (
      order_id, payer_id, amount, currency, payment_provider,
      provider_reference, provider_payment_code, status,
      escrow_status, payment_method, metadata
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    RETURNING *
  `;

  const values = [
    order_id,
    payer_id,
    amount,
    currency,
    payment_provider,
    provider_reference,
    provider_payment_code,
    status,
    escrow_status,
    payment_method,
    JSON.stringify(metadata),
  ];

  const result = await pool.query(query, values);
  return result.rows[0];
}

// Get payment by ID
// export async function getPaymentById(paymentId) {
//   const query = `
//     SELECT
//       p.*,
//       o.buyer_id,
//       o.seller_id,
//       o.total_amount as order_amount,
//       o.status as order_status
//     FROM payments p
//     LEFT JOIN orders o ON p.order_id = o.id
//     WHERE p.id = $1
//   `;

//   const result = await pool.query(query, [paymentId]);
//   return result.rows[0];
// }

// Get payment by order ID
export async function getPaymentByOrderId(orderId) {
  const query = `
    SELECT * FROM payments
    WHERE order_id = $1
    ORDER BY created_at DESC
    LIMIT 1
  `;

  const result = await pool.query(query, [orderId]);
  return result.rows[0];
}

// Get payment by provider reference
export async function getPaymentByReference(reference) {
  const query = `
    SELECT * FROM payments
    WHERE provider_reference = $1
  `;

  const result = await pool.query(query, [reference]);
  return result.rows[0];
}

// Update payment status
export async function updatePaymentStatus(
  paymentId,
  status,
  providerData = {},
) {
  const { provider_reference, provider_payment_code, metadata } = providerData;

  const query = `
    UPDATE payments
    SET 
      status = $1,
      provider_reference = COALESCE($2, provider_reference),
      provider_payment_code = COALESCE($3, provider_payment_code),
      metadata = COALESCE($4, metadata)::jsonb,
      updated_at = NOW()
    WHERE id = $5
    RETURNING *
  `;

  const result = await pool.query(query, [
    status,
    provider_reference,
    provider_payment_code,
    metadata ? JSON.stringify(metadata) : null,
    paymentId,
  ]);
  return result.rows[0];
}

// Update payment escrow status
// export async function updateEscrowStatus(
//   paymentId,
//   escrowStatus,
//   releaseReason = null,
// ) {
//   const query = `
//     UPDATE payments
//     SET
//       escrow_status = $1,
//       released_at = CASE WHEN $1 = 'released' THEN NOW() ELSE released_at END,
//       release_reason = $2,
//       updated_at = NOW()
//     WHERE id = $3
//     RETURNING *
//   `;

//   const result = await pool.query(query, [
//     escrowStatus,
//     releaseReason,
//     paymentId,
//   ]);
//   return result.rows[0];
// }

// Get payments by payer ID
// export async function getPaymentsByPayerId(payerId, limit = 50, offset = 0) {
//   const query = `
//     SELECT
//       p.*,
//       o.total_amount as order_amount,
//       o.status as order_status,
//       v.fname as seller_fname,
//       v.lname as seller_lname
//     FROM payments p
//     LEFT JOIN orders o ON p.order_id = o.id
//     LEFT JOIN vendors v ON o.seller_id = v.id
//     WHERE p.payer_id = $1
//     ORDER BY p.created_at DESC
//     LIMIT $2 OFFSET $3
//   `;

//   const result = await pool.query(query, [payerId, limit, offset]);
//   return result.rows;
// }

// Get payments by seller ID (through orders)
// export async function getPaymentsBySellerId(sellerId, limit = 50, offset = 0) {
//   const query = `
//     SELECT
//       p.*,
//       o.total_amount as order_amount,
//       o.status as order_status,
//       b.email as buyer_email,
//       b.name as buyer_name
//     FROM payments p
//     LEFT JOIN orders o ON p.order_id = o.id
//     LEFT JOIN buyers b ON o.buyer_id = b.buyer_id
//     WHERE o.seller_id = $1
//     ORDER BY p.created_at DESC
//     LIMIT $2 OFFSET $3
//   `;

//   const result = await pool.query(query, [sellerId, limit, offset]);
//   return result.rows;
// }

// Get payments with held escrow (for auto-release check)
// export async function getHeldEscrowPayments() {
//   const query = `
//     SELECT
//       p.*,
//       o.status as order_status,
//       o.updated_at as order_updated_at
//     FROM payments p
//     LEFT JOIN orders o ON p.order_id = o.id
//     WHERE p.escrow_status = 'held'
//     AND o.status = 'delivered'
//     AND o.updated_at < NOW() - INTERVAL '7 days'
//   `;

//   const result = await pool.query(query);
//   return result.rows;
// }

// Refund payment
// export async function refundPayment(paymentId, reason) {
//   const query = `
//     UPDATE payments
//     SET
//       status = 'refunded',
//       escrow_status = 'refunded',
//       release_reason = $1,
//       updated_at = NOW()
//     WHERE id = $2
//     RETURNING *
//   `;

//   const result = await pool.query(query, [reason, paymentId]);
//   return result.rows[0];
// }

// Get payment statistics for seller
// export async function getSellerPaymentStats(sellerId) {
//   const query = `
//     SELECT
//       COUNT(*) as total_payments,
//       COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_payments,
//       COUNT(CASE WHEN escrow_status = 'held' THEN 1 END) as held_escrow,
//       COUNT(CASE WHEN escrow_status = 'released' THEN 1 END) as released_escrow,
//       COALESCE(SUM(CASE WHEN escrow_status = 'released' THEN amount ELSE 0 END), 0) as total_released,
//       COALESCE(SUM(CASE WHEN escrow_status = 'held' THEN amount ELSE 0 END), 0) as pending_release
//     FROM payments p
//     LEFT JOIN orders o ON p.order_id = o.id
//     WHERE o.seller_id = $1
//   `;

//   const result = await pool.query(query, [sellerId]);
//   return result.rows[0];
// }

// Get payment statistics for buyer
// export async function getPayerPaymentStats(payerId) {
//   const query = `
//     SELECT
//       COUNT(*) as total_payments,
//       COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_payments,
//       COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_payments,
//       COUNT(CASE WHEN escrow_status = 'held' THEN 1 END) as held_escrow,
//       COUNT(CASE WHEN escrow_status = 'released' THEN 1 END) as released_escrow,
//       COALESCE(SUM(amount), 0) as total_paid
//     FROM payments
//     WHERE payer_id = $1
//   `;

//   const result = await pool.query(query, [payerId]);
//   return result.rows[0];
// }
