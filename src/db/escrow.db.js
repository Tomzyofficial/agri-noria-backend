import { pool } from '../db/connection.js';

// Create escrow release record
export async function createEscrowRelease(releaseData) {
  const {
    payment_id,
    order_id,
    status = 'pending',
    trigger_type,
    released_by,
    release_amount,
    reason,
    notes,
    metadata = {}
  } = releaseData;

  const query = `
    INSERT INTO escrow_releases (
      payment_id, order_id, status, trigger_type,
      released_by, release_amount, reason, notes, metadata
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING *
  `;

  const values = [
    payment_id,
    order_id,
    status,
    trigger_type,
    released_by,
    release_amount,
    reason,
    notes,
    JSON.stringify(metadata)
  ];

  const result = await pool.query(query, values);
  return result.rows[0];
}

// Get escrow release by ID
export async function getEscrowReleaseById(releaseId) {
  const query = `
    SELECT 
      er.*,
      p.amount as payment_amount,
      p.escrow_status as payment_escrow_status,
      o.buyer_id,
      o.seller_id,
      o.total_amount as order_amount
    FROM escrow_releases er
    LEFT JOIN payments p ON er.payment_id = p.id
    LEFT JOIN orders o ON er.order_id = o.id
    WHERE er.id = $1
  `;

  const result = await pool.query(query, [releaseId]);
  return result.rows[0];
}

// Get escrow releases by payment ID
export async function getEscrowReleasesByPaymentId(paymentId) {
  const query = `
    SELECT * FROM escrow_releases
    WHERE payment_id = $1
    ORDER BY created_at DESC
  `;

  const result = await pool.query(query, [paymentId]);
  return result.rows;
}

// Get escrow releases by order ID
export async function getEscrowReleasesByOrderId(orderId) {
  const query = `
    SELECT 
      er.*,
      p.amount as payment_amount,
      p.escrow_status as payment_escrow_status
    FROM escrow_releases er
    LEFT JOIN payments p ON er.payment_id = p.id
    WHERE er.order_id = $1
    ORDER BY created_at DESC
  `;

  const result = await pool.query(query, [orderId]);
  return result.rows;
}

// Update escrow release status
export async function updateEscrowReleaseStatus(releaseId, status, releasedAt = null) {
  const query = `
    UPDATE escrow_releases
    SET 
      status = $1,
      released_at = COALESCE($2, released_at),
      released_at = CASE WHEN $1 = 'completed' AND released_at IS NULL THEN NOW() ELSE released_at END
    WHERE id = $3
    RETURNING *
  `;

  const result = await pool.query(query, [status, releasedAt, releaseId]);
  return result.rows[0];
}

// Release escrow funds (wrapper for PostgreSQL function)
export async function releaseEscrowFunds(paymentId, triggerType, releasedBy, reason = null) {
  const query = `
    SELECT release_escrow_funds($1, $2, $3, $4) as success
  `;

  const result = await pool.query(query, [paymentId, triggerType, releasedBy, reason]);
  return result.rows[0].success;
}

// Auto-release escrow (wrapper for PostgreSQL function)
export async function autoReleaseEscrow() {
  const query = `
    SELECT auto_release_escrow() as count
  `;

  const result = await pool.query(query);
  return result.rows[0].count;
}

// Get pending escrow releases
export async function getPendingEscrowReleases(limit = 50, offset = 0) {
  const query = `
    SELECT 
      er.*,
      p.amount as payment_amount,
      o.buyer_id,
      o.seller_id,
      o.total_amount as order_amount,
      o.status as order_status,
      b.email as buyer_email,
      b.name as buyer_name,
      v.fname as seller_fname,
      v.lname as seller_lname
    FROM escrow_releases er
    LEFT JOIN payments p ON er.payment_id = p.id
    LEFT JOIN orders o ON er.order_id = o.id
    LEFT JOIN buyers b ON o.buyer_id = b.buyer_id
    LEFT JOIN vendors v ON o.seller_id = v.id
    WHERE er.status = 'pending'
    ORDER BY er.created_at DESC
    LIMIT $1 OFFSET $2
  `;

  const result = await pool.query(query, [limit, offset]);
  return result.rows;
}

// Get escrow releases by trigger type
export async function getEscrowReleasesByTriggerType(triggerType, limit = 50, offset = 0) {
  const query = `
    SELECT 
      er.*,
      p.amount as payment_amount,
      o.total_amount as order_amount,
      o.status as order_status
    FROM escrow_releases er
    LEFT JOIN payments p ON er.payment_id = p.id
    LEFT JOIN orders o ON er.order_id = o.id
    WHERE er.trigger_type = $1
    ORDER BY er.created_at DESC
    LIMIT $2 OFFSET $3
  `;

  const result = await pool.query(query, [triggerType, limit, offset]);
  return result.rows;
}

