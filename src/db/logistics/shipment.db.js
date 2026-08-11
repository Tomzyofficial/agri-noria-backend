import pool from "../../lib/connect.js";
import {
  generateTrackingNumber,
  generateDeliveryOTP,
  hashOTP,
  generateOTPExpiry,
} from "../../utils/logistics.utils.js";

export async function shipmentExistsForOrder(orderId) {
  try {
    const query = `
      SELECT id FROM logistics_shipments 
      WHERE order_id = $1
    `;
    const result = await pool.query(query, [orderId]);
    return result.rows.length > 0;
  } catch (error) {
    console.error("Error checking shipment existence:", error);
    throw error;
  }
}

/**
 * Create a new shipment record with transaction support
 * @param {Object} shipmentData - Shipment data
 * @returns {Promise<Object>} Created shipment record
 */
export async function createShipment(shipmentData) {
  const {
    order_id,
    logistics_partner_id,
    tracking_number,
    delivery_otp,
    delivery_otp_expires_at,
    assigned_driver_name,
    assigned_driver_phone,
    vehicle_plate_number,
    estimated_delivery_datetime,
    pickup_confirmation,
    pickup_photo_url,
    dispatch_notes,
    pickup_location,
    delivery_location,
  } = shipmentData;

  const query = `
    INSERT INTO logistics_shipments (
      order_id,
      logistics_company_id,
      tracking_number,
      delivery_otp,
      delivery_otp_expires_at,
      assigned_driver_name,
      assigned_driver_phone,
      vehicle_plate_number,
      estimated_delivery_time,
      pickup_confirmation,
      pickup_photo_url,
      dispatch_notes,
      pickup_location,
      delivery_location,
      status,
      shipment_started_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
    RETURNING *
  `;

  const values = [
    order_id,
    logistics_partner_id,
    tracking_number,
    delivery_otp, // hashed OTP
    delivery_otp_expires_at,
    assigned_driver_name,
    assigned_driver_phone,
    vehicle_plate_number,
    estimated_delivery_datetime,
    pickup_confirmation,
    pickup_photo_url,
    dispatch_notes,
    pickup_location,
    delivery_location,
    "in_transit",
    new Date(),
  ];

  const result = await pool.query(query, values);
  return result.rows[0];
}

/**
 * Update order status to in_transit
 * @param {string} orderId - Order ID
 * @returns {Promise<Object>} Updated order
 */
export async function updateOrderStatusToInTransit(orderId) {
  const query = `
    UPDATE orders SET status = 'in_transit', updated_at = NOW() WHERE id = $1
    RETURNING *
  `;
  const result = await pool.query(query, [orderId]);
  return result.rows[0];
}

/**
 * Create a shipment tracking event
 * @param {Object} eventData - Event data
 * @returns {Promise<Object>} Created event
 */
/* export async function createShipmentTrackingEvent(eventData) {
  const {
    shipment_id,
    event_type,
    event_status,
    location,
    coordinates,
    event_notes,
  } = eventData;

  const query = `
    INSERT INTO shipment_tracking_events (
      shipment_id,
      event_type,
      event_status,
      location,
      coordinates,
      event_notes
    ) VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *
  `;

  const values = [
    shipment_id,
    event_type,
    event_status,
    location,
    coordinates ? JSON.stringify(coordinates) : null,
    event_notes,
  ];

  const result = await pool.query(query, values);
  return result.rows[0];
} */

/**
 * Start shipment with full transaction support
 * This function performs the following in a transaction:
 * 1. Check if shipment already exists
 * 2. Validate order status
 * 3. Generate tracking number and OTP
 * 4. Create shipment record
 * 5. Update order status
 * 6. Create tracking event
 */
