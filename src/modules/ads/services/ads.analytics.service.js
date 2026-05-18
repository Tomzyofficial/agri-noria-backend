/**
 * Vendor-facing analytics (aggregates + CTR).
 * @module modules/ads/services/ads.analytics.service
 */

import pool from "../../../lib/connect.js";
import { computeCtrPercent } from "../utils/ctr.utils.js";

/**
 * @param {string} vendorId
 * @returns {Promise<object>}
 */
export async function getVendorAdsSummary(vendorId) {
   const { rows } = await pool.query(
      `SELECT
         COUNT(*)::int AS total_campaigns,
         COUNT(*) FILTER (
           WHERE status = 'ACTIVE'::ad_status AND start_at <= NOW() AND end_at >= NOW()
         )::int AS active_campaigns,
         COALESCE(SUM(impressions_count), 0)::bigint AS impressions,
         COALESCE(SUM(clicks_count), 0)::bigint AS clicks
       FROM ad_campaigns
       WHERE vendor_id = $1`,
      [vendorId],
   );
   const r = rows[0] || {};
   const impressions = Number(r.impressions) || 0;
   const clicks = Number(r.clicks) || 0;
   return {
      totalCampaigns: Number(r.total_campaigns) || 0,
      activeCampaigns: Number(r.active_campaigns) || 0,
      impressions,
      clicks,
      ctrPercent: computeCtrPercent(clicks, impressions),
   };
}

/**
 * Optional time-windowed counts from raw events (more accurate for reporting).
 * @param {string} vendorId
 * @param {Date} [from]
 * @param {Date} [to]
 */
export async function getVendorEventRollup(vendorId, from, to) {
   const params = [vendorId];
   let timeClause = "";
   if (from) {
      params.push(from);
      timeClause += ` AND ai.created_at >= $${params.length}`;
   }
   if (to) {
      params.push(to);
      timeClause += ` AND ai.created_at <= $${params.length}`;
   }

   const imp = await pool.query(
      `SELECT COUNT(*)::bigint AS n
       FROM ad_impressions ai
       JOIN ad_campaigns ac ON ac.id = ai.campaign_id
       WHERE ac.vendor_id = $1 ${timeClause}`,
      params,
   );

   const clk = await pool.query(
      `SELECT COUNT(*)::bigint AS n
       FROM ad_clicks ai
       JOIN ad_campaigns ac ON ac.id = ai.campaign_id
       WHERE ac.vendor_id = $1 ${timeClause}`,
      params,
   );

   const impressions = Number(imp.rows[0]?.n) || 0;
   const clicks = Number(clk.rows[0]?.n) || 0;
   return {
      impressions,
      clicks,
      ctrPercent: computeCtrPercent(clicks, impressions),
   };
}
