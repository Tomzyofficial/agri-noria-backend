import express from "express";
import emailVerificationController from "../controllers/email-verification.controller.js";

const emailRoute = express.Router();

// Send verification code
emailRoute.post("/send", emailVerificationController.sendVerificationCode);

// Verify email code
emailRoute.post("/verify", emailVerificationController.verifyCode);

// Check verification status
emailRoute.get("/status", emailVerificationController.checkStatus);

// Resend verification code
emailRoute.post("/resend", emailVerificationController.resendCode);

// Test email service (development only)
emailRoute.post("/test", emailVerificationController.testEmail);

export default emailRoute;
