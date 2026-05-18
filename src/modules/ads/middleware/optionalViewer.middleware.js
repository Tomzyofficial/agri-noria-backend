/**
 * Optionally attaches authenticated buyer id for ad telemetry (`req.viewerUserId`).
 * @module modules/ads/middleware/optionalViewer.middleware
 */

import { verifyBuyerToken } from "../../../sessions/buyer.auth.session.js";

/**
 * @type {import('express').RequestHandler}
 */
export async function optionalViewer(req, _res, next) {
   try {
      const payload = await verifyBuyerToken(req);
      req.viewerUserId = payload?.buyer_id ? String(payload.buyer_id) : null;
   } catch {
      req.viewerUserId = null;
   }
   next();
}
