/**
 * Ads module — canonical enum labels (aligned with PostgreSQL ENUMs).
 * @module modules/ads/helpers/ads.enums
 */

/** @typedef {'PRODUCT' | 'VENDOR' | 'TRAINING'} AdTargetType */
/** @typedef {'DRAFT' | 'PENDING_PAYMENT' | 'ACTIVE' | 'PAUSED' | 'ENDED' | 'CANCELLED'} AdStatus */
/** @typedef {'SPONSORED_PRODUCT' | 'FEATURED_VENDOR' | 'PROMOTED_TRAINING' | 'SEARCH_BOOST' | 'HOMEPAGE_FEATURED'} AdPlacement */

export const AD_TARGET_TYPES = /** @type {const} */ (["PRODUCT", "VENDOR", "TRAINING"]);

export const AD_STATUSES = /** @type {const} */ ([
   "DRAFT",
   "PENDING_PAYMENT",
   "ACTIVE",
   "PAUSED",
   "ENDED",
   "CANCELLED",
]);

export const AD_PLACEMENTS = /** @type {const} */ ([
   "SPONSORED_PRODUCT",
   "FEATURED_VENDOR",
   "PROMOTED_TRAINING",
   "SEARCH_BOOST",
   "HOMEPAGE_FEATURED",
]);
