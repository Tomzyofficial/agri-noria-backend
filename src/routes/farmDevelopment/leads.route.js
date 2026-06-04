import { Router } from "express";
import leadsController from "../../controllers/farm-development/leads.controller.js";

const leadsRouter = Router();

// GET /api/market-place/leads
leadsRouter.get("/", leadsController.getLeads);

// POST /api/market-place/leads
leadsRouter.post("/", leadsController.createLead);

// GET /api/market-place/leads/:id
leadsRouter.get("/:id", leadsController.getLeadById);

// PATCH /api/market-place/leads/:id
leadsRouter.patch("/:id", leadsController.updateLeadStatus);

// DELETE /api/market-place/leads/:id
leadsRouter.delete("/:id", leadsController.deleteLead);

export default leadsRouter;
