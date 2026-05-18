import bcrypt from "bcryptjs";
import { getUserByEmail, createUser } from "../../../db/buyer/buyer.auth.db.js";
import { createBuyerSession, deleteBuyerSession } from "../../../sessions/buyer.auth.session.js";

const buyerAuthController = {};

buyerAuthController.signin = async (req, res) => {
   const errors = [];

   const { email, password } = req.body;

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
      // Check if user exists
      const existingBuyer = await getUserByEmail(normalizedEmail);

      if (!existingBuyer) {
         return res.status(404).json({
            success: false,
            error: ["You have provided incorrect credentials"],
         });
      }

      if (existingBuyer.is_active === false) {
         return res.status(403).json({
            success: false,
            error: ["This account has been migrated to the Industrial Ecosystem. Please use the Industrial Login portal."],
         });
      }

      const isPasswordValid = await bcrypt.compare(password, existingBuyer.password_hash);

      if (!isPasswordValid) {
         return res.status(400).json({
            success: false,
            error: ["Incorrect email address or password"],
         });
      }

      // Create session (attach cookie to response)
      const token = await createBuyerSession(res, {
         buyer_id: existingBuyer.buyer_id,
         email: existingBuyer.email,
         name: existingBuyer.name,
      });
      return res.status(200).json({
         success: true,
         token: token,
         buyerId: existingBuyer.buyer_id,
      });
   } catch (err) {
      console.error("signin error ", err);
      return res.status(500).json({
         success: false,
         error: ["An error occurred during sign in. Please try again."],
      });
   }
};

buyerAuthController.register = async (req, res) => {
   const SALT_ROUNDS = 10;
   const errors = [];

   let { email, name, password } = req.body;

   // Trim string fields
   email = email.trim().toLowerCase();
   name = name.trim();
   password = password.trim();

   // Validate required fields
   if (!email) errors.push("Email address is required");
   if (!name) errors.push("Name is required");
   if (!password) errors.push("Password is required");

   if (errors.length > 0) {
      return res.status(400).json({
         success: false,
         error: errors,
      });
   }

   try {
      // Check if user already exists
      const existingBuyer = await getUserByEmail(email);

      if (existingBuyer) {
         return res.status(409).json({
            success: false,
            error: ["Email address already registered"],
         });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

      // Create user account
      const newBuyer = await createUser(email, hashedPassword, name, "local");

      if (!newBuyer) {
         return res.status(400).json({
            success: false,
            error: ["Failed to create account. Try again."],
         });
      }

      // Create session (attach cookie to response)
      const token = await createBuyerSession(res, {
         buyer_id: newBuyer.buyer_id,
         email: newBuyer.email,
         name: newBuyer.name,
      });

      return res.status(201).json({
         success: true,
         token: token,
      });
   } catch {
      return res.status(500).json({
         success: false,
         token: null,
         error: ["An error occurred during registration. Please try again."],
      });
   }
};

buyerAuthController.signout = (req, res) => {
   try {
      const result = deleteBuyerSession(res);
      if (!result) {
         return res.status(400).json({
            success: false,
            error: "Signout failed",
         });
      }
      return res.status(200).json({
         success: true,
      });
   } catch {
      return res.status(500).json({
         success: false,
         error: ["Signout failed"],
      });
   }
};

export default buyerAuthController;
