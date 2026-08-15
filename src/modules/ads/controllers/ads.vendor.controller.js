/**
 * Vendor ads REST handlers.
 * @module modules/ads/controllers/ads.vendor.controller
 */

import {
  createCampaignSchema,
  //   updateCampaignSchema,
  campaignIdParamSchema,
  vendorAnalyticsQuerySchema,
} from "../validations/campaign.schemas.js";
import {
  createCampaignWithCheckout,
  listVendorCampaigns,
  getVendorCampaign,
  //   updateVendorCampaign,
  pauseCampaign,
  activateCampaign,
  deleteCampaign,
  verifyCampaignPaymentForVendor,
} from "../services/ads.campaign.service.js";
import {
  getVendorAdsSummary,
  getVendorEventRollup,
} from "../services/ads.analytics.service.js";
import pool from "../../../lib/connect.js";
import { computeCtrPercent } from "../utils/ctr.utils.js";

const PLACEMENT_RATES = {
  SPONSORED_PRODUCT: 500, // NGN per day
  FEATURED_VENDOR: 1500,
  PROMOTED_TRAINING: 800,
  SEARCH_BOOST: 1000,
  HOMEPAGE_FEATURED: 2000,
};

// async function resolveVendorEmail(vendorId, fallbackEmail) {
//   //   if (fallbackEmail) return fallbackEmail;
//   const { rows } = await pool.query(
//     `SELECT email FROM vendors WHERE id = $1 LIMIT 1`,
//     [vendorId],
//   );
//   console.log(rows[0]?.email);
//   return rows[0]?.email || null;
// }

