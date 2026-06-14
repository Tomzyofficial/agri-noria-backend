import { Router } from "express";
import publicFarmDevelopmentController from "../../controllers/farmDevelopment/public.controller.js";

const publicFarmDevelopmentRoute = Router();

// Get services with optional category and search filters
publicFarmDevelopmentRoute.get(
  "/service-list",
  publicFarmDevelopmentController.getServices,
);

// submit booking request
publicFarmDevelopmentRoute.post(
  "/booking-request/:id",
  publicFarmDevelopmentController.submitBookingRequest,
);

// Get all categories with service counts
// publicFarmDevelopmentRoute.get(
//   "/categories",
//   publicFarmDevelopmentController.getCategories,
// );

// Get a single provider by ID with their services and portfolio
publicFarmDevelopmentRoute.get(
  "/providers/:businessName",
  publicFarmDevelopmentController.getProviderById,
);
export default publicFarmDevelopmentRoute;
