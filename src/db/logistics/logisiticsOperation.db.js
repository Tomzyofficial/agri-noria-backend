import pool from "../../lib/connect.js";

export async function addVehicle({
  vendor_id,
  title,
  vehicle_type,
  license_plate,
  cargo_type,
  max_weight_kg,
  volume_cubic_meters,
  base_location,
  operating_regions,
  pricing_model,
  rate_amount,
  image,
  publicId,
}) {
  try {
    const queryText = `
      INSERT INTO vehicles (
        vendor_id, title, vehicle_type, license_plate, cargo_type,
        max_weight_kg, volume_cubic_meters, base_location, operating_regions,
        pricing_model, rate_amount, image, public_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *;
    `;

    const result = await pool.query(queryText, [
      vendor_id,
      title,
      vehicle_type,
      license_plate,
      cargo_type,
      max_weight_kg,
      volume_cubic_meters || null,
      base_location,
      operating_regions,
      pricing_model,
      rate_amount,
      image,
      publicId,
    ]);

    return { success: true, vehicle: result.rows[0] };
  } catch (error) {
    return {
      success: false,
      error: error.message || "failed to send",
    };
  }
}

// Get vehicles for vendor dashboard
export async function getVehicles(vendorId, page = 1, limit = 10) {
  const offset = (page - 1) * limit;
  try {
    const queryText = `
      SELECT v.*, cu.country_code, cu.vendor_id, cu.currency FROM vehicles AS v
      LEFT JOIN country_utils AS cu ON v.vendor_id = cu.vendor_id WHERE v.vendor_id = $1 ORDER BY v.id DESC LIMIT $2 OFFSET $3;
    `;
    const result = await pool.query(queryText, [vendorId, limit, offset]);
    return { listings: result.rows, page, limit };
  } catch (error) {
    return {
      error: error.message || "failed to send",
    };
  }
}

// Get vehicles for public
export async function getListedVehicles({
  country_code,
  limit = 100,
  offset = 0,
  vehicleId = null,
} = {}) {
  try {
    const vehicleQuery = `
      SELECT
        veh.id,
        veh.title,
        veh.vehicle_type,
        veh.base_location,
        veh.operating_regions,
        veh.pricing_model,
        veh.rate_amount,
        veh.image,
        veh.status,
        cu.country_code,
        cu.currency
      FROM vehicles veh
      LEFT JOIN country_utils cu ON cu.vendor_id = veh.vendor_id
      WHERE cu.country_code = $1
      ORDER BY CASE COALESCE(veh.status, 'available')
          WHEN 'available' THEN 0
          WHEN 'in_transit' THEN 1
          WHEN 'maintenance' THEN 2
          ELSE 3
        END,
        veh.created_at DESC
      LIMIT $2 OFFSET $3;
    `;

    // Used when fetching details for a specific vehicle on the public marketplace listing page
    const vehicleByIdQuery = `SELECT veh.id, veh.vendor_id, veh.title, veh.vehicle_type, veh.cargo_type, veh.max_weight_kg, veh.volume_cubic_meters, veh.base_location, veh.operating_regions, veh.pricing_model, veh.rate_amount, veh.image, veh.status, v.fname, v.lname, vd.business_name, cu.currency, cu.country_code FROM vehicles veh LEFT JOIN vendors v ON veh.vendor_id = v.id LEFT JOIN vendor_documents vd ON vd.vendor_id = v.id LEFT JOIN country_utils cu ON cu.vendor_id = veh.vendor_id WHERE veh.id = $1;`;

    const [vehicleResult, vehicleByIdResult] = await Promise.all([
      pool.query(vehicleQuery, [country_code, limit, offset]),
      vehicleId
        ? pool.query(vehicleByIdQuery, [vehicleId])
        : Promise.resolve({ rows: [] }),
    ]);

    return {
      success: true,
      vehicles: vehicleResult.rows,
      pagination: {
        limit,
        offset,
        count: vehicleResult.rows.length,
      },
      vehicleDetails: vehicleId ? vehicleByIdResult.rows[0] : null,
    };
  } catch (error) {
    console.error("Error fetching listed vehicles:", error);
    return {
      success: false,
      error: "Internal server error. Failed to retrieve listed vehicles",
    };
  }
}

