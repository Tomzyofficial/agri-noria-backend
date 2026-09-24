import { checkVendorOnboardingStatus } from "./check.js";
import { verifyVendorToken } from "../../../sessions/vendor.auth.session.js";

export async function checkOnboardingStatus(req, res) {
  try {
    const vendorPayload = await verifyVendorToken(req);
    if (!vendorPayload) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const onboardingStatus = await checkVendorOnboardingStatus(
      vendorPayload.id,
      vendorPayload.email,
    );
    return res.status(200).json({ onboardingStatus });
  } catch (error) {
    console.error("Error checking onboarding status:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
