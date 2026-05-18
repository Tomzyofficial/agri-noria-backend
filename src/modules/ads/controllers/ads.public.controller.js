/**
 * Public ads endpoints (no vendor auth).
 * @module modules/ads/controllers/ads.public.controller
 */

import { activeCampaignsQuerySchema } from "../validations/campaign.schemas.js";
import { getHydratedActiveCampaigns, getBoostedMarketplaceCatalog } from "../services/ads.public.service.js";

export const adsPublicController = {
   async activeCampaigns(req, res) {
      try {
         const parsed = activeCampaignsQuerySchema.safeParse(req.query);
         if (!parsed.success) {
            return res.status(400).json({ success: false, error: parsed.error.flatten() });
         }
         const { placement, country } = parsed.data;
         const items = await getHydratedActiveCampaigns({ placement, country });
         return res.json({ success: true, items });
      } catch (e) {
         console.error("[ads.public.active]", e);
         return res.status(500).json({ success: false, error: "Failed to load campaigns" });
      }
   },

   async boostedCatalog(req, res) {
      try {
         const country = req.query.country;
         const q = req.query.q;
         if (!country || typeof country !== "string") {
            return res.status(400).json({ success: false, error: "country query is required" });
         }
         const rows = await getBoostedMarketplaceCatalog({
            country,
            q: typeof q === "string" ? q : "",
         });
         return res.json({ success: true, result: rows });
      } catch (e) {
         console.error("[ads.public.catalog]", e);
         return res.status(500).json({ success: false, error: "Failed to load catalog" });
      }
   },
};
