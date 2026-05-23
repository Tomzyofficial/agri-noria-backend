import pool from "../../lib/connect.js";

// Create a new order
export async function createOrder(orderData) {
  const {
    buyer_id,
    seller_id,
    total_amount,
    currency,
    status = "pending",
    fulfillment_type = "delivery",
    delivery_address,
    delivery_fee = 0,
    estimated_delivery_time,
    notes,
    metadata = {},
  } = orderData;

  const query = `
    INSERT INTO orders (
      buyer_id, seller_id, total_amount, currency, status,
      fulfillment_type, delivery_address, delivery_fee,
      estimated_delivery_time, notes, metadata
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    RETURNING *
  `;

  const values = [
    buyer_id,
    seller_id,
    total_amount,
    currency,
    status,
    fulfillment_type,
    delivery_address,
    delivery_fee,
    estimated_delivery_time,
    notes,
    JSON.stringify(metadata),
  ];

  const result = await pool.query(query, values);
  return result.rows[0];
}

// Get order by ID
export async function getOrderById(orderId, buyerId) {
  const query = `
    SELECT *
    FROM orders WHERE id = $1 AND buyer_id = $2
  `;

  const result = await pool.query(query, [orderId, buyerId]);
  return result.rows[0];
}

// Get orders by buyer ID
export async function getOrdersByBuyerId(buyerId, limit = 50, offset = 0) {
  const query = `
    SELECT * FROM orders WHERE buyer_id = $1
    ORDER BY created_at DESC
    LIMIT $2 OFFSET $3
  `;

  const result = await pool.query(query, [buyerId, limit, offset]);
  //   console.log("result", result.rows);
  return result.rows;
}

// Get orders by seller ID
export async function getOrdersBySellerId(sellerId, limit = 50, offset = 0) {
  const query = `
    SELECT 
      o.*,
      b.email as buyer_email,
      b.name as buyer_name
    FROM orders o
    LEFT JOIN buyers b ON o.buyer_id = b.buyer_id
    WHERE o.seller_id = $1
    ORDER BY o.created_at DESC
    LIMIT $2 OFFSET $3
  `;

  const result = await pool.query(query, [sellerId, limit, offset]);
  return result.rows;
}

// Update order status
export async function updateOrderStatus(orderId, status) {
  const query = `
    UPDATE orders
    SET status = $1, updated_at = NOW()
    WHERE id = $2
    RETURNING *
  `;

  const result = await pool.query(query, [status, orderId]);
  return result.rows[0];
}

// Update order with delivery confirmation
export async function updateOrderDelivery(orderId, deliveryData) {
  const { actual_delivery_time, notes } = deliveryData;

  const query = `
    UPDATE orders
    SET 
      status = 'delivered',
      actual_delivery_time = COALESCE($1, NOW()),
      notes = COALESCE($2, notes),
      updated_at = NOW()
    WHERE id = $3
    RETURNING *
  `;

  const result = await pool.query(query, [
    actual_delivery_time,
    notes,
    orderId,
  ]);
  return result.rows[0];
}

// Get order with items
/* export async function getOrderWithItems(orderId) {
  const orderQuery = `
    SELECT 
      o.*,
      b.email as buyer_email,
      b.name as buyer_name,
      b.phone as buyer_phone,
      v.fname as seller_fname,
      v.lname as seller_lname,
      v.email as seller_email,
      v.phone as seller_phone
    FROM orders o
    LEFT JOIN buyers b ON o.buyer_id = b.buyer_id
    LEFT JOIN vendors v ON o.seller_id = v.id
    WHERE o.id = $1
  `;

  const itemsQuery = `
    SELECT * FROM order_items
    WHERE order_id = $1
    ORDER BY created_at
  `;

  const [orderResult, itemsResult] = await Promise.all([
    pool.query(orderQuery, [orderId]),
    pool.query(itemsQuery, [orderId]),
  ]);

  return {
    order: orderResult.rows[0],
    items: itemsResult.rows,
  };
} */

// Create order items
/* export async function createOrderItems(orderId, items) {
  const query = `
    INSERT INTO order_items (
      order_id, product_id, quantity, unit_price,
      packaging_type, unit_measure, product_name, product_image
    ) VALUES ${items.map((_, i) => `($1, $${i * 8 + 2}, $${i * 8 + 3}, $${i * 8 + 4}, $${i * 8 + 5}, $${i * 8 + 6}, $${i * 8 + 7}, $${i * 8 + 8})`).join(", ")}
    RETURNING *
  `;

  const values = [
    orderId,
    ...items.flatMap((item) => [
      item.product_id,
      item.quantity,
      item.unit_price,
      item.packaging_type,
      item.unit_measure,
      item.product_name,
      item.product_image,
    ]),
  ];

  const result = await pool.query(query, values);
  return result.rows;
} */

// Delete order (soft delete by updating status) by logistics vendor
export async function cancelOrder(orderId, reason) {
  const query = `
    UPDATE orders
    SET 
      status = 'cancelled',
      notes = COALESCE($1, notes),
      updated_at = NOW()
    WHERE id = $2 AND status NOT IN ('completed', 'delivered')
    RETURNING *
  `;

  const result = await pool.query(query, [reason, orderId]);
  return result.rows[0];
}

// Get order statistics for seller
export async function getSellerOrderStats(sellerId) {
  const query = `
    SELECT 
      COUNT(*) as total_orders,
      COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_orders,
      COUNT(CASE WHEN status = 'paid' THEN 1 END) as paid_orders,
      COUNT(CASE WHEN status = 'processing' THEN 1 END) as processing_orders,
      COUNT(CASE WHEN status = 'shipped' THEN 1 END) as shipped_orders,
      COUNT(CASE WHEN status = 'in_transit' THEN 1 END) as in_transit_orders,
      COUNT(CASE WHEN status = 'delivered' THEN 1 END) as delivered_orders,
      COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_orders,
      COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_orders,
      COALESCE(SUM(CASE WHEN status = 'completed' THEN total_amount ELSE 0 END), 0) as total_revenue
    FROM orders
    WHERE seller_id = $1
  `;

  const result = await pool.query(query, [sellerId]);
  return result.rows[0];
}

// Get order statistics for buyer
export async function getBuyerOrderStats(buyerId) {
  const query = `
    SELECT 
      metadata->'item_breakdown'->0->>'country_code' AS country_code,
      metadata->'item_breakdown'->0->>'currency' AS currency,
      COUNT(*) as total_orders,
      COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_orders,
      COUNT(CASE WHEN status = 'in_transit' THEN 1 END) as in_transit_orders,
      COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_orders,
      COUNT(CASE WHEN status = 'refunded' THEN 1 END) as refunded_orders,
      COALESCE(SUM(total_amount), 0) as total_spent
    FROM orders
    WHERE buyer_id = $1 GROUP BY
    metadata->'item_breakdown'->0->>'country_code',
    metadata->'item_breakdown'->0->>'currency'
  `;

  const result = await pool.query(query, [buyerId]);
  return result.rows[0];
}