// Show logistics provider available close to the buyer's delivery address during checkout
export async function getLogisticsProvidersNearBuyer(address) {
  try {
    const searchTerm = address?.trim();
    const queryText = `SELECT veh.id, veh.vendor_id, veh.title, veh.vehicle_type, veh.cargo_type, veh.max_weight_kg, veh.base_location, veh.operating_regions,
    veh.volume_cubic_meters, veh.pricing_model, veh.rate_amount, veh.image, veh.status, v.fname AS logistics_provider_fname, v.lname AS logistics_provider_lname, v.email AS logistics_provider_email, v.id AS logistics_provider_id FROM vehicles veh LEFT JOIN vendors v
    ON veh.vendor_id = v.id WHERE EXISTS (
    SELECT 1 FROM unnest(string_to_array(lower($1), ' ')) AS keyword WHERE lower(veh.base_location) LIKE '%' || keyword || '%' OR EXISTS (SELECT 1 FROM unnest(veh.operating_regions) AS region WHERE lower(region) LIKE '%' || keyword || '%')) ORDER BY veh.id;`;
    const result = await pool.query(queryText, [searchTerm]);

    if (result.rows.length === 0) {
      return {
        success: false,
        error: "No available logistics covering your delivery address route",
      };
    }

    return {
      success: true,
      providers: result.rows,
    };
  } catch (error) {
    console.error("Error retrieving logistics providers:", error);
    return {
      success: false,
      error: "Internal server error. Failed to retrieve logistics providers",
    };
  }
}

// const LOGISTICS_ORDERS_BASE_JOIN = `
//   FROM orders o
//   INNER JOIN vehicles veh
//     ON (o.metadata->'logistics_provider'->>'vehicle_id')::uuid = veh.id
//   LEFT JOIN buyers b ON o.buyer_id = b.buyer_id
//   LEFT JOIN vendors v ON o.seller_id = v.id
//   WHERE veh.vendor_id = $1
// `;

const LOGISTICS_ORDERS_BASE_JOIN = `
   FROM orders
   WHERE metadata->'logistics_provider' @> jsonb_build_object('logistics_vendor_id', $1::text)`;

/** Orders assigned to this logistics partner */
export async function getOrdersByLogisticsVendorId(
  vendorId,
  { status, limit = 50, offset = 0 } = {},
) {
  const params = [vendorId];
  let statusClause = "";

  if (status) {
    params.push(status);
    statusClause = ` AND status = $${params.length}`;
  }

  params.push(limit, offset);
  const limitIdx = params.length - 1;
  const offsetIdx = params.length;

  const query = `
     SELECT id, currency, country_code, status, delivery_address, created_at, metadata
     ${LOGISTICS_ORDERS_BASE_JOIN}
      ${statusClause}
      ORDER BY created_at DESC
      LIMIT $${limitIdx} OFFSET $${offsetIdx} 
     `;
  const result = await pool.query(query, params);
  return result.rows;
}

/** Per-status counts for logistics partner dashboard overview */
export async function getLogisticsOrderStats(vendorId) {
  const query = `
    SELECT
     country_code, currency,
      COUNT(*)::int AS total_orders,
      COUNT(*) FILTER (WHERE status = 'pending')::int AS pending_orders,
      COUNT(*) FILTER (WHERE status = 'paid')::int AS paid_orders,
      COUNT(*) FILTER (WHERE status = 'in_transit')::int AS in_transit_orders,
      COUNT(*) FILTER (WHERE status = 'delivered')::int AS delivered_orders,
      COUNT(*) FILTER (WHERE status = 'completed')::int AS completed_orders,
      COUNT(*) FILTER (WHERE status = 'declined')::int AS declined_orders,
      COUNT(*) FILTER (WHERE status = 'refunded')::int AS refunded_orders,
      COALESCE(SUM((metadata->'amount_breakdown'->>'delivery_fee')::numeric), 0) AS total_delivery_revenue
    ${LOGISTICS_ORDERS_BASE_JOIN}
    GROUP BY country_code, currency
  `;

  const result = await pool.query(query, [vendorId]);
  return result.rows[0];
}

