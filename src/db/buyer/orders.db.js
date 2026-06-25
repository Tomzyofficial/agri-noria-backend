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
    SELECT o.id, o.status, o.delivery_address, o.metadata, ls.assigned_driver_name, ls.assigned_driver_phone
    FROM orders o
    LEFT JOIN logistics_shipments ls ON o.id = ls.order_id
    WHERE o.id = $1 AND o.buyer_id = $2
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

// Delete order (soft delete by updating status) by logistics vendor
// export async function cancelOrder(orderId, reason) {
//   const query = `
//     UPDATE orders SET status = 'cancelled', notes = COALESCE($1, notes), updated_at = NOW()
//     WHERE id = $2 AND status NOT IN ('completed', 'delivered') RETURNING *`;
//   const result = await pool.query(query, [reason, orderId]);
//   return result.rows[0];
// }

// Get order statistics for seller/farmer
export async function getSellerOrderStats(sellerId) {
  const statsQuery = `
    SELECT metadata->'item_breakdown'->0->>'country_code' AS country_code,
      metadata->'item_breakdown'->0->>'currency' AS currency,
      COUNT(*) as total_orders,
      COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_orders,
      COUNT(CASE WHEN status = 'paid' THEN 1 END) as paid_orders,
      COUNT(CASE WHEN status = 'processing' THEN 1 END) as processing_orders,
      COUNT(CASE WHEN status = 'shipped' THEN 1 END) as shipped_orders,
      COUNT(CASE WHEN status = 'in_transit' THEN 1 END) as in_transit_orders,
      COUNT(CASE WHEN status = 'delivered' THEN 1 END) as delivered_orders,
      COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_orders,
      COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_orders,
      COALESCE(SUM(CASE WHEN status = 'delivered' THEN (metadata->'amount_breakdown'->>'subtotal')::numeric ELSE 0 END), 0) as total_revenue
    FROM orders
    WHERE seller_id = $1
    GROUP BY 
      metadata->'item_breakdown'->0->>'country_code',
      metadata->'item_breakdown'->0->>'currency'
  `;

  // date_trunc function used to return the first ocurrance of the precision (month in this case)
  const metric = `SELECT SUM(CASE WHEN created_at >= date_trunc('month', CURRENT_DATE)
   THEN (metadata->'amount_breakdown'->>'subtotal')::numeric ELSE 0 END) AS current_month_sales,
  SUM(CASE WHEN created_at >= date_trunc('month', CURRENT_DATE - INTERVAL '1 month')
   AND created_at < date_trunc('month', CURRENT_DATE)
   THEN (metadata->'amount_breakdown'->>'subtotal')::numeric ELSE 0 END) AS previous_month_sales
   FROM orders
   WHERE seller_id = $1;`;

  const activeBuyers = `
    SELECT 
      COUNT(DISTINCT buyer_id) as active_buyers
    FROM orders
    WHERE seller_id = $1
  `;

  const totalOrders = `SELECT COUNT(*) as total_orders FROM orders WHERE seller_id = $1`;

  const [statsResult, metricResult, activeBuyersResult, totalOrdersResult] =
    await Promise.all([
      pool.query(statsQuery, [sellerId]),
      pool.query(metric, [sellerId]),
      pool.query(activeBuyers, [sellerId]),
      pool.query(totalOrders, [sellerId]),
    ]);
  return {
    ...statsResult.rows[0],
    active_buyers: activeBuyersResult.rows[0].active_buyers,
    current_month_sales: metricResult.rows[0].current_month_sales,
    previous_month_sales: metricResult.rows[0].previous_month_sales,
    total_orders: totalOrdersResult.rows[0].total_orders,
  };
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
      COUNT(CASE WHEN status = 'paid' THEN 1 END) as paid_orders,
      COUNT(CASE WHEN status = 'delivered' THEN 1 END) as delivered_orders,
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
