import { z } from "zod";
import {
  AD_SURFACES,
  AD_PLACEMENTS,
  AD_STATUSES,
  AD_TARGET_TYPES,
} from "../helpers/ads.enums.js";

const uuid = z.string().uuid("Invalid UUID");

export const createCampaignSchema = z
  .object({
    surfaces: z.enum(AD_SURFACES),
    targetType: z.enum(AD_TARGET_TYPES),
    targetId: z
      .string()
      .uuid({ message: "Target Id must be a valid UUID string" }),
    placement: z.enum(AD_PLACEMENTS),
    startAt: z.coerce.date({
      message: "Invalid date, enter correct start date",
    }),
    endAt: z.coerce.date({ message: "Invalid date, enter correct end date" }),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.endAt <= data.startAt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "End date must be after start date",
        path: ["endAt"],
      });
    }
  });

// export const updateCampaignSchema = z
//   .object({
//     budget: z.coerce.number().positive().optional(),
//     startAt: z.coerce.date().optional(),
//     endAt: z.coerce.date().optional(),
//   })
//   .strict()
//   .superRefine((data, ctx) => {
//     if (data.startAt && data.endAt && data.endAt <= data.startAt) {
//       ctx.addIssue({
//         code: z.ZodIssueCode.custom,
//         message: "endAt must be after startAt",
//         path: ["endAt"],
//       });
//     }
//   });

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

export const adStatusEnum = z.enum(AD_STATUSES);
