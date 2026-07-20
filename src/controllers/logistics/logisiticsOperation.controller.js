import {
  addVehicle,
  getVehicles,
  getListedVehicles,
  getLogisticsProvidersNearBuyer,
  getOrdersByLogisticsVendorId,
  getLogisticsOrderStats,
  getLogisticsOrderDetail,
  acceptLogisticsOrder,
  declineLogisticsOrder,
  getShipmentOrdersByLogisticsVendorId,
  //   startLogisticsShipment,
  getLogisticsOrderForVendor,
  getQuoteRequests,
  updateQuoteRequestStatus,
} from "../../db/logistics/logisiticsOperation.db.js";
import {
  startShipmentTransaction,
  getShipmentByOrderId,
  completeDeliveryWithOTP,
} from "../../db/logistics/shipment.db.js";

import { saveFileToCloudinary } from "../../lib/cloudinary.img.js";
import { verifyVendorToken } from "../../sessions/vendor.auth.session.js";
import { verifyBuyerToken } from "../../sessions/buyer.auth.session.js";
import vehicleUploadSchema from "../../lib/validations/validateLogisticsOperation.js";
import emailService from "../../services/email/email.service.js";
import { AppError } from "../../utils/AppError.js";

const logisiticsOperation = {};

const ORDER_STATUSES = [
  "pending",
  "paid",
  "processing",
  "shipped",
  "in_transit",
  "delivered",
  "completed",
  "declined",
  "cancelled",
  "refunded",
];

function isLogisticsPartner(payload) {
  const type = payload?.role?.toLowerCase?.();
  return type === "logistics";
}

logisiticsOperation.addVehicle = async (req, res) => {
  const payload = await verifyVendorToken(req);

  if (!payload) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }
  try {
    const {
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
    } = req.body;

    // Parse operating_regions if it's a JSON string
    let parsedOperatingRegions = operating_regions;
    if (typeof operating_regions === "string") {
      try {
        parsedOperatingRegions = JSON.parse(operating_regions);
      } catch (e) {
        // If parsing fails, keep as is
        console.log("Error here", e.message);
      }
    }
    const images = req.file;

    let validate = vehicleUploadSchema.safeParse({
      images,
      title,
      vehicle_type,
      license_plate,
      cargo_type,
      max_weight_kg,
      volume_cubic_meters,
      base_location,
      operating_regions: parsedOperatingRegions,
      pricing_model,
      rate_amount,
    });
    if (!validate.success) {
      const firstMsg = Object.values(validate.error.flatten().fieldErrors)
        .flat()
        .filter(Boolean)[0];
      if (firstMsg) {
        return res.status(400).json({ success: false, error: firstMsg });
      }
    }
    const imagesToCloudinary = await saveFileToCloudinary(
      images,
      "logistics_vehicle",
      "image",
    );
    if (!imagesToCloudinary?.secure_url) {
      return res
        .status(400)
        .json({ success: false, error: "Image upload failed." });
    }
    const result = await addVehicle({
      vendor_id: payload.id,
      title,
      vehicle_type,
      license_plate,
      cargo_type,
      max_weight_kg,
      volume_cubic_meters,
      base_location,
      operating_regions: parsedOperatingRegions,
      pricing_model,
      rate_amount,
      images: [imagesToCloudinary.secure_url],
    });
    if (result.success) {
      return res.status(200).json({ success: true, data: result });
    }
    return res.status(400).json({ success: false, error: result.error });
  } catch (error) {
    console.error("Error", error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

logisiticsOperation.getVehicles = async (req, res) => {
  const payload = await verifyVendorToken(req);

  if (!payload) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }
  try {
    const result = await getVehicles(payload.id);
    if (result.success) {
      return res.status(200).json({ success: true, data: result.vehicles });
    }
    return res.status(400).json({ success: false, error: result.error });
  } catch (error) {
    console.error("Error", error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

logisiticsOperation.getListedVehicles = async (req, res) => {
  let country_code;
  let vehicleId = null;
  const vehicleIdFromQuery = req.query.vehicleId;
  if (vehicleIdFromQuery) {
    vehicleId = vehicleIdFromQuery;
  }
  const userLocationCookie = req.cookies?.user_location;
  if (userLocationCookie) {
    const locationData = JSON.parse(userLocationCookie);
    country_code = locationData.country_code;
  }
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 100, 100);
    const offset = parseInt(req.query.offset, 10) || 0;

    const result = await getListedVehicles({
      country_code,
      limit,
      offset,
      vehicleId,
    });
    if (!result.success) {
      return res.status(500).json({ success: false, error: result.error });
    }

    return res.status(200).json({
      success: true,
      data: result.vehicles,
      pagination: result.pagination,
      vehicleDetails: result.vehicleDetails,
    });
  } catch (error) {
    console.error("Error fetching listed vehicles:", error);
    return res.status(500).json({
      success: false,
      error: "Internal server error occurred. Try again.",
    });
  }
};

// Used during checkout to show case list of logistics providers
logisiticsOperation.getLogisticsProvidersNearBuyer = async (req, res) => {
  const payload = await verifyBuyerToken(req);

  if (!payload) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }
  const { address } = req.query;
  if (!address) {
    return res
      .status(400)
      .json({ success: false, error: "Address is required" });
  }
  try {
    const result = await getLogisticsProvidersNearBuyer(address);
    if (!result.success) {
      throw new AppError(result.error, 404);
    }
    return res.status(200).json({ success: true, data: result.providers });
  } catch (error) {
    return error.statusCode
      ? res.status(error.statusCode).json({
          success: false,
          error: error.message || "Internal server error occurred. Try again.",
        })
      : res.status(500).json({
          success: false,
          error: "Internal server error occurred. Try again.",
        });
  }
};

// Dashboard: order counts by status for the logged-in logistics partner
logisiticsOperation.getLogisticsOrderStats = async (req, res) => {
  const payload = await verifyVendorToken(req);

  if (!payload?.id) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }

  if (!isLogisticsPartner(payload)) {
    return res.status(403).json({
      success: false,
      error: "Only logistics partners can access order statistics",
    });
  }

  try {
    const stats = await getLogisticsOrderStats(payload.id);
    return res.status(200).json({ success: true, data: stats });
  } catch (error) {
    console.error("Error fetching logistics order stats:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch order statistics",
    });
  }
};

