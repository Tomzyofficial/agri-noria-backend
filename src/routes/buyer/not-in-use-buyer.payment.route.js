import express from "express";
import {
  initializeBuyerPayment,
  verifyBuyerPayment,
} from "../../controllers/buyer/not-in-use-buyer.payment.controller.js";

const buyerPaymentRoute = express.Router();

buyerPaymentRoute.post("/initialize", initializeBuyerPayment);
buyerPaymentRoute.get("/verify", verifyBuyerPayment);

export default buyerPaymentRoute;
