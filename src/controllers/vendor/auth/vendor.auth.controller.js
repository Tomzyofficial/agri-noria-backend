import bcrypt from "bcryptjs";
import {
  getUserByEmail,
  createUser,
  createFarmerProfile,
  createFieldOperationsDocuments
} from "../../../db/vendor/vendor.auth.db.js";
import {
  createVendorSession,
  deleteVendorSession,
  verifyVendorToken,
} from "../../../sessions/vendor.auth.session.js";
import { countryUtils } from "../../../db/country.utils.db.js";
// import {
//   deleteVerificationRecord,
//   isEmailVerified,
// } from "../../../db/email-verification.db.js";
// import emailService from "../../../services/email/email.service.js";

const vendorAuthController = {};
// Cron job to check if vendor in payload exist in db
vendorAuthController.checkExistingVendor = async (req, res) => {
  try {
    const payload = await verifyVendorToken(req);
    if (!payload) {
      return res.status(401).json({ existing: false, error: "Unauthorized" });
    }
    const user = await getUserByEmail(payload?.email);
    if (!user) {
      return res
        .status(404)
        .json({ existing: false, error: "User doesn't exist in db" });
    }
    return res
      .status(200)
      .json({ existing: true, message: "User exist in db" });
  } catch {
    return res
      .status(500)
      .json({ existing: false, error: "Internal server error" });
  }
};

vendorAuthController.signin = async (req, res) => {
  const errors = [];
  const { email, password, rememberMe } = req.body;

  // Validate required fields
  if (!email) errors.push("Email address is required");
  if (!password) errors.push("Password is required");

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      error: errors,
    });
  }

  try {
    const normalizedEmail = email.toLowerCase();
    // Check if vendor exists
    const vendor = await getUserByEmail(normalizedEmail);

    if (!vendor) {
      return res.status(404).json({
        success: false,
        error: ["You have provided incorrect credentials"],
      });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, vendor.pword);

    if (!isPasswordValid) {
      return res.status(400).json({
        success: false,
        error: ["Invalid email or password"],
      });
    }

    // Check if suspended
    if (vendor.is_suspended) {
      return res.status(403).json({
        success: false,
        error: ["Your account has been suspended. Please contact support."],
      });
    }

    // Create session (attach cookie to response)
    const token = await createVendorSession(res, {
      user: {
        id: vendor.id,
        email: vendor.email,
        fname: vendor.fname,
        lname: vendor.lname,
        workspace: vendor.workspace,
        role: vendor.role || vendor.role,
        approval_status: vendor.approval_status,
      },
      rememberMe,
    });

    // Return success response without sensitive data
    return res.status(200).json({
      success: true,
      user: {
        //   workspace: vendor.workspace,
        //   role: vendor.role,
        token: token,
      },
    });
  } catch (error) {
    console.error("Sign in error:", error.message);
    await createVendorSession(res, {
      user: {
        id: null,
        email: null,
        fname: null,
        lname: null,
        workspace: null,
        role: null,
      },
      rememberMe: false,
    });
    return res.status(500).json({
      success: false,
      token: null,
      error: ["Internal server error. Please try again."],
    });
  }
};

/**
 * Register a new vendor
 */
