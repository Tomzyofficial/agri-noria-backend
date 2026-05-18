import pool from "../lib/connect.js";

// Create email verification record
export async function createEmailVerification(email, userType, verificationCodeHash, expiresAt) {
   const { rows } = await pool.query(
      `INSERT INTO email_verifications (email, user_type, verification_code_hash, expires_at) 
       VALUES ($1, $2, $3, $4) 
       ON CONFLICT (email, user_type) 
       DO UPDATE SET 
         verification_code_hash = EXCLUDED.verification_code_hash,
         expires_at = EXCLUDED.expires_at,
         is_verified = FALSE,
         created_at = NOW(),
         updated_at = NOW()
       RETURNING *`,
      [email, userType, verificationCodeHash, expiresAt],
   );
   return rows[0];
}

// Get email verification record
export async function getEmailVerification(email, userType) {
   const { rows } = await pool.query(
      "SELECT * FROM email_verifications WHERE email = $1 AND user_type = $2 ORDER BY created_at DESC LIMIT 1",
      [email, userType],
   );
   return rows[0] || null;
}

// Verify email code
export async function verifyEmailCode(email, userType, plainCode) {
   const verification = await getEmailVerification(email, userType);

   if (!verification) {
      return { success: false, error: "Verification not found" };
   }

   // Check if already verified
   if (verification.is_verified) {
      return { success: false, error: "Email already verified" };
   }

   // Check if expired
   if (new Date() > new Date(verification.expires_at)) {
      return { success: false, error: "Verification code expired" };
   }

   // Verify the code (using the email service for hashing consistency)
   const emailService = await import("../services/email.service.js");
   const isValid = emailService.default.verifyHashedCode(plainCode, verification.verification_code_hash);

   if (!isValid) {
      return { success: false, error: "Invalid verification code" };
   }

   // Mark as verified
   const { rows } = await pool.query(
      `UPDATE email_verifications 
       SET is_verified = TRUE, updated_at = NOW() 
       WHERE id = $1 
       RETURNING *`,
      [verification.id],
   );

   return { success: true, verification: rows[0] };
}

// Check if email is already verified
export async function isEmailVerified(email, userType) {
   const query = "SELECT is_verified FROM email_verifications WHERE email = $1 AND user_type = $2";

   const { rows } = await pool.query(query, [email, userType]);
   return rows[0]?.is_verified || false;
}

// Clean up expired verifications
export async function cleanupExpiredVerifications() {
   const { rows } = await pool.query(
      `DELETE FROM email_verifications 
       WHERE expires_at < NOW() 
       OR (is_verified = TRUE AND updated_at < NOW() - INTERVAL '24 hours')
       RETURNING id`,
   );
   return rows.length;
}

// Get verification status
export async function getVerificationStatus(email, userType) {
   const verification = await getEmailVerification(email, userType);
   const emailVerified = await isEmailVerified(email, userType);

   return {
      hasVerification: !!verification,
      isVerified: emailVerified,
      isCodeVerified: verification?.is_verified || false,
      expiresAt: verification?.expires_at,
      createdAt: verification?.created_at,
   };
}

// Delete verification record
export async function deleteVerificationRecord(email, userType) {
   const { rows } = await pool.query(
      "DELETE FROM email_verifications WHERE email = $1 AND user_type = $2 RETURNING *",
      [email, userType],
   );
   return rows[0] || null;
}
