import { Router } from "express";
import analyticsController from "../../controllers/farm-development/analytics.controller.js";

const analyticsRouter = Router();

// GET /api/market-place/analytics?companyId=
analyticsRouter.get("/", analyticsController.getAnalytics);

export default analyticsRouter;
