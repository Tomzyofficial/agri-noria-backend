import pool from "../../lib/connect.js";

export function buildSellerPayout(orderId, orderItems) {
  const payouts = new Map();

  for (const item of orderItems) {
    const sellerId = item.seller_id;

    const subtotal = item.unit_price * item.quantity;

    const qualifiesForDiscount = item.quantity >= item.min_quantity;

    const discountAmount = qualifiesForDiscount
      ? subtotal * (item.discount / 100)
      : 0;

    const sellerAmount = subtotal - discountAmount;

    if (!payouts.has(sellerId)) {
      payouts.set(sellerId, {
        order_id: orderId,
        recipient_vendor_id: sellerId,
        logistics_vendor_id: item.logistics_id,
        recipient_type: "seller",
        payout_type: "seller",
        gross_amount: sellerAmount,
        commission_amount: 0,
        net_amount: sellerAmount,
        currency: item.currency,
        //   order_items: [],
      });
    }

    //  const payout = payouts.get(sellerId);

    //  payout.gross_amount += Number(item.seller_amount);

    //  payout.commission_amount += Number(item.platform_fee ?? 0);

    //  payout.net_amount = payout.gross_amount - payout.commission_amount;

    //  payout.order_items.push({
    //    listing_id: item.listing_id,
    //    quantity: item.quantity,
    //    seller_amount: item.seller_amount,
    //  });
  }

  return [...payouts.values()];
}

export function buildLogisticsPayout(orderId, orderItems) {
  const payouts = new Map();

  for (const item of orderItems) {
    const logisticsId = item.logistics_id;

    //  const subtotal = item.unit_price * item.quantity;

    //  const qualifiesForDiscount = item.quantity >= item.min_quantity;

    //  const discountAmount = qualifiesForDiscount
    //    ? subtotal * (item.discount / 100)
    //    : 0;

    //  const sellerAmount = subtotal - discountAmount;

    if (!payouts.has(logisticsId)) {
      payouts.set(logisticsId, {
        order_id: orderId,
        recipient_vendor_id: logisticsId,
        recipient_type: "logistics",
        payout_type: "logistics",
        gross_amount: item.rate_amount,
        commission_amount: 0,
        net_amount: item.rate_amount,
        currency: item.currency,
        //   order_items: [],
      });
    }

    //  const payout = payouts.get(sellerId);

    //  payout.gross_amount += Number(item.seller_amount);

    //  payout.commission_amount += Number(item.platform_fee ?? 0);

    //  payout.net_amount = payout.gross_amount - payout.commission_amount;

    //  payout.order_items.push({
    //    listing_id: item.listing_id,
    //    quantity: item.quantity,
    //    seller_amount: item.seller_amount,
    //  });
  }

  return [...payouts.values()];
}

export async function bulkInsert({
  client,
  table,
  columns,
  records,
  returning = "*",
}) {
  if (!records || records.length === 0) {
    return [];
  }

  const values = [];
  const placeholders = [];

  records.forEach((record, rowIndex) => {
    const row = [];

    columns.forEach((column, colIndex) => {
      values.push(record[column]);
      row.push(`$${rowIndex * columns.length + colIndex + 1}`);
    });

    placeholders.push(`(${row.join(", ")})`);
  });

  const query = `
        INSERT INTO ${table}
        (${columns.join(", ")})
        VALUES
        ${placeholders.join(",\n")}
        RETURNING ${returning};
    `;

  const { rows } = await client.query(query, values);

  return rows;
}

