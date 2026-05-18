import express from "express";
import { verifyBuyer } from "../../controllers/buyer/auth/verify.buyer.session.controller.js";
import buyerAuthController from "../../controllers/buyer/auth/buyer.auth.controller.js";
const buyerAuthRoute = express.Router();

buyerAuthRoute.get("/auth/verify-buyer", verifyBuyer);

buyerAuthRoute.post("/auth/buyer/register", buyerAuthController.register);

buyerAuthRoute.post("/auth/buyer/signin", buyerAuthController.signin);

buyerAuthRoute.post("/auth/buyer/signout", buyerAuthController.signout);

export default buyerAuthRoute;
