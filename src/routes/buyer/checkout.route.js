import express from "express";
import { getCheckoutData } from "../../controllers/buyer/checkout.controller.js";
const checkoutRoute = express.Router();

// Changed route to accept POST requests
checkoutRoute.post("/checkout", getCheckoutData);

export default checkoutRoute;
