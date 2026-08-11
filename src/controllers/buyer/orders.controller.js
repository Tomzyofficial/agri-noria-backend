import { z } from "zod";
import {
  createOrder,
  getOrdersByBuyerId,
  getOrdersBySellerId,
  //   updateOrderStatus,
  getSellerOrderStats,
  getBuyerOrderStats,
} from "../../db/buyer/orders.db.js";
import { verifyBuyerToken } from "../../sessions/buyer.auth.session.js";
// import { confirmBuyerSatisfactionWithOTP } from "../../db/logistics/shipment.db.js";
import { verifyVendorToken } from "../../sessions/vendor.auth.session.js";

const orderSchema = z.object({
  buyer_id: z.string().uuid("Invalid buyer ID"),
  seller_id: z.string().uuid("Invalid seller ID"),
  total_amount: z.number().positive("Total amount must be positive"),
  currency: z.string().default("NGN"),
  //   fulfillment_type: z.enum(['delivery', 'pickup']).default('delivery'),
  fulfillment_type: z.string().default("delivery"),
  delivery_address: z.string().optional(),
  delivery_fee: z.number().nonnegative().default(0),
  estimated_delivery_time: z.string().datetime().optional(),
  notes: z.string().optional(),
  metadata: z.record(z.any()).optional().default({}),
  items: z
    .array(
      z.object({
        product_id: z.string().uuid("Invalid product ID"),
        product_type: z.enum(["produce", "equipment"]),
        quantity: z.number().positive("Quantity must be positive"),
        unit_price: z.number().nonnegative("Unit price must be nonnegative"),
        packaging_type: z.string().optional(),
        unit_measure: z.string().optional(),
        product_name: z.string(),
        product_image: z.string(),
      }),
    )
    .min(1, "At least one item is required"),
});

const ORDER_STATUSES = [
  "pending",
  "paid",
  "shipped",
  "in_transit",
  "delivered",
  "completed",
  "declined",
  "cancelled",
  "refunded",
];

/** Matches checkout summary: subtotal + delivery (rate_amount) - discount */
function calculateCheckoutAmounts(cart, rate_amount) {
  const subtotal = cart.reduce(
    (sum, item) => sum + Number(item.price) * Number(item.quantity),
    0,
  );

  const discount = cart.reduce((totalDiscount, item) => {
    const itemTotal = Number(item.price) * Number(item.quantity);
    const meetsMinQuantity =
      Number(item.quantity) >= Number(item.min_quantity ?? 0);

    if (meetsMinQuantity && Number(item.discount) > 0) {
      return totalDiscount + itemTotal * (Number(item.discount) / 100);
    }
    return totalDiscount;
  }, 0);

  const delivery_fee = Number(rate_amount) || 0;
  const total_amount =
    Math.round((subtotal + delivery_fee - discount) * 100) / 100;

  return {
    subtotal: Math.round(subtotal * 100) / 100,
    discount: Math.round(discount * 100) / 100,
    delivery_fee: Math.round(delivery_fee * 100) / 100,
    total_amount,
  };
}

// Create a new order
export async function createOrderController(req, res) {
  const payload = await verifyBuyerToken(req);

  if (!payload) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }

  try {
    const {
      buyerId,
      vendor,
      address,
      cart,
      fname,
      lname,
      email,
      phone,
      currency,
      country_code,
      id: vehicle_id,
      title: vehicle_title,
      vendor_id: logistics_vendor_id,
      vehicle_type,
      rate_amount,
      base_location,
      operating_regions,
      pricing_model,
      logistics_provider_email,
      logistics_provider_fname,
      logistics_provider_lname,
    } = req.body;

    // Validate required fields
    if (!buyerId) {
      return res
        .status(400)
        .json({ success: false, error: "Buyer ID is required" });
    }

    if (!address) {
      return res
        .status(400)
        .json({ success: false, error: "Delivery address is required" });
    }

    if (!cart || !Array.isArray(cart) || cart.length === 0) {
      return res
        .status(400)
        .json({ success: false, error: "Cart items are required" });
    }

    if (!vehicle_id) {
      return res
        .status(400)
        .json({ success: false, error: "Logistics provider is required" });
    }

    if (!rate_amount || Number(rate_amount) <= 0) {
      return res.status(400).json({
        success: false,
        error: "Valid logistics rate_amount is required for delivery fee",
      });
    }

    const { subtotal, discount, delivery_fee, total_amount } =
      calculateCheckoutAmounts(cart, rate_amount);

    const metadata = {
      buyer_info: {
        fname,
        lname,
        phone,
        email,
      },
      seller_breakdown: vendor,
      logistics_provider: {
        vehicle_id,
        vehicle_title,
        vehicle_type,
        rate_amount,
        base_location,
        operating_regions,
        pricing_model,
        logistics_vendor_id,
        logistics_provider_email,
        logistics_provider_fname,
        logistics_provider_lname,
      },
      amount_breakdown: {
        subtotal,
        discount,
        delivery_fee,
        total_amount,
      },
    };

    const orderItems = vendor.map((v) => ({
      listing_id: v.listing_id,
      seller_id: v.seller_id,
      logistics_id: logistics_vendor_id,
      rate_amount,
      listing_name: v.listing_name,
      product_image: v.product_image,
      unit: v.unit_measure,
      unit_price: v.price,
      quantity: v.quantity,
      min_quantity: v.min_quantity,
      discount: v.discount,
      country_code: v.country_code,
      currency: v.currency,
    }));

    const order = await createOrder({
      buyer_id: buyerId,
      total_amount,
      currency,
      country_code,
      fulfillment_type: "delivery",
      delivery_address: address,
      delivery_fee,
      notes: `Order from ${fname} ${lname}. Phone: ${phone}`,
      metadata,
      orderItems,
    });

    res.status(201).json({
      success: true,
      message: "Order created successfully",
      data: {
        ...order,
        amount_breakdown: {
          subtotal,
          discount,
          delivery_fee,
          total_amount,
        },
      },
    });
  } catch (error) {
    console.error("Error creating order:", error);
    res.status(500).json({
      success: false,
      error: "Failed to place your order. Please try again later",
    });
  }
}

