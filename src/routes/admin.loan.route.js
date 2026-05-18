import express from "express";
import { disburseLoanController, getLoans } from "../controllers/admin.loan.controller.js";
const adminRoute = express.Router();

adminRoute.post("/api/loan/:loanId/disburse", disburseLoanController);

adminRoute.get("/api/loans", getLoans);

export default adminRoute;
