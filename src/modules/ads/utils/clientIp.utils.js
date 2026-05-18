/**
 * Resolve client IP for audit / analytics (behind proxies).
 * @module modules/ads/utils/clientIp.utils
 */

/**
 * @param {import('express').Request} req
 * @returns {string | null}
 */
export function getClientIp(req) {
   const forwarded = req.headers["x-forwarded-for"];
   if (typeof forwarded === "string" && forwarded.length > 0) {
      return forwarded.split(",")[0].trim() || null;
   }
   if (Array.isArray(forwarded) && forwarded[0]) {
      return String(forwarded[0]).split(",")[0].trim() || null;
   }
   const socketIp = req.socket?.remoteAddress;
   if (socketIp) return socketIp;
   return null;
}