// Get orders by buyer ID
export async function getBuyerOrdersController(req, res) {
  const payload = await verifyBuyerToken(req);
  try {
    if (!payload) {
      return res.status(400).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
    const offset = parseInt(req.query.offset, 10) || 0;
    const status = req.query.status?.trim();

    if (status && !ORDER_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        error: `Invalid status. Allowed: ${ORDER_STATUSES.join(", ")}`,
      });
    }

    const orders = await getOrdersByBuyerId(payload.buyer_id, {
      status,
      limit,
      offset,
    });

    res.status(200).json({
      success: true,
      data: orders,
      pagination: {
        limit,
        offset,
        count: orders.length,
      },
    });
  } catch (error) {
    console.error("Error getting buyer orders:", error);
    res.status(500).json({
      success: false,
      error: "Failed to retrieve orders. ",
    });
  }
}

// Get orders by seller ID
export async function getSellerOrdersController(req, res) {
  try {
    const payload = await verifyVendorToken(req);
    if (!payload) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
    const offset = parseInt(req.query.offset, 10) || 0;
    const status = req.query.status?.trim();

    if (status && !ORDER_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        error: `Invalid status. Allowed: ${ORDER_STATUSES.join(", ")}`,
      });
    }

    const orders = await getOrdersBySellerId(payload.id, {
      status: status,
      limit,
      offset,
    });

    res.status(200).json({
      success: true,
      data: orders,
      pagination: {
        limit,
        offset,
        count: orders.length,
      },
    });
  } catch (error) {
    console.error("Error getting seller orders:", error);
    res.status(500).json({
      success: false,
      error: "Failed to retrieve orders",
    });
  }
}

// Update order status
// export async function updateOrderStatusController(req, res) {
//   try {
//     const { id } = req.params;
//     const { status } = req.body;

//     if (!id) {
//       return res.status(400).json({
//         success: false,
//         message: "Order ID is required",
//       });
//     }

//     if (!status) {
//       return res.status(400).json({
//         success: false,
//         message: "Status is required",
//       });
//     }

//     const validStatuses = [
//       "pending",
//       "paid",
//       "processing",
//       "shipped",
//       "in_transit",
//       "delivered",
//       "completed",
//       "cancelled",
//       "refunded",
//     ];
//     if (!validStatuses.includes(status)) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid status value",
//       });
//     }

//     const order = await updateOrderStatus(id, status);

//     if (!order) {
//       return res.status(404).json({
//         success: false,
//         message: "Order not found",
//       });
//     }

//     res.status(200).json({
//       success: true,
//       message: "Order status updated successfully",
//       data: order,
//     });
//   } catch (error) {
//     console.error("Error updating order status:", error);
//     res.status(500).json({
//       success: false,
//       message: "Failed to update order status",
//       error: error.message,
//     });
//   }
// }

// Get seller order statistics
export async function getSellerOrderStatsController(req, res) {
  try {
    const payload = await verifyVendorToken(req);
    if (!payload) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const stats = await getSellerOrderStats(payload.id);

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error("Error getting seller order stats:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get seller order statistics",
      error: error.message,
    });
  }
}

// Get buyer order statistics
export async function getBuyerOrderStatsController(req, res) {
  try {
    const payload = await verifyBuyerToken(req);

    if (!payload) {
      return res.status(400).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const stats = await getBuyerOrderStats(payload.buyer_id);

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error("Error getting buyer order stats:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get buyer order statistics",
    });
  }
}

// Confirm buyer satisfaction with OTP verification
// export async function confirmBuyerSatisfactionController(req, res) {
//   try {
//     const payload = await verifyBuyerToken(req);

//     if (!payload) {
//       return res.status(401).json({
//         success: false,
//         message: "Unauthorized",
//       });
//     }

//     const { id: orderId } = req.params;
//     const { otp } = req.body;

//     // Validate OTP
//     if (!otp || otp.trim().length === 0) {
//       return res.status(400).json({
//         success: false,
//         error: "OTP is required",
//       });
//     }

//     if (otp.length !== 6) {
//       return res.status(400).json({
//         success: false,
//         error: "OTP must be 6 digits",
//       });
//     }

//     const result = await confirmBuyerSatisfactionWithOTP(
//       orderId,
//       otp.trim(),
//       payload.buyer_id,
//     );

//     if (!result.success) {
//       return res.status(400).json(result);
//     }

//     res.status(200).json({
//       success: true,
//       message: "Buyer satisfaction confirmed successfully",
//       data: result.data,
//     });
//   } catch (error) {
//     console.error("Error confirming buyer satisfaction:", error);
//     res.status(500).json({
//       success: false,
//       error: error.message || "Failed to confirm buyer satisfaction",
//     });
//   }
// }
