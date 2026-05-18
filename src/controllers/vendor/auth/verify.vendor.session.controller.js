import { verifyVendorToken, deleteVendorSession } from "../../../sessions/vendor.auth.session.js";
import { getUserByEmail } from "../../../db/vendor/vendor.auth.db.js";
import { getFarmerProfileByVendor } from "../../../db/pipeline/pipeline.db.js";
import { getVendorProfileInfo } from "../../../db/vendor/profile.db.js";

export async function verifyVendor(req, res) {
   try {
      const payload = await verifyVendorToken(req);
      if (!payload) {
         return res.status(401).json({
            authenticated: false,
            error: "Authentication required",
            code: "AUTH_REQUIRED",
         });
      }

      // Fetch fresh data from DB to get latest verification/onboarding/suspension status
      const user = await getUserByEmail(payload.email);
      if (user && user.is_suspended) {
         deleteVendorSession(res);
         return res.status(403).json({
            authenticated: false,
            error: "Your account has been suspended. Please contact support.",
            code: "ACCOUNT_SUSPENDED",
         });
      }

      // Use the unified onboarding_status from the vendors table
      const onboardingStatus = user?.onboarding_status || "pending";

      return res.status(200).json({
         authenticated: true,
         userId: payload.id,
         fname: payload.fname,
         lname: payload.lname,
         email: payload.email,
         account_type: user?.account_type || payload.account_type,
         onboarding_status: onboardingStatus,
      });
   } catch (error) {
      console.error("Verify vendor error:", error);
      return res.status(500).json({
         authenticated: false,
         error: "Authentication error",
         code: "AUTH_ERROR",
      });
   }
}
