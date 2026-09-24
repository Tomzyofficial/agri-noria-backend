import pool from "../../../lib/connect.js";

// When user tries to switch workspace, check if they have undergone onboarding for workspace
export async function checkVendorOnboardingStatus(vendorId, vendorEmail) {
  try {
    const { rows } = await pool.query(
      "SELECT onboarding_status FROM vendors WHERE id = $1 AND email = $2",
      [vendorId, vendorEmail],
    );
    return rows[0]?.onboarding_status || null;
  } catch (error) {
    console.error("Error checking vendor onboarding status:", error);
    throw new Error("Database query failed");
  }
}
