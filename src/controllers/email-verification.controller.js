import { z } from "zod";
import emailService from "../services/email/email.service.js";
import {
  createEmailVerification,
  verifyEmailCode,
  getVerificationStatus,
  isEmailVerified,
  cleanupExpiredVerifications,
} from "../db/email-verification.db.js";

// Validation schemas
const sendVerificationSchema = z.object({
  email: z.string().email("Invalid email address"),
  userType: z.enum(["vendor", "buyer"], {
    required_error: "User type is required",
  }),
});

const verifyCodeSchema = z.object({
  email: z.string().email("Invalid email address"),
  userType: z.enum(["vendor", "buyer"], {
    required_error: "User type is required",
  }),
  verificationCode: z.string().length(6, "Verification code must be 6 digits"),
});

const emailVerificationController = {};

// Send verification code
emailVerificationController.sendVerificationCode = async (req, res) => {
  try {
    // Validate input
    const validatedData = sendVerificationSchema.parse(req.body);
    const { email, userType } = validatedData;

    // Check if email is already verified
    const alreadyVerified = await isEmailVerified(email, userType);
    if (alreadyVerified) {
      return res.status(400).json({
        success: false,
        error: "Email is already verified",
        code: "ALREADY_VERIFIED",
      });
    }

    // Generate verification code
    const verificationCode = emailService.generateVerificationCode();
    const verificationCodeHash =
      emailService.hashVerificationCode(verificationCode);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Store verification in database
    await createEmailVerification(
      email,
      userType,
      verificationCodeHash,
      expiresAt,
    );

    // Send verification email
    const emailResult = await emailService.sendVerificationEmail(
      email,
      verificationCode,
    );

    if (!emailResult.success) {
      console.error(
        "error handled in if statement email controller",
        emailResult.error,
      );
      return res.status(500).json({
        success: false,
        error: "Failed to send verification email",
        details: emailResult.error,
      });
    }

    // Clean up expired codes (optional housekeeping)
    try {
      await cleanupExpiredVerifications();
    } catch (cleanupError) {
      console.error("Error cleaning up expired verifications:", cleanupError);
      // Don't fail the request if cleanup fails
    }

    return res.status(200).json({
      success: true,
      message: "Verification code sent successfully",
      expiresAt: expiresAt.toISOString(),
      // Don't include the code in response for security
    });
  } catch (error) {
    console.error("Error sending verification code from controller:", error);

    if (error.name === "ZodError") {
      return res.status(400).json({
        success: false,
        error: "Invalid input data",
        details: error.errors,
      });
    }

    return res.status(500).json({
      success: false,
      error: "Internal server error. Try again later.",
    });
  }
};

// Verify email code
emailVerificationController.verifyCode = async (req, res) => {
  try {
    // Validate input
    const validatedData = verifyCodeSchema.parse(req.body);
    const { email, userType, verificationCode } = validatedData;

    // Verify the code
    const verificationResult = await verifyEmailCode(
      email,
      userType,
      verificationCode,
    );

    if (!verificationResult.success) {
      return res.status(400).json({
        success: false,
        error: verificationResult.error,
        code: "VERIFICATION_FAILED",
      });
    }

    // Mark email as verified in user table
    /*  const userRecord = await markEmailAsVerified(email, userType);

      if (!userRecord) {
         return res.status(404).json({
            success: false,
            error: "User not found",
            code: "USER_NOT_FOUND",
         });
      }

      // Send welcome email
      try {
         const userName = userType === "vendor" ? `${userRecord.fname} ${userRecord.lname}` : userRecord.name;

         await emailService.sendWelcomeEmail(email, userName, userType);
      } catch (welcomeError) {
         console.error("Error sending welcome email:", welcomeError);
         // Don't fail the verification if welcome email fails
      } */

    return res.status(200).json({
      success: true,
      message: "Email verified successfully",
      // user: {
      //    id: userType === "vendor" ? userRecord.id : userRecord.buyer_id,
      //    email: userRecord.email,
      //    name: userType === "vendor" ? `${userRecord.fname} ${userRecord.lname}` : userRecord.name,
      // },
    });
  } catch (error) {
    console.error("Error verifying code:", error);

    if (error.name === "ZodError") {
      return res.status(400).json({
        success: false,
        error: "Invalid input data",
        details: error.errors,
      });
    }

    return res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
};

// Check verification status
emailVerificationController.checkStatus = async (req, res) => {
  try {
    const { email, userType } = req.query;

    if (!email || !userType) {
      return res.status(400).json({
        success: false,
        error: "Email and userType are required",
      });
    }

    const status = await getVerificationStatus(email, userType);

    return res.status(200).json({
      success: true,
      data: status,
    });
  } catch (error) {
    console.error("Error checking verification status:", error);
    return res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
};

// Resend verification code
emailVerificationController.resendCode = async (req, res) => {
  try {
    const validatedData = sendVerificationSchema.parse(req.body);
    const { email, userType } = validatedData;

    // Check if email is already verified
    const alreadyVerified = await isEmailVerified(email, userType);
    if (alreadyVerified) {
      return res.status(400).json({
        success: false,
        error: "Email is already verified",
        code: "ALREADY_VERIFIED",
      });
    }

    // Get existing verification status
    const status = await getVerificationStatus(email, userType);

    // Rate limiting: Check if there was a recent request (within 1 minute)
    if (status.hasVerification && status.createdAt) {
      const timeSinceLastRequest =
        Date.now() - new Date(status.createdAt).getTime();
      if (timeSinceLastRequest < 60 * 1000) {
        // 1 minute
        return res.status(429).json({
          success: false,
          error:
            "Please wait for 1 minute before requesting another verification code",
          retryAfter: Math.ceil((60 * 1000 - timeSinceLastRequest) / 1000),
        });
      }
    }

    // Generate new verification code
    const verificationCode = emailService.generateVerificationCode();
    const verificationCodeHash =
      emailService.hashVerificationCode(verificationCode);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Store verification in database
    await createEmailVerification(
      email,
      userType,
      verificationCodeHash,
      expiresAt,
    );

    // Send verification email
    const emailResult = await emailService.sendVerificationEmail(
      email,
      verificationCode,
    );

    if (!emailResult.success) {
      return res.status(500).json({
        success: false,
        error: "Failed to send verification email",
        details: emailResult.error,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Verification code resent successfully",
      expiresAt: expiresAt.toISOString(),
    });
  } catch (error) {
    console.error("Error resending verification code:", error);

    if (error.name === "ZodError") {
      return res.status(400).json({
        success: false,
        error: "Invalid input data",
        details: error.errors,
      });
    }

    return res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
};

// Test email service (for development)
emailVerificationController.testEmail = async (req, res) => {
  try {
    if (process.env.NODE_ENV === "production") {
      return res.status(403).json({
        success: false,
        error: "Email testing not available in production",
      });
    }

    const result = await emailService.testConfiguration();

    return res.status(200).json({
      success: result.success,
      message: result.success
        ? "Test email sent successfully"
        : "Test email failed",
      details: result.error || null,
    });
  } catch (error) {
    console.error("Error testing email service:", error);
    return res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
};

export default emailVerificationController;