export const adsVendorController = {
  async create(req, res) {
    try {
      const parsed = createCampaignSchema.safeParse(req.body);
      if (!parsed.success) {
        console.log(parsed.error.flatten());
        return res
          .status(400)
          .json({ success: false, error: parsed.error.flatten().fieldErrors });
      }
      const b = parsed.data;
      const vendorId = req.vendor.id;
      const email = req.vendor.email;
      if (!email) {
        return res.status(400).json({
          success: false,
          error: "Vendor email is required for billing",
        });
      }

      const base =
        process.env.APP_BASEURL ||
        process.env.FRONTEND_APP_URL ||
        "http://localhost:3000";
      const callbackUrl = `${base.replace(/\/$/, "")}/marketplace/store/ads`;

      const days = Math.ceil(
        (new Date(b.endAt) - new Date(b.startAt)) / 86400000,
      );
      const rate = PLACEMENT_RATES[b.placement];
      const budgetNaira = rate * days;

      const { campaign, checkout } = await createCampaignWithCheckout({
        vendorId,
        vendorEmail: email,
        targetType: b.targetType,
        targetId: b.targetId,
        placement: b.placement,
        budget: budgetNaira,
        startAt: b.startAt,
        endAt: b.endAt,
        callbackUrl,
      });

      return res.status(201).json({
        success: true,
        campaign,
        checkout: {
          authorization_url: checkout.authorization_url,
          access_code: checkout.access_code,
          reference: checkout.reference,
        },
      });
    } catch (e) {
      console.log("error", e);
      const code =
        e.statusCode && Number.isInteger(e.statusCode) ? e.statusCode : 500;
      return res.status(code).json({
        success: false,
        error: "Internal server error. Please try again later.",
      });
    }
  },

  async list(req, res) {
    try {
      const rows = await listVendorCampaigns(req.vendor.id);
      const enriched = rows.map((r) => ({
        ...r,
        ctrPercent: computeCtrPercent(r.clicks_count, r.impressions_count),
      }));
      return res.status(200).json({ success: true, campaigns: enriched });
    } catch {
      return res
        .status(500)
        .json({ success: false, error: "Failed to list campaigns" });
    }
  },

  async getOne(req, res) {
    try {
      const parsed = campaignIdParamSchema.safeParse(req.params);
      if (!parsed.success) {
        return res
          .status(400)
          .json({ success: false, error: "Invalid campaign id" });
      }
      const row = await getVendorCampaign(
        parsed.data.campaignId,
        req.vendor.id,
      );
      if (!row)
        return res.status(404).json({ success: false, error: "Not found" });
      return res.json({
        success: true,
        campaign: {
          ...row,
          ctrPercent: computeCtrPercent(
            row.clicks_count,
            row.impressions_count,
          ),
        },
      });
    } catch {
      return res.status(500).json({
        success: false,
        error: "Internal server error, please try again later.",
      });
    }
  },

  //   async update(req, res) {
  //     try {
  //       const p = campaignIdParamSchema.safeParse(req.params);
  //       if (!p.success)
  //         return res
  //           .status(400)
  //           .json({ success: false, error: "Invalid campaign id" });
  //       const parsed = updateCampaignSchema.safeParse(req.body);
  //       if (!parsed.success) {
  //         return res
  //           .status(400)
  //           .json({ success: false, error: parsed.error.flatten() });
  //       }
  //       const b = parsed.data;
  //       const row = await updateVendorCampaign(p.data.campaignId, req.vendor.id, {
  //         budget: b.budget,
  //         startAt: b.startAt,
  //         endAt: b.endAt,
  //       });
  //       return res.json({ success: true, campaign: row });
  //     } catch (e) {
  //       const code =
  //         e.statusCode && Number.isInteger(e.statusCode) ? e.statusCode : 500;
  //       return res
  //         .status(code)
  //         .json({ success: false, error: e.message || "Server error" });
  //     }
  //   },

  async pause(req, res) {
    try {
      const p = campaignIdParamSchema.safeParse(req.params);
      if (!p.success) {
        return res
          .status(400)
          .json({ success: false, error: "Invalid campaign id" });
      }
      const row = await pauseCampaign(p.data.campaignId, req.vendor.id);
      return res.status(200).json({ success: true, campaign: row });
    } catch (e) {
      const code =
        e.statusCode && Number.isInteger(e.statusCode) ? e.statusCode : 500;
      return res.status(code).json({
        success: false,
        error: "Internal server error, please try again later.",
      });
    }
  },

  async activate(req, res) {
    try {
      const p = campaignIdParamSchema.safeParse(req.params);
      if (!p.success) {
        return res
          .status(400)
          .json({ success: false, error: "Invalid campaign id" });
      }
      const row = await activateCampaign(p.data.campaignId, req.vendor.id);
      return res.status(200).json({ success: true, campaign: row });
    } catch (e) {
      const code =
        e.statusCode && Number.isInteger(e.statusCode) ? e.statusCode : 500;
      return res.status(code).json({
        success: false,
        error: "Internal server error, please try again later.",
      });
    }
  },

  async remove(req, res) {
    try {
      const p = campaignIdParamSchema.safeParse(req.params);
      if (!p.success) {
        return res
          .status(400)
          .json({ success: false, error: "Invalid campaign id" });
      }
      const deletedResult = await deleteCampaign(
        p.data.campaignId,
        req.vendor.id,
      );
      if (!deletedResult) {
        return res.status(400).json({
          success: false,
          error: "Active campaign cannot be deleted.",
        });
      }
      return res.status(200).json({ success: true });
    } catch (e) {
      const code =
        e.statusCode && Number.isInteger(e.statusCode) ? e.statusCode : 500;
      return res.status(code).json({
        success: false,
        error: "Internal server error, please try again.",
      });
    }
  },

  async verifyPayment(req, res) {
    try {
      const reference = req.query.reference || req.query.trxref;
      if (!reference || typeof reference !== "string") {
        return res
          .status(400)
          .json({ success: false, error: "Missing Paystack reference" });
      }
      const campaign = await verifyCampaignPaymentForVendor(
        req.vendor.id,
        reference,
      );
      return res.status(200).json({ success: true, campaign });
    } catch (e) {
      const code =
        e.statusCode && Number.isInteger(e.statusCode) ? e.statusCode : 500;
      return res.status(code).json({
        success: false,
        error: "Internal server error, please try again later.",
      });
    }
  },

  async summary(req, res) {
    try {
      const parsed = vendorAnalyticsQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        return res.status(400).json({ success: false, error: "Invalid query" });
      }
      const summary = await getVendorAdsSummary(req.vendor.id);
      const rollup = await getVendorEventRollup(
        req.vendor.id,
        parsed.data.from,
        parsed.data.to,
      );
      return res.json({ success: true, summary, rollup });
    } catch {
      return res.status(500).json({ success: false, error: "Server error" });
    }
  },
};
