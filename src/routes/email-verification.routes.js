import express from "express";
import emailVerificationController from "../controllers/email-verification.controller.js";

const router = express.Router();

// Send verification code
router.post("/send", emailVerificationController.sendVerificationCode);

// Verify email code
router.post("/verify", emailVerificationController.verifyCode);

// Check verification status
router.get("/status", emailVerificationController.checkStatus);

// Resend verification code
router.post("/resend", emailVerificationController.resendCode);

// Test email service (development only)
router.post("/test", emailVerificationController.testEmail);

export default router;
