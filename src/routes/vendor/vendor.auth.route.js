import express from "express";
import vendorAuthController from "../../controllers/vendor/auth/vendor.auth.controller.js";
import { verifyVendor } from "../../controllers/vendor/auth/verify.vendor.session.controller.js";

const vendorAuthRoute = express.Router();

// vendorAuthRoute.use(requireVendorAuth);
vendorAuthRoute.get("/auth/verify-vendor", verifyVendor);

vendorAuthRoute.get("/auth/existing-user", vendorAuthController.checkExistingVendor);

vendorAuthRoute.post("/auth/vendor/register", vendorAuthController.register);

vendorAuthRoute.post("/auth/vendor/sign-in", vendorAuthController.signin);

vendorAuthRoute.post("/auth/vendor/signout", vendorAuthController.signout);

export default vendorAuthRoute;