export async function startShipmentTransaction(data) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Check if shipment already exists
    const existingShipment = await client.query(
      "SELECT id FROM logistics_shipments WHERE order_id = $1",
      [data.order_id],
    );

    if (existingShipment.rows.length > 0) {
      await client.query("ROLLBACK");
      return {
        success: false,
        error: "Shipment already exists for this order",
      };
    }

    // Validate order status
    const orderResult = await client.query(
      "SELECT status, buyer_id, delivery_address FROM orders WHERE id = $1",
      [data.order_id],
    );

    if (orderResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return {
        success: false,
        error: "Order not found",
      };
    }

    const order = orderResult.rows[0];
    const invalidStatuses = ["delivered", "completed", "declined", "refunded"];

    if (invalidStatuses.includes(order.status)) {
      await client.query("ROLLBACK");
      return {
        success: false,
        error: `Order cannot be shipped. Current status: ${order.status}`,
      };
    }

    // Generate tracking number and OTP
    const trackingNumber = generateTrackingNumber();
    const plainOTP = generateDeliveryOTP(6);
    const hashedOTP = hashOTP(plainOTP);
    const otpExpiry = generateOTPExpiry(24); // 24 hours

    // Create shipment record
    const shipmentQuery = `
      INSERT INTO logistics_shipments (
        order_id,
        logistics_company_id,
        tracking_number,
        delivery_otp,
        delivery_otp_expires_at,
        assigned_driver_name,
        assigned_driver_phone,
        vehicle_plate_number,
        estimated_delivery_time,
        pickup_confirmation,
        pickup_photo_url,
        dispatch_notes,
        pickup_location,
        delivery_location,
        status,
        shipment_started_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING *
    `;

    const shipmentValues = [
      data.order_id,
      data.logistics_partner_id,
      trackingNumber,
      hashedOTP,
      otpExpiry,
      data.assigned_driver_name,
      data.assigned_driver_phone,
      data.vehicle_plate_number,
      data.estimated_delivery_datetime,
      data.pickup_confirmation,
      data.pickup_photo_url,
      data.dispatch_notes || null,
      data.pickup_location || order.delivery_address,
      data.delivery_location || order.delivery_address,
      "in_transit",
      new Date(),
    ];

    const shipmentResult = await client.query(shipmentQuery, shipmentValues);
    const shipment = shipmentResult.rows[0];

    // Update order status
    await client.query(
      "UPDATE orders SET status = 'in_transit', updated_at = NOW() WHERE id = $1",
      [data.order_id],
    );

    // Create tracking event
    await client.query(
      `INSERT INTO shipment_tracking_events (
        shipment_id, event_type, event_status, location, event_notes
      ) VALUES ($1, $2, $3, $4, $5)`,
      [
        shipment.id,
        "shipment_started",
        "completed",
        data.pickup_location || "Warehouse",
        "Shipment started by logistics partner",
      ],
    );

    await client.query("COMMIT");

    return {
      success: true,
      data: {
        shipment,
        order: {
          id: data.order_id,
          buyer_id: order.buyer_id,
          delivery_address: order.delivery_address,
        },
        tracking_number: trackingNumber,
        delivery_otp: plainOTP, // Return plain OTP for email
        delivery_otp_expires_at: otpExpiry,
      },
    };
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error in startShipmentTransaction:", error);
    return {
      success: false,
      error: error.message || "Failed to start shipment",
    };
  } finally {
    client.release();
  }
}

/**
 * Get shipment by tracking number
 * @param {string} trackingNumber - Tracking number
 * @returns {Promise<Object|null>} Shipment data
 */
// export async function getShipmentByTrackingNumber(trackingNumber) {
//   try {
//     const query = `
//       SELECT
//         ls.*,
//         o.id as order_id,
//         o.buyer_id,
//         o.delivery_address,
//         o.total_amount,
//         o.currency,
//         b.name as buyer_name,
//         b.email as buyer_email
//       FROM logistics_shipments ls
//       INNER JOIN orders o ON ls.order_id = o.id
//       INNER JOIN buyers b ON o.buyer_id = b.buyer_id
//       WHERE ls.tracking_number = $1
//     `;
//     const result = await pool.query(query, [trackingNumber]);
//     return result.rows[0] || null;
//   } catch (error) {
//     console.error("Error fetching shipment by tracking number:", error);
//     throw error;
//   }
// }

