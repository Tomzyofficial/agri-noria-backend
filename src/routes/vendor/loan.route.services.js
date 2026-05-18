import express from "express";
import loanControllerServices from "../../controllers/vendor/loan.controller.js";
import { upload } from "../../middlewares/upload.js";
const loanRoute = express.Router();

// Loan routes
loanRoute.post(
   "/application",
   upload.fields([
      { name: "supporting_doc", maxCount: 1 },
      { name: "bank_statement", maxCount: 1 },
   ]),
   loanControllerServices.submitLoanApplication,
);
loanRoute.get("/all", loanControllerServices.getAllLoanApplications);

loanRoute.post("/initialize/:loanId", loanControllerServices.initialize);

loanRoute.post("/verify", loanControllerServices.verifyPayment);

export default loanRoute;
