import { Router } from "express";
import listingsController from "../../controllers/farmDevelopment/listings.controller.js";
import analyticsController from "../../controllers/farmDevelopment/analytics.controller.js";
import portfolioController from "../../controllers/farmDevelopment/portfolio.controller.js";
import { upload } from "../../middlewares/upload.js";

const listingsRoute = Router();

listingsRoute.post(
  "/create-listing",
  upload.fields([
    { name: "featured_image", maxCount: 1 },
    { name: "gallery_images", maxCount: 10 },
  ]),
  listingsController.createListing,
);

listingsRoute.get("/get-listings", listingsController.getListings);

listingsRoute.get("/analytics", analyticsController.getAnalyticsCount);
listingsRoute.post(
  "/create-portfolio",
  upload.fields([
    { name: "featured_image", maxCount: 1 },
    { name: "gallery_images", maxCount: 10 },
  ]),
  portfolioController.createPortfolioProject,
);
listingsRoute.get("/get-portfolios", portfolioController.getPortfolioProjects);

listingsRoute.get(
  "/portfolio/:id",
  portfolioController.getPortfolioProjectById,
);

listingsRoute.delete(
  "/portfolio/delete/:id",
  portfolioController.deletePortfolioProject,
);

listingsRoute.get("/listing/:id", listingsController.getListingById);

listingsRoute.patch(
  "/listing/update/:id",
  upload.fields([
    { name: "featured_image", maxCount: 1 },
    { name: "gallery_images", maxCount: 10 },
  ]),
  listingsController.updateListing,
);

listingsRoute.delete("/listing/delete/:id", listingsController.deleteListing);

export default listingsRoute;
