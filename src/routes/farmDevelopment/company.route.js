import { Router } from "express";
import companyController from "../../controllers/farm-development/company.controller.js";

const companyRouter = Router();

// GET /api/market-place/company?id=
companyRouter.get("/", companyController.getCompany);

// POST /api/market-place/company
companyRouter.post("/", companyController.createCompany);

// PATCH /api/market-place/company
companyRouter.patch("/", companyController.updateCompany);

export default companyRouter;
