import pool from "../../../lib/connect.js";
// import { selectActiveCampaignsByPlacement } from "../queries/campaign.queries.js";
// import { marketplaceCatalogWithSearchBoost } from "../queries/searchBoost.queries.js";

// /**
//  * @param {string[]} ids
//  * @returns {Promise<Map<string, object>>}
//  */
// async function fetchListingsMap(ids) {
//   if (!ids.length) return new Map();
//   const { rows } = await pool.query(
//     `SELECT ls.id, ls.listing_name, ls.price, ls.product_image, ls.description,
//               cu.currency, cu.country_code, ls.account_id AS vendor_id
//        FROM listings ls
//        JOIN country_utils cu ON cu.vendor_id = ls.account_id
//        WHERE ls.id = ANY($1::uuid[])`,
//     [ids],
//   );
//   return new Map(rows.map((r) => [String(r.id), r]));
// }

// /**
//  * @param {string[]} ids
//  * @returns {Promise<Map<string, object>>}
//  */
// async function fetchVendorsMap(ids) {
//   if (!ids.length) return new Map();
//   const { rows } = await pool.query(
//     `SELECT v.id, v.fname, v.lname, v.profile_image_url, v.phone, v.is_verified,
//               cu.currency, cu.country_code
//        FROM vendors v
//        JOIN country_utils cu ON cu.vendor_id = v.id
//        WHERE v.id = ANY($1::uuid[])`,
//     [ids],
//   );
//   return new Map(rows.map((r) => [String(r.id), r]));
// }

// /**
//  * @param {string[]} ids
//  * @returns {Promise<Map<string, object>>}
//  */
// async function fetchTrainingsMap(ids) {
//   if (!ids.length) return new Map();
//   const { rows } = await pool.query(
//     `SELECT t.id, t.title, t.description, t.thumbnail, t.scheduled_at, t.status, t.trainer_id
//        FROM trainings t
//        WHERE t.id = ANY($1::uuid[])`,
//     [ids],
//   );
//   return new Map(rows.map((r) => [String(r.id), r]));
// }

// /**
//  * @param {{ country?: string, placement?: string }} filters
//  * @returns {Promise<object[]>}
//  */
// export async function getHydratedActiveCampaigns(filters) {
//   const country = filters.country || null;
//   const placement = filters.placement || null;
//   const { rows } = await pool.query(selectActiveCampaignsByPlacement, [
//     country,
//     placement,
//   ]);

//   const productIds = rows
//     .filter((r) => r.target_type === "PRODUCT")
//     .map((r) => String(r.target_id));
//   const vendorIds = rows
//     .filter((r) => r.target_type === "VENDOR")
//     .map((r) => String(r.target_id));
//   const trainingIds = rows
//     .filter((r) => r.target_type === "TRAINING")
//     .map((r) => String(r.target_id));

//   const [listings, vendors, trainings] = await Promise.all([
//     fetchListingsMap(productIds),
//     fetchVendorsMap(vendorIds),
//     fetchTrainingsMap(trainingIds),
//   ]);

//   return rows.map((c) => {
//     const key = String(c.target_id);
//     let creative = null;
//     if (c.target_type === "PRODUCT") creative = listings.get(key) ?? null;
//     if (c.target_type === "VENDOR") creative = vendors.get(key) ?? null;
//     if (c.target_type === "TRAINING") creative = trainings.get(key) ?? null;
//     return {
//       campaign: {
//         id: c.id,
//         placement: c.placement,
//         targetType: c.target_type,
//         targetId: c.target_id,
//         budget: c.budget,
//         startAt: c.start_at,
//         endAt: c.end_at,
//         impressionsCount: c.impressions_count,
//         clicksCount: c.clicks_count,
//         resolvedCountry: c.resolved_country,
//       },
//       creative,
//     };
//   });
// }

// /**
//  * Marketplace catalog with search boost ordering.
//  * @param {{ country: string, q?: string }} params
//  */
// export async function getBoostedMarketplaceCatalog(params) {
//   const country = params.country;
//   const q =
//     params.q && String(params.q).trim() ? String(params.q).trim() : null;
//   const { rows } = await pool.query(marketplaceCatalogWithSearchBoost, [
//     country,
//     q,
//   ]);
//   return rows;
// }

// async function getActiveAdsCampaigns(placement) {
//   if (!ids.length) return new Map();
//   const { rows } = await pool.query(
//     `SELECT ls.id, ls.listing_name, ls.price, ls.image, ls.description,
//               cu.currency, cu.country_code, ls.account_id AS vendor_id
//        FROM listings ls
//        JOIN country_utils cu ON cu.vendor_id = ls.account_id
//        WHERE ls.id = ANY($1::uuid[])`,
//     [ids],
//   );
//   return new Map(rows.map((r) => [String(r.id), r]));
// }

export const adCampaignsPublic = {
  //   activeHomeCampaigns: async function (country, surface) {
  //     const { rows } = await pool.query(
  //       `SELECT ls.id, ls.listing_name, ls.price, ls.image, ls.description,
  //       cu.currency, cu.country_code, ls.account_id, ac.id AS campaign_id, ac.start_at, ac.end_at, ac.surfaces, ac.placement, ac.target_id
  //       FROM listings ls
  //       JOIN country_utils cu ON cu.vendor_id = ls.account_id
  //       JOIN ad_campaigns ac ON ac.target_id = ls.id
  //        WHERE ac.status = 'ACTIVE'::ad_status AND ac.start_at <= NOW() AND end_at >= NOW() AND cu.country_code = $1 AND ac.surfaces = $2`,
  //       [country, surface],
  //     );
  //     return rows || null;
  //   },

  // Unified query for both home (farmer, seller) and drone marketplace ad campaigns
  activeDroneHomeCampaigns: async (country, surface) => {
    const { rows } = await pool.query(
      `SELECT ls.id, ls.listing_name, ls.price, ls.image, ls.description, ls.location,
      ls.available_quantity, ls.unit, ls.category, ls.role,
      cu.currency, cu.country_code, ls.account_id,
      dld.manufacturer, dld.model, dld.listing_type, dld.condition,
      dld.warranty, dld.rental_price, dld.rental_period, dld.max_payload,
      dld.operating_range, dld.camera_type, dld.flight_time, dld.provide_service,
      dld.service_type,
      ac.id AS campaign_id, ac.start_at, ac.end_at, ac.surfaces, ac.placement, ac.target_id 
      FROM listings ls 
      JOIN country_utils cu ON cu.vendor_id = ls.account_id
      JOIN ad_campaigns ac ON ac.target_id = ls.id
      LEFT JOIN drone_listing_details dld ON dld.listing_id = ls.id
      WHERE ac.status = 'ACTIVE'::ad_status
        AND ac.start_at <= NOW()
        AND ac.end_at >= NOW()
        AND cu.country_code = $1
        AND ac.surfaces = $2
      ORDER BY ac.amount_paid DESC, ac.created_at ASC`,
      [country, surface],
    );
    return rows || null;
  },
};
