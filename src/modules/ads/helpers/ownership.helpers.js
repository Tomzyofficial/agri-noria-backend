/**
 * Server-side ownership verification for ad targets.
 * NEVER trust target IDs from the client without these checks.
 * @module modules/ads/helpers/ownership.helpers
 */

import pool from "../../../lib/connect.js";

/**
 * @param {string} vendorId
 * @param {string} listingId
 * @returns {Promise<boolean>}
 */
export async function verifyProductOwnership(vendorId, listingId) {
   const { rowCount } = await pool.query(
      `SELECT 1 FROM listings WHERE id = $1 AND account_id = $2 AND product_status = 'active' LIMIT 1`,
      [listingId, vendorId],
   );
   return rowCount > 0;
}

/**
 * @param {string} vendorId
 * @param {string} trainingId
 * @returns {Promise<boolean>}
 */
export async function verifyTrainingOwnership(vendorId, trainingId) {
   const { rowCount } = await pool.query(
      `SELECT 1 FROM trainings WHERE id = $1 AND trainer_id = $2 LIMIT 1`,
      [trainingId, vendorId],
   );
   return rowCount > 0;
}

/**
 * Vendor "owns" their public vendor profile for featured placements.
 * @param {string} vendorId
 * @param {string} targetVendorId
 * @returns {boolean}
 */
export function verifyVendorProfileOwnership(vendorId, targetVendorId) {
   return vendorId === targetVendorId;
}

/**
 * @param {string} vendorId
 * @returns {Promise<boolean>}
 */
export async function verifyVendorExists(vendorId) {
   const { rowCount } = await pool.query(`SELECT 1 FROM vendors WHERE id = $1 LIMIT 1`, [vendorId]);
   return rowCount > 0;
}
