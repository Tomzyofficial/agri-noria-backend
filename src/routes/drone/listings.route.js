import express from "express";
import droneController from "../../controllers/drone/listings.controller.js";
import { upload } from "../../middlewares/upload.js";

const droneRoute = express.Router();

droneRoute.post(
  "/create",
  upload.fields([{ name: "image", maxCount: 5 }]),
  droneController.createDroneListing,
);
droneRoute.get("/get-inventory", droneController.getVendorInventory);
droneRoute.get("/get-stats", droneController.getDashboardStats);
droneRoute.get("/public/listings", droneController.getPublicListings);
droneRoute.get("/quote-request", droneController.getQuoteRequests);
droneRoute.get("/get-inventory/:id", droneController.getSingleListing);
droneRoute.patch(
  "/update/:id",
  upload.fields([{ name: "image", maxCount: 5 }]),
  droneController.updateDroneListing,
);
droneRoute.delete("/delete/:id", droneController.deleteDroneListing);
droneRoute.get("/public/listings/:id", droneController.getPublicSingleListing);
droneRoute.post(
  "/quote-requests/:id/update-status",
  droneController.updateQuoteRequestStatus,
);
export default droneRoute;
