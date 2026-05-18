/**
 * Parameterized SQL fragments for ad campaigns.
 * @module modules/ads/queries/campaign.queries
 */

export const insertCampaign = `
INSERT INTO ad_campaigns (
  vendor_id, target_type, target_id, placement, status,
  budget, amount_paid, impressions_count, clicks_count,
  paystack_reference, start_at, end_at
) VALUES (
  $1, $2::ad_target_type, $3, $4::ad_placement, $5::ad_status,
  $6, $7, 0, 0, $8, $9, $10
)
RETURNING *;
`;

export const updatePaystackReference = `
UPDATE ad_campaigns
SET paystack_reference = $2, updated_at = NOW()
WHERE id = $1 AND vendor_id = $3
RETURNING *;
`;

export const selectCampaignForVendor = `
SELECT * FROM ad_campaigns
WHERE id = $1 AND vendor_id = $2
LIMIT 1;
`;

export const listCampaignsByVendor = `
SELECT * FROM ad_campaigns
WHERE vendor_id = $1
ORDER BY created_at DESC;
`;

export const updateCampaignEditable = `
UPDATE ad_campaigns
SET
  budget = COALESCE($2, budget),
  start_at = COALESCE($3, start_at),
  end_at = COALESCE($4, end_at),
  updated_at = NOW()
WHERE id = $1 AND vendor_id = $5
  AND status IN ('DRAFT'::ad_status, 'PENDING_PAYMENT'::ad_status)
RETURNING *;
`;

export const setCampaignStatus = `
UPDATE ad_campaigns
SET status = $3::ad_status, updated_at = NOW()
WHERE id = $1 AND vendor_id = $2
  AND ($3::text <> 'PAUSED' OR status = 'ACTIVE'::ad_status)
RETURNING *;
`;

export const activatePaidCampaign = `
UPDATE ad_campaigns
SET
  status = 'ACTIVE'::ad_status,
  amount_paid = $3,
  updated_at = NOW()
WHERE id = $1
  AND vendor_id = $2
  AND status = 'PENDING_PAYMENT'::ad_status
RETURNING *;
`;

export const deleteCampaignIfAllowed = `
DELETE FROM ad_campaigns
WHERE id = $1 AND vendor_id = $2
  AND status IN (
    'DRAFT'::ad_status,
    'PENDING_PAYMENT'::ad_status,
    'CANCELLED'::ad_status,
    'ENDED'::ad_status
  )
RETURNING id;
`;

export const selectActiveCampaignById = `
SELECT id, vendor_id, status, start_at, end_at
FROM ad_campaigns
WHERE id = $1
  AND status = 'ACTIVE'::ad_status
  AND start_at <= NOW()
  AND end_at >= NOW()
LIMIT 1;
`;

export const countVendorActiveCampaigns = `
SELECT COUNT(*)::int AS n
FROM ad_campaigns
WHERE vendor_id = $1
  AND status = 'ACTIVE'::ad_status
  AND start_at <= NOW()
  AND end_at >= NOW();
`;

export const selectActiveCampaignsByPlacement = `
SELECT ac.*,
  COALESCE(cu_prod.country_code, cu_vendor.country_code, cu_train.country_code) AS resolved_country
FROM ad_campaigns ac
LEFT JOIN listings ls
  ON ac.target_type = 'PRODUCT'::ad_target_type AND ls.id = ac.target_id
LEFT JOIN country_utils cu_prod ON cu_prod.vendor_id = ls.account_id
LEFT JOIN country_utils cu_vendor
  ON ac.target_type = 'VENDOR'::ad_target_type AND cu_vendor.vendor_id = ac.target_id
LEFT JOIN trainings tr
  ON ac.target_type = 'TRAINING'::ad_target_type AND tr.id = ac.target_id
LEFT JOIN country_utils cu_train ON cu_train.vendor_id = tr.trainer_id
WHERE ac.status = 'ACTIVE'::ad_status
  AND ac.start_at <= NOW()
  AND ac.end_at >= NOW()
  AND ($1::text IS NULL OR $1 = '' OR COALESCE(cu_prod.country_code, cu_vendor.country_code, cu_train.country_code) = $1)
  AND ($2::text IS NULL OR $2 = '' OR ac.placement = $2::ad_placement)
ORDER BY ac.amount_paid DESC, ac.created_at ASC;
`;
