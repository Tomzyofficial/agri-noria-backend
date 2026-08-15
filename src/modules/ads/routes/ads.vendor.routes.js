import express from "express";
import { requireVendor } from "../middleware/requireVendor.middleware.js";
import { adsVendorController } from "../controllers/ads.vendor.controller.js";

const adsRoute = express.Router();

adsRoute.use(requireVendor);

adsRoute.get("/summary", (req, res) => adsVendorController.summary(req, res));
adsRoute.get("/verify-payment", (req, res) =>
  adsVendorController.verifyPayment(req, res),
);

adsRoute.post("/campaigns/create", (req, res) =>
  adsVendorController.create(req, res),
);
adsRoute.get("/campaigns", (req, res) => adsVendorController.list(req, res));
adsRoute.get("/campaigns/:campaignId", (req, res) =>
  adsVendorController.getOne(req, res),
);
adsRoute.patch("/campaigns/:campaignId", (req, res) =>
  adsVendorController.update(req, res),
);
adsRoute.patch("/campaigns/:campaignId/pause", (req, res) =>
  adsVendorController.pause(req, res),
);
adsRoute.get("/campaigns/:campaignId/activate", (req, res) =>
  adsVendorController.activate(req, res),
);
adsRoute.delete("/campaigns/:campaignId", (req, res) =>
  adsVendorController.remove(req, res),
);

export default adsRoute;
