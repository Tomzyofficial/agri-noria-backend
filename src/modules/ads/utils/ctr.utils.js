/**
 * Campaign analytics helpers (CTR, etc.).
 * @module modules/ads/utils/ctr.utils
 */

/**
 * @param {number} clicks
 * @param {number} impressions
 * @returns {number} CTR as percentage (0–100), 2 decimal places
 */
export function computeCtrPercent(clicks, impressions) {
   const c = Number(clicks) || 0;
   const i = Number(impressions) || 0;
   if (i <= 0) return 0;
   return Math.round((c / i) * 10000) / 100;
}