vendorAuthController.register = async (req, res) => {
  const SALT_ROUNDS = 10;
  const errors = [];
  let {
    fname,
    lname,
    email,
    phone,
    pword,
    terms_of_service,
    country_name,
    country_code,
    state_code,
    state_name,
    currency,
    workspace,
    role,
    appointment_letter_url,
    id_card_url,
    optional_document_url,
  } = req.body;

  // Trim string fields
  fname = fname.trim();
  lname = lname.trim();
  email = email.trim().toLowerCase();
  phone = phone.trim();
  pword = pword.trim();

  // Validate required fields
  if (!fname) errors.push("First name is required");
  if (!lname) errors.push("Last name is required");
  if (!email) errors.push("Email address is required");
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push("Please enter a valid email address");
  }
  if (!phone) errors.push("Phone number is required");
  // if (!role) errors.push("Account type is required");
  if (!pword) errors.push("Password is required");
  else if (pword.length < 8) {
    errors.push("Password must be at least 8 characters long");
  }
  if (terms_of_service !== true) {
    errors.push("You must accept the terms of service");
  }
  if (!country_name) errors.push("Country is required");
  if (!country_code) errors.push("Country code is required");
  if (!state_code) errors.push("State is required");
  if (!state_name) errors.push("State name is required");
  if (!currency) errors.push("Currency is required");
  if (!workspace) errors.push("Workspace is required");
  if (!role) errors.push("Role is required");

  const fieldOpsRoles = ["field officer", "agronomist", "inspector", "enumerator", "field operations supervisor"];
  const isFieldOps = role && fieldOpsRoles.includes(role.toLowerCase());
  
  // Documents are now handled in the onboarding flow, not registration.

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      error: errors,
    });
  }

  try {
    // Check if vendor already exists
    const existingVendor = await getUserByEmail(email);

    if (existingVendor) {
      return res.status(409).json({
        success: false,
        error: ["Email address already in use."],
      });
    }

    // Check if email is verified
    //   const emailVerified = await isEmailVerified(email, "vendor");
    //   if (!emailVerified) {
    //      return res.status(400).json({
    //         success: false,
    //         error: ["Email must be verified before registration."],
    //         code: "EMAIL_NOT_VERIFIED",
    //      });
    //   }

    // Hash password
    const hashedPassword = await bcrypt.hash(pword, SALT_ROUNDS);

    let approval_status = "approved";
    if (isFieldOps) {
      approval_status = "pending_approval";
    }

    // Create vendor account
    const newVendor = await createUser(
      fname,
      lname,
      email,
      phone,
      hashedPassword,
      terms_of_service,
      workspace,
      role,
      approval_status
    );

    if (!newVendor) {
      return res.status(400).json({
        success: false,
        error: ["Failed to create vendor account. Try again"],
      });
    }

    if (isFieldOps) {
      await createFieldOperationsDocuments(
        newVendor.id,
        appointment_letter_url,
        id_card_url,
        optional_document_url
      );
    } else if (role.toLowerCase() === "farmer") {
      const year = new Date().getFullYear();
      const randomPart = Math.floor(100000 + Math.random() * 900000);
      const ain = `AGRI-${year}-${randomPart}`;
      await createFarmerProfile(newVendor.id, ain);
    }

    // Create session (attach cookie to response)
    const token = await createVendorSession(res, {
      user: {
        id: newVendor.id,
        email: newVendor.email,
        fname: newVendor.fname,
        lname: newVendor.lname,
        workspace: newVendor.workspace,
        role: newVendor.role,
        approval_status: approval_status,
      },
    });

    // Create the country utilities
    const countryUtilsResult = await countryUtils({
      vendor_id: newVendor.id || null,
      user_id: null,
      country_name: country_name,
      country_code: country_code, // Fixed field name
      state_code: state_code,
      state_name: state_name,
      currency: currency,
    });

    if (!countryUtilsResult) {
      return res.status(400).json({
        success: false,
        error: ["Failed to create country utilities. Try again"],
      });
    }

    //  await emailService.sendWelcomeEmail(email, fname, role);

    //  await deleteVerificationRecord(email, "vendor");

    // Return success response without sensitive data
    return res.status(201).json({
      success: true,
      user: {
        token: token,
      },
    });
  } catch (error) {
    await createVendorSession(res, {
      user: {
        id: null,
        email: null,
        fname: null,
        lname: null,
        workspace: null,
        role: null,
      },
    });
    return res.status(500).json({
      success: false,
      token: null,
      error: ["Internal server error. Please try again."],
    });
  }
};

vendorAuthController.signout = (req, res) => {
  try {
    const result = deleteVendorSession(res);

    if (!result) {
      return res.status(400).json({
        success: false,
        error: "Signout failed. Try again later.",
      });
    }

    return res.status(200).json({
      success: true,
    });
  } catch {
    return res.status(500).json({
      success: false,
      error: "Signout failed",
    });
  }
};

export default vendorAuthController;