// Get escrow statistics
export async function getEscrowStats() {
  const query = `
    SELECT 
      COUNT(*) as total_releases,
      COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_releases,
      COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_releases,
      COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_releases,
      COUNT(CASE WHEN trigger_type = 'buyer_confirmed' THEN 1 END) as buyer_confirmed_releases,
      COUNT(CASE WHEN trigger_type = 'auto_release' THEN 1 END) as auto_releases,
      COUNT(CASE WHEN trigger_type = 'admin_override' THEN 1 END) as admin_overrides,
      COALESCE(SUM(release_amount), 0) as total_released_amount
    FROM escrow_releases
  `;

  const result = await pool.query(query);
  return result.rows[0];
}

// Get escrow statistics for seller
export async function getSellerEscrowStats(sellerId) {
  const query = `
    SELECT 
      COUNT(DISTINCT er.id) as total_releases,
      COUNT(CASE WHEN er.status = 'pending' THEN 1 END) as pending_releases,
      COUNT(CASE WHEN er.status = 'completed' THEN 1 END) as completed_releases,
      COALESCE(SUM(CASE WHEN er.status = 'completed' THEN er.release_amount ELSE 0 END), 0) as total_released_amount,
      COALESCE(SUM(CASE WHEN er.status = 'pending' THEN er.release_amount ELSE 0 END), 0) as pending_release_amount
    FROM escrow_releases er
    LEFT JOIN orders o ON er.order_id = o.id
    WHERE o.seller_id = $1
  `;

  const result = await pool.query(query, [sellerId]);
  return result.rows[0];
}

// Create delivery confirmation with OTP
export async function createDeliveryConfirmation(orderId, buyerId) {
  const query = `
    INSERT INTO delivery_confirmations (
      order_id, buyer_id, otp_code, otp_expires_at
    )
    SELECT 
      $1, 
      $2,
      LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0'),
      NOW() + INTERVAL '24 hours'
    WHERE NOT EXISTS (
      SELECT 1 FROM delivery_confirmations 
      WHERE order_id = $1 AND otp_expires_at > NOW()
    )
    RETURNING *
  `;

  const result = await pool.query(query, [orderId, buyerId]);
  return result.rows[0];
}

// Get delivery confirmation by order ID
export async function getDeliveryConfirmationByOrderId(orderId) {
  const query = `
    SELECT * FROM delivery_confirmations
    WHERE order_id = $1
    ORDER BY created_at DESC
    LIMIT 1
  `;

  const result = await pool.query(query, [orderId]);
  return result.rows[0];
}

// Verify delivery OTP
export async function verifyDeliveryOTP(orderId, otpCode) {
  const query = `
    UPDATE delivery_confirmations
    SET 
      confirmed = true,
      confirmation_method = 'otp',
      otp_verified_at = NOW(),
      confirmed_at = NOW()
    WHERE order_id = $1
    AND otp_code = $2
    AND otp_expires_at > NOW()
    RETURNING *
  `;

  const result = await pool.query(query, [orderId, otpCode]);
  return result.rows[0];
}

// Confirm delivery with photo proof
export async function confirmDeliveryWithPhoto(orderId, buyerId, proofImage, notes = null, conditionRating = null) {
  const query = `
    INSERT INTO delivery_confirmations (
      order_id, buyer_id, confirmed, confirmation_method,
      proof_image, proof_image_uploaded_at, confirmation_notes,
      condition_rating, confirmed_at
    ) VALUES ($1, $2, true, 'photo', $3, NOW(), $4, $5, NOW())
    ON CONFLICT (order_id) 
    DO UPDATE SET
      confirmed = true,
      confirmation_method = 'photo',
      proof_image = EXCLUDED.proof_image,
      proof_image_uploaded_at = NOW(),
      confirmation_notes = EXCLUDED.confirmation_notes,
      condition_rating = EXCLUDED.condition_rating,
      confirmed_at = NOW()
    RETURNING *
  `;

  const result = await pool.query(query, [orderId, buyerId, proofImage, notes, conditionRating]);
  return result.rows[0];
}

// Auto-confirm delivery (timeout)
export async function autoConfirmDelivery(orderId) {
  const query = `
    INSERT INTO delivery_confirmations (
      order_id, buyer_id, confirmed, confirmation_method, confirmed_at
    )
    SELECT 
      id, buyer_id, true, 'auto', NOW()
    FROM orders
    WHERE id = $1
    AND NOT EXISTS (
      SELECT 1 FROM delivery_confirmations 
      WHERE order_id = $1 AND confirmed = true
    )
    RETURNING *
  `;

  const result = await pool.query(query, [orderId]);
  return result.rows[0];
}

// Get delivery confirmation statistics
export async function getDeliveryConfirmationStats() {
  const query = `
    SELECT 
      COUNT(*) as total_confirmations,
      COUNT(CASE WHEN confirmed = true THEN 1 END) as confirmed_count,
      COUNT(CASE WHEN confirmation_method = 'otp' THEN 1 END) as otp_confirmations,
      COUNT(CASE WHEN confirmation_method = 'photo' THEN 1 END) as photo_confirmations,
      COUNT(CASE WHEN confirmation_method = 'auto' THEN 1 END) as auto_confirmations,
      AVG(condition_rating) as avg_condition_rating
    FROM delivery_confirmations
  `;

  const result = await pool.query(query);
  return result.rows[0];
}
