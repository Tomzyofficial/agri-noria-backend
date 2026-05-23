import { z } from "zod";
import {
  createShipment,
  getShipmentById,
  getShipmentByOrderId,
  getShipmentsByCompanyId,
  getShipmentsByDriverId,
  updateShipmentStatus,
  assignLogisticsToShipment,
  updateShipmentLocation,
  generateTrackingNumber,
  getShipmentByTrackingNumber,
  createTrackingEvent,
  getTrackingEvents,
  getCompanyShipmentStats,
  getDriverShipmentStats,
} from "../../db/vendor/logistics.db.js";

// Zod schema for shipment creation
const shipmentSchema = z.object({
  order_id: z.string().uuid("Invalid order ID"),
  logistics_company_id: z
    .string()
    .uuid("Invalid logistics company ID")
    .optional(),
  vehicle_id: z.string().uuid("Invalid vehicle ID").optional(),
  driver_id: z.string().uuid("Invalid driver ID").optional(),
  status: z
    .enum([
      "pending",
      "assigned",
      "picked_up",
      "in_transit",
      "delivered",
      "cancelled",
    ])
    .default("pending"),
  pickup_location: z.string().min(1, "Pickup location is required"),
  pickup_coordinates: z
    .object({
      lat: z.number(),
      lng: z.number(),
    })
    .optional(),
  pickup_scheduled_time: z.string().datetime().optional(),
  delivery_location: z.string().min(1, "Delivery location is required"),
  delivery_coordinates: z
    .object({
      lat: z.number(),
      lng: z.number(),
    })
    .optional(),
  estimated_delivery_time: z.string().datetime().optional(),
  notes: z.string().optional(),
  metadata: z.record(z.any()).optional().default({}),
});

// Create a new shipment
export async function createShipmentController(req, res) {
  try {
    const validatedData = shipmentSchema.parse(req.body);

    const shipment = await createShipment(validatedData);

    // Generate tracking number
    const shipmentWithTracking = await generateTrackingNumber(shipment.id);

    res.status(201).json({
      success: true,
      message: "Shipment created successfully",
      data: shipmentWithTracking,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: error.errors,
      });
    }

    console.error("Error creating shipment:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create shipment",
      error: error.message,
    });
  }
}

// Get shipment by ID
export async function getShipmentByIdController(req, res) {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Shipment ID is required",
      });
    }

    const shipment = await getShipmentById(id);

    if (!shipment) {
      return res.status(404).json({
        success: false,
        message: "Shipment not found",
      });
    }

    res.status(200).json({
      success: true,
      data: shipment,
    });
  } catch (error) {
    console.error("Error getting shipment:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get shipment",
      error: error.message,
    });
  }
}

// Get shipment by order ID
export async function getShipmentByOrderIdController(req, res) {
  try {
    const { order_id } = req.params;

    if (!order_id) {
      return res.status(400).json({
        success: false,
        message: "Order ID is required",
      });
    }

    const shipment = await getShipmentByOrderId(order_id);

    if (!shipment) {
      return res.status(404).json({
        success: false,
        message: "Shipment not found for this order",
      });
    }

    res.status(200).json({
      success: true,
      data: shipment,
    });
  } catch (error) {
    console.error("Error getting shipment by order:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get shipment",
      error: error.message,
    });
  }
}

// Get shipments by logistics company ID
export async function getCompanyShipmentsController(req, res) {
  try {
    const { company_id } = req.params;
    const status = req.query.status;
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    if (!company_id) {
      return res.status(400).json({
        success: false,
        message: "Company ID is required",
      });
    }

    const shipments = await getShipmentsByCompanyId(
      company_id,
      status,
      limit,
      offset,
    );

    res.status(200).json({
      success: true,
      data: shipments,
      pagination: {
        limit,
        offset,
        count: shipments.length,
      },
    });
  } catch (error) {
    console.error("Error getting company shipments:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get company shipments",
      error: error.message,
    });
  }
}

// Get shipments by driver ID
export async function getDriverShipmentsController(req, res) {
  try {
    const { driver_id } = req.params;
    const status = req.query.status;
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    if (!driver_id) {
      return res.status(400).json({
        success: false,
        message: "Driver ID is required",
      });
    }

    const shipments = await getShipmentsByDriverId(
      driver_id,
      status,
      limit,
      offset,
    );

    res.status(200).json({
      success: true,
      data: shipments,
      pagination: {
        limit,
        offset,
        count: shipments.length,
      },
    });
  } catch (error) {
    console.error("Error getting driver shipments:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get driver shipments",
      error: error.message,
    });
  }
}

