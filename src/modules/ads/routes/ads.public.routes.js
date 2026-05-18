/**
 * Public ads + tracking routes.
 * @module modules/ads/routes/ads.public.routes
 */

import express from "express";
import { optionalViewer } from "../middleware/optionalViewer.middleware.js";
import { adsPublicController } from "../controllers/ads.public.controller.js";
import { adsTrackingController } from "../controllers/ads.tracking.controller.js";

const router = express.Router();

router.get("/public/active", (req, res) => adsPublicController.activeCampaigns(req, res));
router.get("/public/catalog", (req, res) => adsPublicController.boostedCatalog(req, res));

router.post("/track/impression", optionalViewer, (req, res) => adsTrackingController.impression(req, res));
router.post("/track/click", optionalViewer, (req, res) => adsTrackingController.click(req, res));

export default router;