// Create a new order
export async function createOrder(orderData) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const {
      buyer_id,
      total_amount,
      currency,
      country_code,
      status = "pending",
      fulfillment_type = "delivery",
      delivery_address,
      notes,
      metadata,
      orderItems,
    } = orderData;

    const orderQuery = `
            INSERT INTO orders (
                buyer_id,
                total_amount,
                currency,
                country_code,
                status,
                fulfillment_type,
                delivery_address,
                notes,
                metadata
            )
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
            RETURNING *;
        `;

    const { rows } = await client.query(orderQuery, [
      buyer_id,
      total_amount,
      currency,
      country_code,
      status,
      fulfillment_type,
      delivery_address,
      notes,
      metadata,
    ]);

    const order = rows[0];

    await createOrderItems(order.id, orderItems, client);
    //   create payout
    const sellerPayout = buildSellerPayout(order.id, orderItems);
    const logisticsPayout = buildLogisticsPayout(order.id, orderItems);

    await createPayout([...sellerPayout, ...logisticsPayout], client);

    await client.query("COMMIT");

    return order;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function createOrderItems(orderId, orderItems, client) {
  //   for (const item of orderItems) {
  //     await client.query(
  //       `
  //             INSERT INTO order_items (
  //                 order_id,
  //                 listing_id,
  //                 seller_id,
  //                 logistics_id,
  //                 listing_name,
  //                 product_image,
  //                 unit,
  //                 quantity,
  //                 unit_price,
  //                 subtotal,
  //                 discount,
  //                 seller_amount,
  //                 metadata
  //             )
  //             VALUES (
  //                 $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13
  //             )
  //              RETURNING *`,
  //       [
  //         orderId,
  //         item.listing_id,
  //         item.seller_id,
  //         item.logistics_id,
  //         item.listing_name,
  //         item.product_image,
  //         item.unit,
  //         item.quantity,
  //         item.unit_price ?? 0,
  //         item.subtotal ?? 0,
  //         item.discount ?? 0,
  //         item.seller_amount ?? 0,
  //         item.metadata ?? null,
  //       ],
  //     );
  //   }

  //   return true;

  const records = orderItems.map((item) => {
    const subtotal = item.unit_price * item.quantity;

    const qualifiesForDiscount = item.quantity >= item.min_quantity;

    const discountAmount = qualifiesForDiscount
      ? subtotal * (item.discount / 100)
      : 0;

    const sellerAmount = subtotal - discountAmount;
    return {
      order_id: orderId,
      listing_id: item.listing_id,
      seller_id: item.seller_id,
      logistics_id: item.logistics_id,
      listing_name: item.listing_name,
      product_image: item.product_image ?? null,
      unit: item.unit ?? null,
      quantity: item.quantity,
      unit_price: item.unit_price ?? 0,
      discount: item.discount ?? 0,
      min_quantity: item.min_quantity,
      seller_amount: sellerAmount ?? 0,
      metadata: item.metadata ?? null,
    };
  });

  return bulkInsert({
    client,
    table: "order_items",
    columns: [
      "order_id",
      "listing_id",
      "seller_id",
      "logistics_id",
      "listing_name",
      "product_image",
      "unit",
      "quantity",
      "unit_price",
      "discount",
      "seller_amount",
      "metadata",
      "min_quantity",
    ],
    records,
  });
}
export async function createPayout(payouts, client) {
  //   for (const payout of payouts) {
  //     await client.query(
  //       `
  //             INSERT INTO payouts (
  //                 order_id,
  //                recipient_vendor_id,
  //                recipient_type,
  //                payout_type,
  //                gross_amount,
  //                commision_amount,
  //                net_amount,
  //                currency,
  //             )
  //             VALUES (
  //                 $1,$2,$3,$4,$5,$6,$7,$8
  //             )
  //              RETURNING *`,
  //       [
  //         orderId,
  //         payout.seller_id,
  //         "vendor",
  //         "payout",
  //         payout.subtotal ?? 0,
  //         0,
  //         0,
  //         payout.currency,
  //       ],
  //     );
  //   }

  //   return true;

  return bulkInsert({
    client,
    table: "payouts",
    columns: [
      "order_id",
      "recipient_vendor_id",
      "recipient_type",
      "payout_type",
      "gross_amount",
      "commission_amount",
      "net_amount",
      "currency",
    ],
    records: payouts,
  });
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
   SELECT o.*, ls.assigned_driver_name, ls.assigned_driver_phone FROM orders AS o
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
  // o.id, o.currency, o.country_code, o.status, o.delivery_address, o.created_at, o.metadata,
  const query = `
  SELECT o.*, ls.assigned_driver_name, ls.assigned_driver_phone FROM orders o LEFT JOIN logistics_shipments ls ON o.id = ls.order_id
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
    UPDATE orders SET 
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