// Dashboard: orders linked to this partner's vehicles
logisiticsOperation.getLogisticsOrders = async (req, res) => {
  const payload = await verifyVendorToken(req);

  if (!payload?.id) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }

  if (!isLogisticsPartner(payload)) {
    return res.status(403).json({
      success: false,
      error: "Only logistics partners can access orders",
    });
  }

  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
    const offset = parseInt(req.query.offset, 10) || 0;
    const status = req.query.status?.trim();

    if (status && !ORDER_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        error: `Invalid status. Allowed: ${ORDER_STATUSES.join(", ")}`,
      });
    }

    const orders = await getOrdersByLogisticsVendorId(payload.id, {
      status: status || undefined,
      limit,
      offset,
    });

    return res.status(200).json({
      success: true,
      data: orders,
      pagination: { limit, offset, count: orders.length },
    });
  } catch (error) {
    console.error("Error fetching logistics orders:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch orders",
    });
  }
};

logisiticsOperation.getLogisticsOrderDetail = async (req, res) => {
  const payload = await verifyVendorToken(req);
  if (!payload?.id) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }
  if (!isLogisticsPartner(payload)) {
    return res.status(403).json({ success: false, error: "Forbidden" });
  }

  try {
    const { orderId } = req.params;
    const detail = await getLogisticsOrderDetail(orderId, payload.id);
    if (!detail) {
      return res.status(404).json({ success: false, error: "Order not found" });
    }
    return res.status(200).json({ success: true, data: detail });
  } catch (error) {
    console.error("Error fetching order detail:", error);
    return res
      .status(500)
      .json({ success: false, error: "Failed to fetch order detail" });
  }
};

logisiticsOperation.acceptLogisticsOrder = async (req, res) => {
  const payload = await verifyVendorToken(req);
  if (!payload?.id) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }
  if (!isLogisticsPartner(payload)) {
    return res.status(403).json({ success: false, error: "Forbidden" });
  }

  try {
    const result = await acceptLogisticsOrder(req.params.orderId, payload.id);
    if (!result.success) {
      return res.status(400).json(result);
    }
    return res.status(200).json({
      success: true,
      message: "Order accepted and moved to processing",
      data: result.order,
    });
  } catch (error) {
    console.error("Error accepting order:", error);
    return res
      .status(500)
      .json({ success: false, error: "Failed to accept order" });
  }
};

