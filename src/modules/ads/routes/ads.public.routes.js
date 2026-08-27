import express from "express";
import { optionalViewer } from "../middleware/optionalViewer.middleware.js";
// import { adsPublicController } from "../controllers/ads.public.controller.js";
import { adsTrackingController } from "../controllers/ads.tracking.controller.js";

import {
  adPublic,
  //   adPublicHome,
} from "../controllers/ads.public.controller.js";

const adsPublicRoute = express.Router();

// adsPublicRoute.get("/public/active", (req, res) =>
//   adsPublicController.activeCampaigns(req, res),
// );
// adsPublicRoute.get("/public/catalog", (req, res) =>
//   adsPublicController.boostedCatalog(req, res),
// );

adsPublicRoute.post("/track/impression", optionalViewer, (req, res) =>
  adsTrackingController.impression(req, res),
);
adsPublicRoute.post("/track/click", optionalViewer, (req, res) =>
  adsTrackingController.click(req, res),
);

adsPublicRoute.get(
  "/campaigns/home-drone-marketplace",
  adPublic.activeDroneHomeCampaigns,
);

// adsPublicRoute.get("/campaigns/home", adPublic.activeHomeCampaigns);

export default adsPublicRoute;
