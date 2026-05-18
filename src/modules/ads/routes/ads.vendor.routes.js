/**
 * Vendor-authenticated ads routes.
 * @module modules/ads/routes/ads.vendor.routes
 */

import express from "express";
import { requireVendor } from "../middleware/requireVendor.middleware.js";
import { adsVendorController } from "../controllers/ads.vendor.controller.js";

const router = express.Router();

router.use(requireVendor);

router.get("/summary", (req, res) => adsVendorController.summary(req, res));
router.get("/verify-payment", (req, res) => adsVendorController.verifyPayment(req, res));

router.post("/campaigns", (req, res) => adsVendorController.create(req, res));
router.get("/campaigns", (req, res) => adsVendorController.list(req, res));
router.get("/campaigns/:campaignId", (req, res) => adsVendorController.getOne(req, res));
router.patch("/campaigns/:campaignId", (req, res) => adsVendorController.update(req, res));
router.post("/campaigns/:campaignId/pause", (req, res) => adsVendorController.pause(req, res));
router.post("/campaigns/:campaignId/activate", (req, res) => adsVendorController.activate(req, res));
router.delete("/campaigns/:campaignId", (req, res) => adsVendorController.remove(req, res));

export default router;
