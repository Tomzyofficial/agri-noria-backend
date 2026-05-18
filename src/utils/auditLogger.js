import pool from "../lib/connect.js";

/**
 * Creates an audit log entry in the database.
 * 
 * @param {string} userId - The ID of the user performing the action
 * @param {string} userEmail - The email of the user performing the action
 * @param {string} action - The action type (e.g., 'LOGIN', 'CREATE', 'UPDATE', 'DELETE')
 * @param {string} resource - The resource being acted upon (e.g., 'User', 'Agreement', 'Wallet')
 * @param {string} details - Detailed description of the action
 * @param {string} ipAddress - The IP address of the user
 */
export async function createAuditLog(userId, userEmail, action, resource, details, ipAddress) {
   try {
      const { rows } = await pool.query(
         `INSERT INTO audit_logs (user_id, user_email, action, resource, details, ip_address)
          VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING *`,
         [userId, userEmail, action, resource, details, ipAddress]
      );
      return rows[0];
   } catch (error) {
      console.error("Failed to create audit log:", error);
      // We don't want to fail the main request if logging fails, but we should know about it
      return null;
   }
}
