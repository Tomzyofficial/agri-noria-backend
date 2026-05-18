/**
 * Zod validation for ads / campaigns (server-side).
 * @module modules/ads/validations/campaign.schemas
 */

import { z } from "zod";
import { AD_PLACEMENTS, AD_STATUSES, AD_TARGET_TYPES } from "../helpers/ads.enums.js";

const uuid = z.string().uuid("Invalid UUID");

export const createCampaignSchema = z
   .object({
      targetType: z.enum(AD_TARGET_TYPES),
      targetId: uuid,
      placement: z.enum(AD_PLACEMENTS),
      budget: z.coerce.number().positive("Budget must be positive"),
      startAt: z.coerce.date(),
      endAt: z.coerce.date(),
   })
   .strict()
   .superRefine((data, ctx) => {
      if (data.endAt <= data.startAt) {
         ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "endAt must be after startAt",
            path: ["endAt"],
         });
      }
   });

export const updateCampaignSchema = z
   .object({
      budget: z.coerce.number().positive().optional(),
      startAt: z.coerce.date().optional(),
      endAt: z.coerce.date().optional(),
   })
   .strict()
   .superRefine((data, ctx) => {
      if (data.startAt && data.endAt && data.endAt <= data.startAt) {
         ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "endAt must be after startAt",
            path: ["endAt"],
         });
      }
   });

export const impressionTrackSchema = z
   .object({
      campaignId: uuid,
   })
   .strict();

export const clickTrackSchema = z
   .object({
      campaignId: uuid,
   })
   .strict();

export const activeCampaignsQuerySchema = z
   .object({
      placement: z.enum(AD_PLACEMENTS).optional(),
      country: z.string().min(2).max(8).optional(),
   })
   .strict();

export const campaignIdParamSchema = z.object({
   campaignId: uuid,
});

/** Vendor analytics query (optional date filters). */
export const vendorAnalyticsQuerySchema = z
   .object({
      from: z.coerce.date().optional(),
      to: z.coerce.date().optional(),
   })
   .strict();

export const adStatusEnum = z.enum(AD_STATUSES);
