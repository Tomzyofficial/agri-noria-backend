/**
 * Impression / click tracking handlers.
 * @module modules/ads/controllers/ads.tracking.controller
 */

import { impressionTrackSchema, clickTrackSchema } from "../validations/campaign.schemas.js";
import { recordImpression, recordClick } from "../services/ads.tracking.service.js";
import { getClientIp } from "../utils/clientIp.utils.js";

export const adsTrackingController = {
   async impression(req, res) {
      try {
         const parsed = impressionTrackSchema.safeParse(req.body);
         if (!parsed.success) {
            return res.status(400).json({ success: false, error: parsed.error.flatten() });
         }
         const ip = getClientIp(req);
         const ua = req.headers["user-agent"] || null;
         const result = await recordImpression({
            campaignId: parsed.data.campaignId,
            viewerUserId: req.viewerUserId ?? null,
            ip,
            userAgent: ua,
         });
         if (!result.ok) {
            return res.status(422).json({ success: false, error: result.reason || "not_tracked" });
         }
         return res.json({ success: true });
      } catch (e) {
         console.error("[ads.track.impression]", e);
         return res.status(500).json({ success: false, error: "Server error" });
      }
   },

   async click(req, res) {
      try {
         const parsed = clickTrackSchema.safeParse(req.body);
         if (!parsed.success) {
            return res.status(400).json({ success: false, error: parsed.error.flatten() });
         }
         const ip = getClientIp(req);
         const ua = req.headers["user-agent"] || null;
         const result = await recordClick({
            campaignId: parsed.data.campaignId,
            viewerUserId: req.viewerUserId ?? null,
            ip,
            userAgent: ua,
         });
         if (!result.ok) {
            return res.status(422).json({ success: false, error: result.reason || "not_tracked" });
         }
         return res.json({ success: true });
      } catch (e) {
         console.error("[ads.track.click]", e);
         return res.status(500).json({ success: false, error: "Server error" });
      }
   },
};
