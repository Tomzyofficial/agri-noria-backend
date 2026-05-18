/**
 * Impression / click recording with transactional counter updates.
 * @module modules/ads/services/ads.tracking.service
 */

import pool from "../../../lib/connect.js";
import { selectActiveCampaignById } from "../queries/campaign.queries.js";

/**
 * @param {string | null} ip
 * @returns {string | null} safe for ::inet cast
 */
function inetOrNull(ip) {
   if (!ip || typeof ip !== "string") return null;
   const t = ip.trim();
   if (t.length > 128) return null;
   if (/^[\d.]+$/.test(t) || t.includes(":")) return t;
   return null;
}

/**
 * @param {object} input
 * @param {string} input.campaignId
 * @param {string | null} input.viewerUserId
 * @param {string | null} input.ip
 * @param {string | null} input.userAgent
 * @returns {Promise<{ ok: boolean, reason?: string }>}
 */
export async function recordImpression({ campaignId, viewerUserId, ip, userAgent }) {
   const active = await pool.query(selectActiveCampaignById, [campaignId]);
   if (active.rowCount === 0) {
      return { ok: false, reason: "not_active" };
   }

   const client = await pool.connect();
   try {
      await client.query("BEGIN");
      await client.query(
         `INSERT INTO ad_impressions (campaign_id, viewer_user_id, ip_address, user_agent)
          VALUES ($1, $2, $3::inet, $4)`,
         [campaignId, viewerUserId, inetOrNull(ip), userAgent ?? null],
      );
      await client.query(
         `UPDATE ad_campaigns SET impressions_count = impressions_count + 1, updated_at = NOW() WHERE id = $1`,
         [campaignId],
      );
      await client.query("COMMIT");
      return { ok: true };
   } catch (e) {
      await client.query("ROLLBACK");
      console.error("[ads.tracking.impression]", e);
      return { ok: false, reason: "db_error" };
   } finally {
      client.release();
   }
}

/**
 * @param {object} input
 * @param {string} input.campaignId
 * @param {string | null} input.viewerUserId
 * @param {string | null} input.ip
 * @param {string | null} input.userAgent
 * @returns {Promise<{ ok: boolean, reason?: string }>}
 */
export async function recordClick({ campaignId, viewerUserId, ip, userAgent }) {
   const active = await pool.query(selectActiveCampaignById, [campaignId]);
   if (active.rowCount === 0) {
      return { ok: false, reason: "not_active" };
   }

   const client = await pool.connect();
   try {
      await client.query("BEGIN");
      await client.query(
         `INSERT INTO ad_clicks (campaign_id, viewer_user_id, ip_address, user_agent)
          VALUES ($1, $2, $3::inet, $4)`,
         [campaignId, viewerUserId, inetOrNull(ip), userAgent ?? null],
      );
      await client.query(
         `UPDATE ad_campaigns SET clicks_count = clicks_count + 1, updated_at = NOW() WHERE id = $1`,
         [campaignId],
      );
      await client.query("COMMIT");
      return { ok: true };
   } catch (e) {
      await client.query("ROLLBACK");
      console.error("[ads.tracking.click]", e);
      return { ok: false, reason: "db_error" };
   } finally {
      client.release();
   }
}