// Update shipment status
export async function updateShipmentStatusController(req, res) {
  try {
    const { id } = req.params;
    const {
      status,
      pickup_completed_at,
      actual_delivery_time,
      current_location,
      current_coordinates,
      notes,
    } = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Shipment ID is required",
      });
    }

    if (!status) {
      return res.status(400).json({
        success: false,
        message: "Status is required",
      });
    }

    const validStatuses = [
      "pending",
      "assigned",
      "picked_up",
      "in_transit",
      "delivered",
      "cancelled",
    ];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status value",
      });
    }

    const shipment = await updateShipmentStatus(id, status, {
      pickup_completed_at,
      actual_delivery_time,
      current_location,
      current_coordinates,
      notes,
    });

    if (!shipment) {
      return res.status(404).json({
        success: false,
        message: "Shipment not found",
      });
    }

    // Create tracking event
    await createTrackingEvent({
      shipment_id: id,
      event_type: "status_update",
      event_status: status,
      location: current_location,
      coordinates: current_coordinates,
      event_notes: notes,
    });

    res.status(200).json({
      success: true,
      message: "Shipment status updated successfully",
      data: shipment,
    });
  } catch (error) {
    console.error("Error updating shipment status:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update shipment status",
      error: error.message,
    });
  }
}

// Assign logistics to shipment
export async function assignLogisticsToShipmentController(req, res) {
  try {
    const { id } = req.params;
    const { logistics_company_id, vehicle_id, driver_id } = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Shipment ID is required",
      });
    }

    if (!logistics_company_id || !vehicle_id || !driver_id) {
      return res.status(400).json({
        success: false,
        message: "Logistics company, vehicle, and driver IDs are required",
      });
    }

    const shipment = await assignLogisticsToShipment(
      id,
      logistics_company_id,
      vehicle_id,
      driver_id,
    );

    if (!shipment) {
      return res.status(404).json({
        success: false,
        message: "Shipment not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Logistics assigned successfully",
      data: shipment,
    });
  } catch (error) {
    console.error("Error assigning logistics:", error);
    res.status(500).json({
      success: false,
      message: "Failed to assign logistics",
      error: error.message,
    });
  }
}

// Update shipment location (tracking)
export async function updateShipmentLocationController(req, res) {
  try {
    const { id } = req.params;
    const { location, coordinates } = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Shipment ID is required",
      });
    }

    if (!location || !coordinates) {
      return res.status(400).json({
        success: false,
        message: "Location and coordinates are required",
      });
    }

    const shipment = await updateShipmentLocation(id, location, coordinates);

    if (!shipment) {
      return res.status(404).json({
        success: false,
        message: "Shipment not found",
      });
    }

    // Create tracking event
    await createTrackingEvent({
      shipment_id: id,
      event_type: "location_update",
      event_status: "in_transit",
      location,
      coordinates,
    });

    res.status(200).json({
      success: true,
      message: "Shipment location updated successfully",
      data: shipment,
    });
  } catch (error) {
    console.error("Error updating shipment location:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update shipment location",
      error: error.message,
    });
  }
}

// Get shipment by tracking number
export async function getShipmentByTrackingNumberController(req, res) {
  try {
    const { tracking_number } = req.params;

    if (!tracking_number) {
      return res.status(400).json({
        success: false,
        message: "Tracking number is required",
      });
    }

    const shipment = await getShipmentByTrackingNumber(tracking_number);

    if (!shipment) {
      return res.status(404).json({
        success: false,
        message: "Shipment not found",
      });
    }

    res.status(200).json({
      success: true,
      data: shipment,
    });
  } catch (error) {
    console.error("Error getting shipment by tracking number:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get shipment",
      error: error.message,
    });
  }
}

// Get tracking events for shipment
export async function getTrackingEventsController(req, res) {
  try {
    const { shipment_id } = req.params;
    const limit = parseInt(req.query.limit) || 100;

    if (!shipment_id) {
      return res.status(400).json({
        success: false,
        message: "Shipment ID is required",
      });
    }

    const events = await getTrackingEvents(shipment_id, limit);

    res.status(200).json({
      success: true,
      data: events,
      count: events.length,
    });
  } catch (error) {
    console.error("Error getting tracking events:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get tracking events",
      error: error.message,
    });
  }
}

// Get company shipment statistics
export async function getCompanyShipmentStatsController(req, res) {
  try {
    const { company_id } = req.params;

    if (!company_id) {
      return res.status(400).json({
        success: false,
        message: "Company ID is required",
      });
    }

    const stats = await getCompanyShipmentStats(company_id);

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error("Error getting company shipment stats:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get company shipment statistics",
      error: error.message,
    });
  }
}

// Get driver shipment statistics
export async function getDriverShipmentStatsController(req, res) {
  try {
    const { driver_id } = req.params;

    if (!driver_id) {
      return res.status(400).json({
        success: false,
        message: "Driver ID is required",
      });
    }

    const stats = await getDriverShipmentStats(driver_id);

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error("Error getting driver shipment stats:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get driver shipment statistics",
      error: error.message,
    });
  }
}