/** Ensure order belongs to this logistics vendor's vehicle. This function is used when logistics vendor wants to start shipment */
export async function getLogisticsOrderForVendor(orderId, vendorId) {
  const query = `
      SELECT
        o.*,
        b.name AS buyer_name,
        b.email AS buyer_email,
        v.fname AS seller_fname,
        v.lname AS seller_lname,
        v.email AS seller_email,
        v.phone AS seller_phone,
        vd.business_name AS seller_business_name,
        veh.id AS vehicle_id,
        veh.title AS vehicle_title,
        veh.vendor_id AS logistics_vendor_id
      FROM orders o
      LEFT JOIN vehicles veh
        ON (o.metadata->'logistics_provider'->>'vehicle_id')::uuid = veh.id
      LEFT JOIN buyers b ON o.buyer_id = b.buyer_id
      LEFT JOIN vendors v ON (o.metadata->'logistics_provider'->>'logistics_vendor_id')::uuid = v.id
      LEFT JOIN vendor_documents vd ON vd.vendor_id = v.id
      WHERE o.id = $1 AND veh.vendor_id = $2
    `;
  //   const query = `SELECT * FROM orders WHERE id = $1 AND metadata->'logistics_provider'->>'logistics_vendor_id' = $2`;
  const result = await pool.query(query, [orderId, vendorId]);
  return result.rows[0] || null;
}

export async function getLogisticsOrderDetail(orderId, vendorId) {
  const order = await getLogisticsOrderForVendor(orderId, vendorId);
  if (!order) return null;

  const meta = order.metadata || {};
  const buyerInfo = meta.buyer_info || {};

  return {
    ...order,
    buyer_phone: buyerInfo.phone,
    seller_pickup_address:
      meta.item_breakdown.map((l) => l.listing_location) || null,
    items: meta.item_breakdown.map((item) => item),
  };
}

/** Next available vehicle near delivery address, excluding declining partner */
export async function findAlternativeVehicle(
  deliveryAddress,
  excludeVendorId,
  excludeVehicleId,
) {
  const searchTerm = deliveryAddress?.trim();
  if (!searchTerm) {
    return null;
  }

  const query = `
    SELECT id, vendor_id, title, vehicle_type, rate_amount, base_location, pricing_model
    FROM vehicles
    WHERE (
      base_location ILIKE '%' || $1 || '%'
      OR EXISTS (
        SELECT 1 FROM unnest(operating_regions) AS region
        WHERE region ILIKE '%' || $1 || '%'
      )
    )
    AND vendor_id != $2
    AND id != $3::uuid
    AND COALESCE(status, 'available') = 'available'
    ORDER BY (base_location ILIKE '%' || $1 || '%') DESC, rate_amount ASC
    LIMIT 1
  `;

  const result = await pool.query(query, [
    searchTerm,
    excludeVendorId,
    excludeVehicleId,
  ]);

  return result.rows[0] || null;
}

export async function updateOrderForLogistics(orderId, { status, metadata }) {
  const query = `
    UPDATE orders SET status = COALESCE($1, status), metadata = COALESCE($2::jsonb, metadata), updated_at = NOW() WHERE id = $3
    RETURNING *
  `;
  const result = await pool.query(query, [
    status || null,
    metadata ? JSON.stringify(metadata) : null,
    orderId,
  ]);
  return result.rows[0];
}

export async function acceptLogisticsOrder(orderId, vendorId) {
  const order = await getLogisticsOrderForVendor(orderId, vendorId);
  if (!order) {
    return {
      success: false,
      error: "Order not found for this logistics partner",
    };
  }
  if (order.status !== "paid") {
    return {
      success: false,
      error: `Only paid orders can be accepted (current: ${order.status})`,
    };
  }

  const metadata = {
    ...(typeof order.metadata === "object" ? order.metadata : {}),
    logistics_assignment: {
      status: "accepted",
      accepted_at: new Date().toISOString(),
      accepted_by_vendor_id: vendorId,
    },
  };

  const updated = await updateOrderForLogistics(orderId, {
    status: "processing",
    metadata,
  });
  return { success: true, order: updated };
}

