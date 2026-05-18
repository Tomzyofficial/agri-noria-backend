import bcrypt from "bcryptjs";
import { getUserByEmail, createUser } from "../../../db/vendor/vendor.auth.db.js";
import { createVendorSession, deleteVendorSession, verifyVendorToken } from "../../../sessions/vendor.auth.session.js";
import { countryUtils } from "../../../db/country.utils.db.js";

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
         return res.status(404).json({ existing: false, error: "User doesn't exist in db" });
      }
      return res.status(200).json({ existing: true, message: "User exist in db" });
   } catch {
      return res.status(500).json({ existing: false, error: "Internal server error" });
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
            account_type: vendor.account_type,
         },
         rememberMe,
      });

      // Return success response without sensitive data
      return res.status(200).json({
         success: true,
         user: {
            account_type: vendor.account_type,
            token: token,
         },
      });
   } catch (error) {
      console.error("Sign in error:", error.message);
      return res.status(500).json({
         success: false,
         token: null,
         error: ["An error occurred during sign in. Please try again."],
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
      account_type,
      pword,
      terms_of_service,
      country_name,
      country_code, // Changed from country_Code to match frontend
      state_code,
      state_name,
      currency,
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
   if (!account_type) errors.push("Account type is required");
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

      // Hash password
      const hashedPassword = await bcrypt.hash(pword, SALT_ROUNDS);

      // Create vendor account
      const newVendor = await createUser(fname, lname, email, phone, account_type, hashedPassword, terms_of_service);

      if (!newVendor) {
         return res.status(400).json({
            success: false,
            error: ["Failed to create vendor account. Try again"],
         });
      }

      // Create session (attach cookie to response)
      const token = await createVendorSession(res, {
         user: {
            id: newVendor.id,
            email: newVendor.email,
            fname: newVendor.fname,
            lname: newVendor.lname,
            account_type: newVendor.account_type,
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

      // Return success response without sensitive data
      return res.status(201).json({
         success: true,
         user: {
            token: token,
         },
      });
   } catch (error) {
      return res.status(500).json({
         success: false,
         token: null,
         error: [error.message || "An error occurred during registration. Please try again."],
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
