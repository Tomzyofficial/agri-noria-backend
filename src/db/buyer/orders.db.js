import pool from "../../lib/connect.js";

// Create a new order
export async function createOrder(orderData) {
  const {
    buyer_id,
    total_amount,
    currency,
    country_code,
    status = "pending",
    fulfillment_type = "delivery",
    delivery_address,
    notes,
    metadata = {},
  } = orderData;

  const query = `
    INSERT INTO orders (
      buyer_id, total_amount, currency, country_Code, status,
      fulfillment_type, delivery_address, notes, metadata
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING *
  `;

  const values = [
    buyer_id,
    total_amount,
    currency,
    country_code,
    status,
    fulfillment_type,
    delivery_address,
    notes,
    JSON.stringify(metadata),
  ];

  const result = await pool.query(query, values);
  return result.rows[0];
}

// export async function getOrderById(orderId, buyerId) {
//   const query = `
//     SELECT o.id, o.status, o.delivery_address, o.metadata, ls.assigned_driver_name, ls.assigned_driver_phone
//     FROM orders o
//     LEFT JOIN logistics_shipments ls ON o.id = ls.order_id
//     WHERE o.id = $1 AND o.buyer_id = $2
//   `;

//   const result = await pool.query(query, [orderId, buyerId]);
//   return result.rows[0];
// }

// Get orders by buyer ID
export async function getOrdersByBuyerId(
  buyerId,
  { status, limit = 50, offset = 0 },
) {
  const params = [buyerId];
  let statusClause = "";

  if (status) {
    params.push(status);
    statusClause = ` AND o.status = $${params.length}`;
  }
  params.push(limit, offset);
  const limitIdx = params.length - 1;
  const offsetIdx = params.length;
  const query = `
   SELECT o.id, o.currency, o.country_code, o.status, o.delivery_address, o.metadata, o.created_at, ls.assigned_driver_name, ls.assigned_driver_phone FROM orders AS o
   LEFT JOIN logistics_shipments ls ON o.id = ls.order_id WHERE o.buyer_id = $1
   ${statusClause}
    ORDER BY o.created_at DESC LIMIT $${limitIdx} OFFSET $${offsetIdx}`;

  const result = await pool.query(query, params);
  return result.rows;
}

// Get orders by seller ID
export async function getOrdersBySellerId(
  sellerId,
  { status, limit = 50, offset = 0 },
) {
  const params = [sellerId];
  let statusClause = "";

  if (status) {
    params.push(status);
    statusClause = ` AND o.status = $${params.length}`;
  }

  params.push(limit, offset);
  const limitIdx = params.length - 1;
  const offsetIdx = params.length;

  const query = `
  SELECT o.id, o.currency, o.country_code, o.status, o.delivery_address, o.created_at, ls.assigned_driver_name, ls.assigned_driver_phone FROM orders o LEFT JOIN logistics_shipments ls ON o.id = ls.order_id
   WHERE o.metadata->'seller_breakdown' @> jsonb_build_array(
    jsonb_build_object('seller_id', $1::text))
   ${statusClause}
   ORDER BY o.created_at DESC
   LIMIT $${limitIdx} OFFSET $${offsetIdx}
  `;
  const result = await pool.query(query, params);
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
    SELECT country_code, currency,
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
    WHERE metadata->'seller_breakdown' @> jsonb_build_array(
    jsonb_build_object('seller_id', $1::text))
    GROUP BY 
      country_code,
      currency
  `;

  // date_trunc function used to return the first ocurrance of the precision (month in this case)
  const metric = `SELECT SUM(CASE WHEN created_at >= date_trunc('month', CURRENT_DATE)
   THEN (metadata->'amount_breakdown'->>'subtotal')::numeric ELSE 0 END) AS current_month_sales,
  SUM(CASE WHEN created_at >= date_trunc('month', CURRENT_DATE - INTERVAL '1 month')
   AND created_at < date_trunc('month', CURRENT_DATE)
   THEN (metadata->'amount_breakdown'->>'subtotal')::numeric ELSE 0 END) AS previous_month_sales
   FROM orders
   WHERE metadata->'seller_breakdown' @> jsonb_build_array(
    jsonb_build_object('seller_id', $1::text));`;

  const activeBuyers = `
    SELECT 
      COUNT(DISTINCT buyer_id) as active_buyers
    FROM orders
    WHERE metadata->'seller_breakdown' @> jsonb_build_array(
    jsonb_build_object('seller_id', $1::text))
  `;

  const totalOrders = `SELECT COUNT(*) as total_orders FROM orders WHERE metadata->'seller_breakdown' @> jsonb_build_array(
    jsonb_build_object('seller_id', $1::text))`;

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
      country_code, currency,
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
     country_code, currency
  `;

  const result = await pool.query(query, [buyerId]);
  return result.rows[0];
}
