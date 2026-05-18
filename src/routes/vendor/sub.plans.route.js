import express from "express";
import subPlansController from "../../controllers/vendor/sub.plans.controller.js";
const subPlansRoute = express.Router();

subPlansRoute.get("/plans", subPlansController.getPlans);
subPlansRoute.get("/current", subPlansController.getCurrent);
// subPlansRoute.get("/management-options", subPlansController.getManagementOptions);
subPlansRoute.get("/history", subPlansController.getHistory);
subPlansRoute.post("/initialize", subPlansController.initialize);
subPlansRoute.get("/verify", subPlansController.verifyPayment);
subPlansRoute.post("/cancel", subPlansController.cancel);
// subPlansRoute.get("/initiate-card-update", subPlansController.initiateCardUpdate);
// routes/subscription.js
subPlansRoute.get("/manage", subPlansController.getManageLink);
subPlansRoute.post("/upgrade", subPlansController.upgrade);
subPlansRoute.post("/downgrade", subPlansController.downgrade);
// subPlansRoute.post("/reactivate", subPlansController.reactivate);

export default subPlansRoute;
