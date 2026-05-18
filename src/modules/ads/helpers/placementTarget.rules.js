/**
 * Validates placement vs target_type combinations (business rules).
 * @module modules/ads/helpers/placementTarget.rules
 */

/**
 * @param {string} placement
 * @param {string} targetType
 * @param {string} vendorId
 * @param {string} targetId
 * @returns {{ ok: true } | { ok: false, message: string }}
 */
export function assertPlacementTarget(placement, targetType, vendorId, targetId) {
   if (placement === "FEATURED_VENDOR") {
      if (targetType !== "VENDOR") {
         return { ok: false, message: "FEATURED_VENDOR campaigns must target VENDOR" };
      }
      if (targetId !== vendorId) {
         return { ok: false, message: "FEATURED_VENDOR target must be your own vendor account" };
      }
      return { ok: true };
   }

   if (placement === "SPONSORED_PRODUCT" || placement === "SEARCH_BOOST") {
      if (targetType !== "PRODUCT") {
         return { ok: false, message: `${placement} campaigns must target PRODUCT (listing)` };
      }
      return { ok: true };
   }

   if (placement === "PROMOTED_TRAINING") {
      if (targetType !== "TRAINING") {
         return { ok: false, message: "PROMOTED_TRAINING campaigns must target TRAINING" };
      }
      return { ok: true };
   }

   if (placement === "HOMEPAGE_FEATURED") {
      return { ok: true };
   }

   return { ok: false, message: "Unknown placement" };
}
