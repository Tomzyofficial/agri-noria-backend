/**
 * SQL for impression / click tracking with atomic counter bumps.
 * @module modules/ads/queries/tracking.queries
 */

export const insertImpressionAndBump = `
INSERT INTO ad_impressions (campaign_id, viewer_user_id, ip_address, user_agent)
VALUES ($1, $2, $3::inet, $4);

UPDATE ad_campaigns
SET impressions_count = impressions_count + 1, updated_at = NOW()
WHERE id = $1;
`;

export const insertClickAndBump = `
INSERT INTO ad_clicks (campaign_id, viewer_user_id, ip_address, user_agent)
VALUES ($1, $2, $3::inet, $4);

UPDATE ad_campaigns
SET clicks_count = clicks_count + 1, updated_at = NOW()
WHERE id = $1;
`;