/**
 * Get shipment by order ID
 * @param {string} orderId - Order ID
 * @returns {Promise<Object|null>} Shipment data
 */
export async function getShipmentByOrderId(orderId) {
  try {
    const query = `
      SELECT 
        ls.*,
        o.buyer_id,
        o.delivery_address,
        b.name as buyer_name,
        b.email as buyer_email
      FROM logistics_shipments ls
      INNER JOIN orders o ON ls.order_id = o.id
      INNER JOIN buyers b ON o.buyer_id = b.buyer_id
      WHERE ls.order_id = $1
    `;
    const result = await pool.query(query, [orderId]);
    return result.rows[0] || null;
  } catch (error) {
    console.error("Error fetching shipment by order ID:", error);
    throw error;
  }
}

/**
 * Verify delivery OTP
 * @param {string} shipmentId - Shipment ID
 * @param {string} otp - Plain OTP to verify
 * @returns {Promise<Object>} Verification result
 */
export async function verifyDeliveryOTP(shipmentId, otp) {
  try {
    const query = `
      SELECT 
        delivery_otp,
        delivery_otp_expires_at,
        delivery_otp_verified
      FROM logistics_shipments
      WHERE id = $1
    `;
    const result = await pool.query(query, [shipmentId]);

    if (result.rows.length === 0) {
      return { success: false, error: "Shipment not found" };
    }

    const shipment = result.rows[0];

    if (shipment.delivery_otp_verified) {
      return { success: false, error: "OTP already verified" };
    }

    if (new Date() > new Date(shipment.delivery_otp_expires_at)) {
      return { success: false, error: "OTP has expired" };
    }

    const hashedOTP = hashOTP(otp);

    if (hashedOTP !== shipment.delivery_otp) {
      return { success: false, error: "Invalid OTP" };
    }

    // Mark OTP as verified
    await pool.query(
      `UPDATE logistics_shipments 
       SET delivery_otp_verified = true, 
           delivery_otp_verified_at = NOW()
       WHERE id = $1`,
      [shipmentId],
    );

    return { success: true, message: "OTP verified successfully" };
  } catch (error) {
    console.error("Error verifying delivery OTP:", error);
    return { success: false, error: "Failed to verify OTP" };
  }
}

// Complete delivery (logistics partner action)
//  Verifies with OTP and marks order as delivered
export async function completeDeliveryWithOTP(
  orderId,
  otp,
  logisticsPartnerId,
) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Verify order belongs to logistics partner
    const orderQuery = `
      SELECT o.id, o.status, o.buyer_id, ls.id as shipment_id, ls.delivery_otp, 
             ls.delivery_otp_expires_at, ls.delivery_otp_verified, ls.logistics_company_id
      FROM orders o
      INNER JOIN logistics_shipments ls ON o.id = ls.order_id
      WHERE o.id = $1 AND ls.logistics_company_id = $2
    `;
    const orderResult = await client.query(orderQuery, [
      orderId,
      logisticsPartnerId,
    ]);

    if (orderResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return {
        success: false,
        error: "Order not found or does not belong to this logistics partner",
      };
    }

    const order = orderResult.rows[0];

    if (order.status !== "in_transit") {
      await client.query("ROLLBACK");
      return {
        success: false,
        error: `Order is not in transit. Current status: ${order.status}`,
      };
    }

    if (order.delivery_otp_verified) {
      await client.query("ROLLBACK");
      return { success: false, error: "Delivery already completed" };
    }

    if (new Date() > new Date(order.delivery_otp_expires_at)) {
      await client.query("ROLLBACK");
      return { success: false, error: "OTP has expired" };
    }

    // Verify OTP
    const hashedOTP = hashOTP(otp);
    if (hashedOTP !== order.delivery_otp) {
      await client.query("ROLLBACK");
      return { success: false, error: "Invalid OTP" };
    }

    // Mark OTP as verified and update shipment
    await client.query(
      `UPDATE logistics_shipments SET delivery_otp_verified = true, delivery_otp_verified_at = NOW(), delivered_at = NOW(), status = 'delivered'
       WHERE id = $1`,
      [order.shipment_id],
    );

    // Update order status to delivered
    await client.query(
      `UPDATE orders SET status = 'delivered',  updated_at = NOW()
       WHERE id = $1`,
      [orderId],
    );

    // Create tracking event
    await client.query(
      `INSERT INTO shipment_tracking_events (
        shipment_id, event_type, event_status, event_notes
      ) VALUES ($1, $2, $3, $4)`,
      [
        order.shipment_id,
        "delivery_completed",
        "delivered",
        "Delivery completed by logistics partner",
      ],
    );

    await client.query("COMMIT");

    return {
      success: true,
      message: "Delivery completed successfully",
      data: {
        order_id: orderId,
        shipment_id: order.shipment_id,
        status: "delivered",
      },
    };
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error completing delivery:", error);
    return {
      success: false,
      error: error.message || "Failed to complete delivery",
    };
  } finally {
    client.release();
  }
}

