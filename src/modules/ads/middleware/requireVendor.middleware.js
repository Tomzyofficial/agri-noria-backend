/**
 * Ensures a valid vendor session; attaches `req.vendor`.
 * @module modules/ads/middleware/requireVendor.middleware
 */

import { verifyVendorToken } from "../../../sessions/vendor.auth.session.js";

/**
 * @type {import('express').RequestHandler}
 */
export async function requireVendor(req, res, next) {
   try {
      const payload = await verifyVendorToken(req);
      if (!payload?.id) {
         return res.status(401).json({ success: false, error: "Authentication required" });
      }
      req.vendor = {
         id: String(payload.id),
         email: payload.email ? String(payload.email) : null,
         fname: payload.fname ? String(payload.fname) : "",
         lname: payload.lname ? String(payload.lname) : "",
         account_type: payload.account_type ? String(payload.account_type) : "",
      };
      next();
   } catch {
      return res.status(500).json({ success: false, error: "Authentication error" });
   }
}
