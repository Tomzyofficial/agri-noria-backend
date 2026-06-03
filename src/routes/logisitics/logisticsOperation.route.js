import express from "express";
import { upload } from "../../middlewares/upload.js";
import logisiticsOperationController from "../../controllers/logistics/logisiticsOperation.controller.js";

const logisticsOperationRoute = express.Router();

logisticsOperationRoute.post(
  "/add-vehicle",
  upload.single("images"),
  logisiticsOperationController.addVehicle,
);

logisticsOperationRoute.get(
  "/public/vehicles",
  logisiticsOperationController.getListedVehicles,
);

logisticsOperationRoute.get(
  "/vehicles",
  logisiticsOperationController.getVehicles,
);

logisticsOperationRoute.get(
  "/near-buyer",
  logisiticsOperationController.getLogisticsProvidersNearBuyer,
);

logisticsOperationRoute.get(
  "/orders/stats",
  logisiticsOperationController.getLogisticsOrderStats,
);

logisticsOperationRoute.get(
  "/orders",
  logisiticsOperationController.getLogisticsOrders,
);

logisticsOperationRoute.get(
  "/orders/:orderId/detail",
  logisiticsOperationController.getLogisticsOrderDetail,
);

logisticsOperationRoute.post(
  "/orders/:orderId/accept",
  logisiticsOperationController.acceptLogisticsOrder,
);

logisticsOperationRoute.post(
  "/orders/:orderId/decline",
  logisiticsOperationController.declineLogisticsOrder,
);

logisticsOperationRoute.get(
  "/shipments",
  logisiticsOperationController.getLogisticsShipments,
);

// logisticsOperationRoute.post(
//   "/orders/:orderId/start-shipment",
//   logisiticsOperationController.startLogisticsShipment,
// );

logisticsOperationRoute.post(
  "/orders/:orderId/start-shipment-confirm",
  upload.single("pickup_photo"),
  logisiticsOperationController.startShipmentWithConfirmation,
);

logisticsOperationRoute.post(
  "/orders/:orderId/complete-delivery",
  logisiticsOperationController.completeDelivery,
);

logisticsOperationRoute.get(
  "/quote-requests",
  logisiticsOperationController.getQuoteRequests,
);

logisticsOperationRoute.post(
  "/quote-requests/:id/update-status",
  logisiticsOperationController.updateQuoteRequestStatus,
);

export default logisticsOperationRoute;