export async function declineLogisticsOrder(orderId, vendorId) {
  const order = await getLogisticsOrderForVendor(orderId, vendorId);
  if (!order) {
    return {
      success: false,
      error: "Order not found for this logistics partner",
    };
  }
  if (order.status !== "paid") {
    return {
      success: false,
      error: `Only paid orders can be declined (current: ${order.status})`,
    };
  }

  const meta = typeof order.metadata === "object" ? { ...order.metadata } : {};
  const vehicleId = meta.logistics_provider?.vehicle_id;
  const declineEntry = {
    vendor_id: vendorId,
    vehicle_id: vehicleId,
    declined_at: new Date().toISOString(),
  };

  meta.decline_history = [...(meta.decline_history || []), declineEntry];
  meta.logistics_assignment = {
    status: "declined",
    declined_at: declineEntry.declined_at,
    declined_by_vendor_id: vendorId,
  };

  await updateOrderForLogistics(orderId, {
    status: "declined",
    metadata: meta,
  });

  const alternative = await findAlternativeVehicle(
    order.delivery_address,
    vendorId,
    vehicleId,
  );

  if (!alternative) {
    return {
      success: true,
      order: await getLogisticsOrderForVendor(orderId, vendorId),
      reassigned: false,
      message:
        "Order declined. No alternative logistics partner available nearby.",
    };
  }

  meta.logistics_provider = {
    vehicle_id: alternative.id,
    vehicle_title: alternative.title,
    vehicle_type: alternative.vehicle_type,
    rate_amount: alternative.rate_amount,
    base_location: alternative.base_location,
    pricing_model: alternative.pricing_model,
    vendor_id: alternative.vendor_id,
    reassigned_from_vehicle_id: vehicleId,
    reassigned_at: new Date().toISOString(),
  };
  meta.logistics_assignment = {
    status: "pending_acceptance",
    reassigned_at: meta.logistics_provider.reassigned_at,
  };

  const breakdown = meta.amount_breakdown || {};
  const subtotal = Number(breakdown.subtotal) || 0;
  const discount = Number(breakdown.discount) || 0;
  const newDeliveryFee = Number(alternative.rate_amount) || 0;
  const newTotal =
    Math.round((subtotal + newDeliveryFee - discount) * 100) / 100;

  meta.amount_breakdown = {
    ...breakdown,
    delivery_fee: newDeliveryFee,
    total_amount: newTotal,
  };

  const updated = await updateOrderForLogistics(orderId, {
    status: "paid",
    metadata: meta,
    delivery_fee: newDeliveryFee,
  });

  return {
    success: true,
    order: updated,
    reassigned: true,
    new_partner: {
      vehicle_id: alternative.id,
      vehicle_title: alternative.title,
      vendor_id: alternative.vendor_id,
    },
    message: "Order declined and reassigned to the nearest available partner.",
  };
}

/** Accepted orders ready for shipment (processing) */
export async function getShipmentOrdersByLogisticsVendorId(
  vendorId,
  { limit = 50, offset = 0 } = {},
) {
  const query = `
    SELECT * ${LOGISTICS_ORDERS_BASE_JOIN}
      AND status IN ('processing', 'in_transit')
    ORDER BY updated_at DESC
    LIMIT $2 OFFSET $3
  `;
  const result = await pool.query(query, [vendorId, limit, offset]);
  return result.rows;
}

export async function startLogisticsShipment(orderId, vendorId) {
  const order = await getLogisticsOrderForVendor(orderId, vendorId);
  if (!order) {
    return {
      success: false,
      error: "Order not found for this logistics partner",
    };
  }
  if (!["processing"].includes(order.status)) {
    return {
      success: false,
      error: `Shipment can only start from processing/shipped (current: ${order.status})`,
    };
  }

  const metadata = {
    ...(typeof order.metadata === "object" ? order.metadata : {}),
    logistics_assignment: {
      ...(order.metadata?.logistics_assignment || {}),
      status: "in_transit",
      shipment_started_at: new Date().toISOString(),
    },
  };

  const updated = await updateOrderForLogistics(orderId, {
    status: "in_transit",
    metadata,
  });
  return { success: true, order: updated };
}

/**
 * Get comprehensive order data for sending emails to buyer, seller, and logistics partner
 * Returns all necessary information for email templates for order confirmation
 */
