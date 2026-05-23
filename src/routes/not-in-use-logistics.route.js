import express from 'express';
import {
  createShipmentController,
  getShipmentByIdController,
  getShipmentByOrderIdController,
  getCompanyShipmentsController,
  getDriverShipmentsController,
  updateShipmentStatusController,
  assignLogisticsToShipmentController,
  updateShipmentLocationController,
  getShipmentByTrackingNumberController,
  getTrackingEventsController,
  getCompanyShipmentStatsController,
  getDriverShipmentStatsController
} from '../controllers/logistics.controller.js';

const logisticsRoute = express.Router();

// Create a new shipment
logisticsRoute.post('/shipments/create', createShipmentController);

// Get shipment by ID
logisticsRoute.get('/shipments/:id', getShipmentByIdController);

// Get shipment by order ID
logisticsRoute.get('/shipments/order/:order_id', getShipmentByOrderIdController);

// Get shipments by logistics company ID
logisticsRoute.get('/shipments/company/:company_id', getCompanyShipmentsController);

// Get shipments by driver ID
logisticsRoute.get('/shipments/driver/:driver_id', getDriverShipmentsController);

// Update shipment status
logisticsRoute.put('/shipments/:id/status', updateShipmentStatusController);

// Assign logistics to shipment
logisticsRoute.put('/shipments/:id/assign-logistics', assignLogisticsToShipmentController);

// Update shipment location (tracking)
logisticsRoute.put('/shipments/:id/location', updateShipmentLocationController);

// Get shipment by tracking number
logisticsRoute.get('/shipments/tracking/:tracking_number', getShipmentByTrackingNumberController);

// Get tracking events for shipment
logisticsRoute.get('/shipments/:shipment_id/tracking-events', getTrackingEventsController);

// Get company shipment statistics
logisticsRoute.get('/shipments/company/:company_id/stats', getCompanyShipmentStatsController);

// Get driver shipment statistics
logisticsRoute.get('/shipments/driver/:driver_id/stats', getDriverShipmentStatsController);

export default logisticsRoute;
