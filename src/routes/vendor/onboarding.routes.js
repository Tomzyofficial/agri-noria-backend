import express from "express";
import { submitLevel1, submitLevel2, submitLevel3 } from "../../controllers/vendor/onboarding.controller.js";
import { verifyVendorToken } from "../../sessions/vendor.auth.session.js";

const onboardingRoute = express.Router();

// Middleware to protect these routes
onboardingRoute.use(async (req, res, next) => {
    try {
        const user = await verifyVendorToken(req);
        if (!user) return res.status(401).json({ success: false, error: "Unauthorized" });
        req.user = user;
        next();
    } catch (e) {
        return res.status(401).json({ success: false, error: "Unauthorized" });
    }
});

onboardingRoute.post("/level1", submitLevel1);
onboardingRoute.post("/level2", submitLevel2);
onboardingRoute.post("/level3", submitLevel3);

export default onboardingRoute;