export async function getOrderDataForEmails(orderId) {
  try {
    const query = `
      SELECT id, total_amount, currency, delivery_address, metadata
      FROM orders
      WHERE id = $1
    `;
    const result = await pool.query(query, [orderId]);
    if (!result.rows[0]) {
      console.log("no row found for email", result.rows);
      return { success: false, error: "Order not found" };
    }

    const order = result.rows[0];
    const metadata =
      order.metadata && typeof order.metadata === "object"
        ? order.metadata
        : {};
    const amountBreakdown =
      metadata.amount_breakdown && typeof metadata.amount_breakdown === "object"
        ? metadata.amount_breakdown
        : {};
    const buyerInfo =
      metadata.buyer_info && typeof metadata.buyer_info === "object"
        ? metadata.buyer_info
        : {};
    const sellerInfo = Array.isArray(metadata.seller_breakdown)
      ? metadata.seller_breakdown.filter(
          (seller) => seller && typeof seller === "object",
        )
      : [];
    const logisticsInfo =
      metadata.logistics_provider &&
      typeof metadata.logistics_provider === "object"
        ? metadata.logistics_provider
        : {};

    const buyerName = [buyerInfo.fname, buyerInfo.lname]
      .filter(Boolean)
      .join(" ");
    const currency =
      order.currency || sellerInfo.find((seller) => seller.currency)?.currency;
    const pickupAddress = [
      ...new Set(
        sellerInfo.map((seller) => seller.listing_location).filter(Boolean),
      ),
    ].join(", ");
    return {
      success: true,
      data: {
        buyer: {
          name: buyerName || buyerInfo.email || "Valued Customer",
          email: buyerInfo.email,
          phone: buyerInfo.phone,
          fname: buyerInfo.fname,
          lname: buyerInfo.lname,
        },
        seller: sellerInfo,
        logistics: {
          email: logisticsInfo.logistics_provider_email,
          fname: logisticsInfo.logistics_provider_fname,
          lname: logisticsInfo.logistics_provider_lname,
          vendor_id: logisticsInfo.logistics_vendor_id,
          vehicle_title: logisticsInfo.vehicle_title,
          vehicle_id: logisticsInfo.vehicle_id,
          vehicle_type: logisticsInfo.vehicle_type,
          rate_amount: logisticsInfo.rate_amount,
          base_location: logisticsInfo.base_location,
          operating_regions: logisticsInfo.operating_regions,
          pricing_model: logisticsInfo.pricing_model,
        },
        order: {
          id: order.id,
          order_number: order.id,
          total_amount: amountBreakdown.total_amount ?? order.total_amount,
          subtotal: amountBreakdown.subtotal,
          discount: amountBreakdown.discount,
          delivery_fee: amountBreakdown.delivery_fee,
          currency,
          delivery_address: order.delivery_address,
          pickup_address: pickupAddress || null,
          items: sellerInfo,
        },
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || "Failed to fetch order data for emails",
    };
  }
}

export async function getQuoteRequests(vendorId) {
  const quoteRequestsQuery = `SELECT qr.id as quote_request_id, qr.target_id, qr.full_name, qr.phone, qr.metadata, qr.created_at, qr.status, qr.additional_info, veh.title as title FROM quote_requests qr 
    INNER JOIN vehicles veh ON veh.id = qr.target_id WHERE veh.vendor_id = $1 ORDER BY qr.created_at DESC LIMIT 5`;

  const allQuoteRequestQuery = `SELECT qr.id AS quote_request_id, qr.target_id, qr.full_name,
       qr.phone, qr.metadata, qr.created_at, qr.status, qr.additional_info, veh.title AS vehicle_title, veh.base_location
       FROM quote_requests qr
       INNER JOIN vehicles veh ON veh.id = qr.target_id
       WHERE veh.vendor_id = $1
       ORDER BY qr.created_at DESC`;

  const [quoteRequestsResult, allQuoteRequestsResult] = await Promise.all([
    pool.query(quoteRequestsQuery, [vendorId]),
    pool.query(allQuoteRequestQuery, [vendorId]),
  ]);

  return {
    success: true,
    quoteRequests: quoteRequestsResult.rows,
    allQuoteRequests: allQuoteRequestsResult.rows,
  };
}

export async function updateQuoteRequestStatus(
  quoteRequestId,
  status,
  accountId,
) {
  try {
    const { rows } = await pool.query(
      `UPDATE quote_requests SET status = $1 FROM
         vehicles veh WHERE veh.id = quote_requests.target_id AND quote_requests.id = $2 AND veh.vendor_id = $3
         RETURNING *`,
      [status, quoteRequestId, accountId],
    );
    return { success: true, data: rows[0] };
  } catch (error) {
    return { success: false, error: "Internal server error. Try again." };
  }
}
