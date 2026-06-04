import { Router } from "express";
import listingsController from "../../controllers/farm-development/listings.controller.js";

const listingsRouter = Router();

// GET /api/market-place/listings
listingsRouter.get("/", listingsController.getListings);

// POST /api/market-place/listings
listingsRouter.post("/", listingsController.createListing);

// GET /api/market-place/listings/:id
listingsRouter.get("/:id", listingsController.getListingById);

// PATCH /api/market-place/listings/:id
listingsRouter.patch("/:id", listingsController.updateListing);

// DELETE /api/market-place/listings/:id
listingsRouter.delete("/:id", listingsController.deleteListing);

export default listingsRouter;
