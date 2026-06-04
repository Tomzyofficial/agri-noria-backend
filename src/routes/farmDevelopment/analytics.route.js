import { Router } from "express";
import analyticsController from "../../controllers/farmDevelopment/analytics.controller.js";

const analyticsRouter = Router();

// GET /api/market-place/analytics?companyId=
analyticsRouter.get("/", analyticsController.getAnalytics);

export default analyticsRouter;
