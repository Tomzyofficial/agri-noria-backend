/**
 * Search-boost catalog: sponsored (active SEARCH_BOOST) first, then organic.
 * All parameters are bound — no string concatenation.
 * @module modules/ads/queries/searchBoost.queries
 */

export const marketplaceCatalogWithSearchBoost = `
WITH params AS (
  SELECT $1::text AS country_code, $2::text AS q
),
organic AS (
  SELECT
    ls.id,
    ls.product_image,
    ls.listing_name,
    ls.price,
    ls.description,
    cu.currency,
    cu.country_code,
    FALSE::boolean AS is_sponsored,
    NULL::uuid AS sponsor_campaign_id,
    0::numeric AS sponsor_rank
  FROM listings ls
  JOIN country_utils cu ON cu.vendor_id = ls.account_id
  CROSS JOIN params p
  WHERE ls.product_status = 'active'
    AND cu.country_code = p.country_code
    AND (
      p.q IS NULL OR p.q = '' OR
      ls.listing_name ILIKE ('%' || p.q || '%') OR
      COALESCE(ls.description, '') ILIKE ('%' || p.q || '%')
    )
),
sponsored AS (
  SELECT
    ls.id,
    ls.product_image,
    ls.listing_name,
    ls.price,
    ls.description,
    cu.currency,
    cu.country_code,
    TRUE::boolean AS is_sponsored,
    ac.id AS sponsor_campaign_id,
    ac.amount_paid AS sponsor_rank
  FROM ad_campaigns ac
  JOIN listings ls ON ls.id = ac.target_id AND ls.product_status = 'active'
  JOIN country_utils cu ON cu.vendor_id = ls.account_id
  CROSS JOIN params p
  WHERE ac.target_type = 'PRODUCT'::ad_target_type
    AND ac.placement = 'SEARCH_BOOST'::ad_placement
    AND ac.status = 'ACTIVE'::ad_status
    AND ac.start_at <= NOW()
    AND ac.end_at >= NOW()
    AND cu.country_code = p.country_code
    AND (
      p.q IS NULL OR p.q = '' OR
      ls.listing_name ILIKE ('%' || p.q || '%') OR
      COALESCE(ls.description, '') ILIKE ('%' || p.q || '%')
    )
),
combined AS (
  SELECT * FROM sponsored
  UNION ALL
  SELECT o.*
  FROM organic o
  WHERE NOT EXISTS (
    SELECT 1 FROM sponsored s WHERE s.id = o.id
  )
)
SELECT *
FROM combined
ORDER BY is_sponsored DESC, sponsor_rank DESC, listing_name ASC;
`;