// export async function confirmBuyerSatisfactionWithOTP(orderId, otp, buyerId) {
//   const client = await pool.connect();

//   try {
//     await client.query("BEGIN");

//     const orderQuery = `
//       SELECT o.id, o.status, o.buyer_id, ls.id as shipment_id, ls.delivery_otp,
//        ls.delivery_otp_expires_at, ls.buyer_satisfied
//       FROM orders o
//       INNER JOIN logistics_shipments ls ON o.id = ls.order_id
//       WHERE o.id = $1 AND o.buyer_id = $2
//     `;
//     const orderResult = await client.query(orderQuery, [orderId, buyerId]);
//     if (orderResult.rows.length === 0) {
//       await client.query("ROLLBACK");
//       return {
//         success: false,
//         error: "Order not found or does not belong to this buyer",
//       };
//     }

//     const order = orderResult.rows[0];

//     if (order.status !== "in_transit" && order.status !== "delivered") {
//       await client.query("ROLLBACK");
//       return {
//         success: false,
//         error: `Order is not eligible for satisfaction confirmation. Current status: ${order.status}`,
//       };
//     }

//     if (order.buyer_satisfied) {
//       await client.query("ROLLBACK");
//       return { success: false, error: "Buyer satisfaction already confirmed" };
//     }

//     if (new Date() > new Date(order.delivery_otp_expires_at)) {
//       await client.query("ROLLBACK");
//       return { success: false, error: "OTP has expired" };
//     }

//     // Verify OTP
//     const hashedOTP = hashOTP(otp);
//     if (hashedOTP !== order.delivery_otp) {
//       await client.query("ROLLBACK");
//       return { success: false, error: "Invalid OTP" };
//     }

//     // Mark buyer as satisfied
//     await client.query(
//       `UPDATE logistics_shipments
//        SET buyer_satisfied = true,
//            buyer_satisfied_at = NOW()
//        WHERE id = $1`,
//       [order.shipment_id],
//     );

//     // Create tracking event
//     await client.query(
//       `INSERT INTO shipment_tracking_events (
//         shipment_id, event_type, event_status, event_notes
//       ) VALUES ($1, $2, $3, $4)`,
//       [
//         order.shipment_id,
//         "buyer_satisfied",
//         "satisfied",
//         "Buyer confirmed satisfaction",
//       ],
//     );

//     await client.query("COMMIT");

//     return {
//       success: true,
//       message: "Buyer satisfaction confirmed successfully",
//       data: {
//         order_id: orderId,
//         shipment_id: order.shipment_id,
//         buyer_satisfied: true,
//       },
//     };
//   } catch (error) {
//     await client.query("ROLLBACK");
//     console.error("Error confirming buyer satisfaction:", error);
//     return {
//       success: false,
//       error: error.message || "Failed to confirm buyer satisfaction",
//     };
//   } finally {
//     client.release();
//   }
// }
