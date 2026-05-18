import express from "express";
import marketplaceController from "../controllers/marketplace.controller.js";
import marketplaceStorageController from "../controllers/marketplace.storage.controller.js";
const marketplaceRoute = express.Router();

// Get all marketplace products farmer and seller
marketplaceRoute.get("/marketplace", marketplaceController.getAllMarketProducts);

// Get all marketplace listed storage
marketplaceRoute.get("/marketplace/listed-storage", marketplaceStorageController.getAllStorage);

// Get single listed storage by ID
// marketplaceRoute.get("/api/marketplace/listed-storage/:id", marketplaceStorageController.getSingleStorage);

// Get single listed storage by href (name)
marketplaceRoute.get("/marketplace/listed-storage/:href", marketplaceStorageController.getSingleStorageByHref);

// Get single marketplace product details farmer and seller
marketplaceRoute.get("/marketplace/:id", marketplaceController.getSingleProduct);

// Get product reviews farmer and seller
marketplaceRoute.get("/marketplace/:id/reviews", marketplaceController.getProductReviews);

// Submit or update a review for a specific product listing farmer and seller
marketplaceRoute.post("/marketplace/:id/reviews", marketplaceController.submitReview);

export default marketplaceRoute;