logisiticsOperation.declineLogisticsOrder = async (req, res) => {
  const payload = await verifyVendorToken(req);
  if (!payload?.id) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }
  if (!isLogisticsPartner(payload)) {
    return res.status(403).json({ success: false, error: "Forbidden" });
  }

  try {
    const result = await declineLogisticsOrder(req.params.orderId, payload.id);
    if (!result.success) {
      return res.status(400).json(result);
    }
    return res.status(200).json({
      success: true,
      message: result.message,
      reassigned: result.reassigned,
      data: result.order,
      new_partner: result.new_partner,
    });
  } catch (error) {
    console.error("Error declining order:", error);
    return res
      .status(500)
      .json({ success: false, error: "Failed to decline order" });
  }
};

logisiticsOperation.getLogisticsShipments = async (req, res) => {
  const payload = await verifyVendorToken(req);
  if (!payload?.id) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }
  if (!isLogisticsPartner(payload)) {
    return res.status(403).json({ success: false, error: "Forbidden" });
  }

  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
    const offset = parseInt(req.query.offset, 10) || 0;
    const orders = await getShipmentOrdersByLogisticsVendorId(payload.id, {
      limit,
      offset,
    });
    return res.status(200).json({
      success: true,
      data: orders,
      pagination: { limit, offset, count: orders.length },
    });
  } catch (error) {
    console.error("Error fetching shipments:", error);
    return res
      .status(500)
      .json({ success: false, error: "Failed to fetch shipments" });
  }
};

/* logisiticsOperation.startLogisticsShipment = async (req, res) => {
  const payload = await verifyVendorToken(req);
  if (!payload?.id) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }
  if (!isLogisticsPartner(payload)) {
    return res.status(403).json({ success: false, error: "Forbidden" });
  }

  try {
    const result = await startLogisticsShipment(req.params.orderId, payload.id);
    if (!result.success) {
      return res.status(400).json(result);
    }
    return res.status(200).json({
      success: true,
      message: "Shipment started — order is now in transit",
      data: result.order,
    });
  } catch (error) {
    console.error("Error starting shipment:", error);
    return res
      .status(500)
      .json({ success: false, error: "Failed to start shipment" });
  }
}; */

// Enhanced shipment start with full validation and confirmation
logisiticsOperation.startShipmentWithConfirmation = async (req, res) => {
  const payload = await verifyVendorToken(req);
  if (!payload?.id) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }
  if (!isLogisticsPartner(payload)) {
    return res.status(403).json({ success: false, error: "Forbidden" });
  }

  try {
    const { orderId } = req.params;
    const {
      assigned_driver_name,
      assigned_driver_phone,
      vehicle_plate_number,
      estimated_delivery_datetime,
      pickup_confirmation,
      dispatch_notes,
      pickup_location,
      delivery_location,
    } = req.body;

    // Server-side validation
    if (!assigned_driver_name || assigned_driver_name.trim().length < 2) {
      return res.status(400).json({
        success: false,
        error: "Driver name is required and must be at least 2 characters",
      });
    }

    if (!assigned_driver_phone || assigned_driver_phone.trim().length < 10) {
      return res.status(400).json({
        success: false,
        error: "Driver phone number is required and must be at least 10 digits",
      });
    }

    if (!vehicle_plate_number || vehicle_plate_number.trim().length < 3) {
      return res.status(400).json({
        success: false,
        error: "Vehicle plate number is required",
      });
    }

    if (!estimated_delivery_datetime) {
      return res.status(400).json({
        success: false,
        error: "Estimated delivery date/time is required",
      });
    }

    const deliveryDate = new Date(estimated_delivery_datetime);
    if (isNaN(deliveryDate.getTime())) {
      return res.status(400).json({
        success: false,
        error: "Invalid delivery date/time format",
      });
    }

    // Delivery must be at least 1 hour in the future
    const minDeliveryTime = new Date(Date.now() + 60 * 60 * 1000);
    if (deliveryDate < minDeliveryTime) {
      return res.status(400).json({
        success: false,
        error: "Estimated delivery time must be at least 1 hour in the future",
      });
    }

    if (!pickup_confirmation) {
      return res.status(400).json({
        success: false,
        error: "Pickup confirmation must be checked",
      });
    }

    // Handle pickup photo upload
    let pickupPhotoUrl = null;
    if (req.file) {
      const uploadResult = await saveFileToCloudinary(
        req.file,
        "logistics_pickup",
        "image",
      );
      if (!uploadResult?.secure_url) {
        return res.status(400).json({
          success: false,
          error: "Failed to upload pickup photo",
        });
      }
      pickupPhotoUrl = uploadResult.secure_url;
    } else {
      return res.status(400).json({
        success: false,
        error: "Pickup photo is required",
      });
    }

    // Verify order belongs to this logistics partner
    const order = await getLogisticsOrderForVendor(orderId, payload.id);
    if (!order) {
      return res.status(404).json({
        success: false,
        error: "Order not found or does not belong to this logistics partner",
      });
    }

    // Check if shipment already exists
    const existingShipment = await getShipmentByOrderId(orderId);
    if (existingShipment) {
      return res.status(400).json({
        success: false,
        error: "Shipment already exists for this order",
      });
    }

    // Start shipment transaction
    const shipmentResult = await startShipmentTransaction({
      order_id: orderId,
      logistics_partner_id: payload.id,
      assigned_driver_name,
      assigned_driver_phone,
      vehicle_plate_number,
      estimated_delivery_datetime,
      pickup_confirmation,
      pickup_photo_url: pickupPhotoUrl,
      dispatch_notes,
      pickup_location,
      delivery_location,
    });

    if (!shipmentResult.success) {
      return res.status(400).json(shipmentResult);
    }

    // Send shipment start email to buyer
    const emailData = {
      buyer_name: order.buyer_name,
      order_number: orderId,
      tracking_number: shipmentResult.data.tracking_number,
      driver_name: assigned_driver_name,
      driver_phone: assigned_driver_phone,
      vehicle_plate: vehicle_plate_number,
      estimated_delivery: estimated_delivery_datetime,
      delivery_otp: shipmentResult.data.delivery_otp,
      shipment_started_at: new Date().toISOString(),
      delivery_address: order.delivery_address,
    };

    const emailResult = await emailService.sendShipmentStartEmail(
      order.buyer_email,
      emailData,
    );

    if (!emailResult.success) {
      console.error("Failed to send shipment start email:", emailResult.error);
      // Don't fail the request if email fails, but log it
    }

    return res.status(200).json({
      success: true,
      message: "Shipment started successfully",
      data: {
        shipment: shipmentResult.data.shipment,
        tracking_number: shipmentResult.data.tracking_number,
        delivery_otp: shipmentResult.data.delivery_otp,
        order: {
          id: orderId,
          status: "in_transit",
        },
      },
    });
  } catch (error) {
    console.error("Error starting shipment with confirmation:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to start shipment",
    });
  }
};

