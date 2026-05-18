import express from "express";
import institutionAdminController from "../../controllers/admin/institution.admin.controller.js";

const institutionAdminRoute = express.Router();

// Institution analytics
institutionAdminRoute.get("/analytics", institutionAdminController.getAnalytics);
institutionAdminRoute.get("/transactions", institutionAdminController.getTransactions);

// Input Approvals & Assignments
institutionAdminRoute.get("/pending-requests", institutionAdminController.getPendingRequests);
institutionAdminRoute.get("/distributors", institutionAdminController.getDistributors);
institutionAdminRoute.post("/approve-funds", institutionAdminController.approveFunds);
institutionAdminRoute.post("/assign-distributor", institutionAdminController.assignDistributor);

export default institutionAdminRoute;
