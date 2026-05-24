import express from "express";
import { upload } from "../../middlewares/upload.js";
import logisiticsOperationController from "../../controllers/vendor/logistics/logisiticsOperation.controller.js";

const logisticsOperationRoute = express.Router();

logisticsOperationRoute.post(
  "/add-vehicle",
  upload.single("images"),
  logisiticsOperationController.addVehicle,
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

export default logisticsOperationRoute;