// Complete delivery with OTP verification (logistics partner action)
logisiticsOperation.completeDelivery = async (req, res) => {
  const payload = await verifyVendorToken(req);
  if (!payload?.id) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }
  if (!isLogisticsPartner(payload)) {
    return res.status(403).json({ success: false, error: "Forbidden" });
  }

  try {
    const { orderId } = req.params;
    const { otp } = req.body;

    // Validate OTP
    if (!otp || otp.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: "OTP is required",
      });
    }

    if (otp.length !== 6) {
      return res.status(400).json({
        success: false,
        error: "OTP must be 6 digits",
      });
    }

    const result = await completeDeliveryWithOTP(
      orderId,
      otp.trim(),
      payload.id,
    );

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.status(200).json({
      success: true,
      message: "Delivery completed successfully",
      data: result.data,
    });
  } catch (error) {
    console.error("Error completing delivery:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to complete delivery",
    });
  }
};

logisiticsOperation.getQuoteRequests = async (req, res) => {
  const payload = await verifyVendorToken(req);
  if (!payload) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }

  const getQuote = await getQuoteRequests(payload.id);
  if (!getQuote) {
    return res
      .status(404)
      .json({ success: false, error: "No quote requests found" });
  }

  return res.status(200).json({
    success: true,
    quoteRequests: getQuote.quoteRequests,
    allQuoteRequests: getQuote.allQuoteRequests,
  });
};

logisiticsOperation.updateQuoteRequestStatus = async (req, res) => {
  try {
    const payload = await verifyVendorToken(req);
    if (!payload) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }
    const { id: requestId } = req.params;
    const status = "contacted";

    const updatedQuoteRequest = await updateQuoteRequestStatus(
      requestId,
      status,
      payload.id,
    );
    if (!updatedQuoteRequest.success) {
      return res.status(404).json({
        success: false,
        error: updatedQuoteRequest.error || "Quote request not found",
      });
    }

    return res
      .status(200)
      .json({ success: true, data: updatedQuoteRequest.data });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: "Internal server error. Try again.",
    });
  }
};

export default logisiticsOperation;
