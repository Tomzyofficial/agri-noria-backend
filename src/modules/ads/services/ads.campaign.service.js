/**
 * Campaign lifecycle: create, pay, pause, resume, update, delete.
 * @module modules/ads/services/ads.campaign.service
 */

import pool from "../../../lib/connect.js";
import { assertPlacementTarget } from "../helpers/placementTarget.rules.js";
import {
   verifyProductOwnership,
   verifyTrainingOwnership,
   verifyVendorProfileOwnership,
   verifyVendorExists,
} from "../helpers/ownership.helpers.js";
import {
   insertCampaign,
   updatePaystackReference,
   selectCampaignForVendor,
   listCampaignsByVendor,
   updateCampaignEditable,
   setCampaignStatus,
   deleteCampaignIfAllowed,
} from "../queries/campaign.queries.js";
import { initializeAdCampaignPayment, verifyAdTransaction } from "./ads.payment.service.js";
import { settleAdCampaignFromChargeSuccess } from "./ads.settlement.service.js";

/**
 * @param {object} p
 * @param {string} p.vendorId
 * @param {string} p.targetType
 * @param {string} p.targetId
 * @param {string} p.placement
 * @returns {Promise<{ ok: true } | { ok: false, message: string }>}
 */
export async function verifyAdTarget({ vendorId, targetType, targetId, placement }) {
   const pt = assertPlacementTarget(placement, targetType, vendorId, targetId);
   if (!pt.ok) return { ok: false, message: pt.message };

   if (targetType === "PRODUCT") {
      const ok = await verifyProductOwnership(vendorId, targetId);
      return ok ? { ok: true } : { ok: false, message: "You do not own this product listing" };
   }
   if (targetType === "TRAINING") {
      const ok = await verifyTrainingOwnership(vendorId, targetId);
      return ok ? { ok: true } : { ok: false, message: "You do not own this training session" };
   }
   if (targetType === "VENDOR") {
      if (!verifyVendorProfileOwnership(vendorId, targetId)) {
         return { ok: false, message: "Vendor promotions must target your own vendor account" };
      }
      const ex = await verifyVendorExists(vendorId);
      return ex ? { ok: true } : { ok: false, message: "Vendor account not found" };
   }
   return { ok: false, message: "Unsupported target type" };
}

/**
 * @param {object} input
 * @param {string} input.vendorId
 * @param {string} input.vendorEmail
 * @param {string} input.targetType
 * @param {string} input.targetId
 * @param {string} input.placement
 * @param {number} input.budget
 * @param {Date} input.startAt
 * @param {Date} input.endAt
 * @param {string} input.callbackUrl
 */
export async function createCampaignWithCheckout(input) {
   const own = await verifyAdTarget({
      vendorId: input.vendorId,
      targetType: input.targetType,
      targetId: input.targetId,
      placement: input.placement,
   });
   if (!own.ok) {
      const err = new Error(own.message);
      err.statusCode = 403;
      throw err;
   }

   const ins = await pool.query(insertCampaign, [
      input.vendorId,
      input.targetType,
      input.targetId,
      input.placement,
      "PENDING_PAYMENT",
      input.budget,
      0,
      null,
      input.startAt,
      input.endAt,
   ]);

   const campaign = ins.rows[0];

   try {
      const checkout = await initializeAdCampaignPayment({
         email: input.vendorEmail,
         campaignId: String(campaign.id),
         vendorId: input.vendorId,
         amountNaira: input.budget,
         callbackUrl: input.callbackUrl,
      });

      await pool.query(updatePaystackReference, [campaign.id, checkout.reference, input.vendorId]);

      return { campaign: { ...campaign, paystack_reference: checkout.reference }, checkout };
   } catch (e) {
      await pool.query(`UPDATE ad_campaigns SET status = 'CANCELLED'::ad_status WHERE id = $1`, [campaign.id]);
      throw e;
   }
}

/**
 * @param {string} vendorId
 */
export async function listVendorCampaigns(vendorId) {
   const { rows } = await pool.query(listCampaignsByVendor, [vendorId]);
   return rows;
}

/**
 * @param {string} campaignId
 * @param {string} vendorId
 */
export async function getVendorCampaign(campaignId, vendorId) {
   const { rows } = await pool.query(selectCampaignForVendor, [campaignId, vendorId]);
   return rows[0] ?? null;
}

/**
 * @param {string} campaignId
 * @param {string} vendorId
 * @param {{ budget?: number, startAt?: Date, endAt?: Date }} patch
 */
export async function updateVendorCampaign(campaignId, vendorId, patch) {
   const { rows } = await pool.query(updateCampaignEditable, [
      campaignId,
      patch.budget ?? null,
      patch.startAt ?? null,
      patch.endAt ?? null,
      vendorId,
   ]);
   if (rows.length === 0) {
      const err = new Error("Campaign not found or not editable in current status");
      err.statusCode = 400;
      throw err;
   }
   return rows[0];
}

/**
 * @param {string} campaignId
 * @param {string} vendorId
 */
export async function pauseCampaign(campaignId, vendorId) {
   const { rows } = await pool.query(setCampaignStatus, [campaignId, vendorId, "PAUSED"]);
   if (rows.length === 0) {
      const err = new Error("Unable to pause campaign");
      err.statusCode = 400;
      throw err;
   }
   return rows[0];
}

/**
 * Resume a paused campaign within its date window after payment.
 * @param {string} campaignId
 * @param {string} vendorId
 */
export async function activateCampaign(campaignId, vendorId) {
   const { rows } = await pool.query(
      `UPDATE ad_campaigns
       SET status = 'ACTIVE'::ad_status, updated_at = NOW()
       WHERE id = $1 AND vendor_id = $2
         AND status = 'PAUSED'::ad_status
         AND amount_paid > 0
         AND start_at <= NOW()
         AND end_at >= NOW()
       RETURNING *`,
      [campaignId, vendorId],
   );
   if (rows.length === 0) {
      const err = new Error("Campaign cannot be activated (not paused, unpaid, or outside schedule)");
      err.statusCode = 400;
      throw err;
   }
   return rows[0];
}

/**
 * @param {string} campaignId
 * @param {string} vendorId
 */
export async function deleteCampaign(campaignId, vendorId) {
   const { rows } = await pool.query(deleteCampaignIfAllowed, [campaignId, vendorId]);
   if (rows.length === 0) {
      const err = new Error("Campaign cannot be deleted in its current status");
      err.statusCode = 400;
      throw err;
   }
   return true;
}

/**
 * Manual verification after Paystack redirect (defense in depth with webhook).
 * @param {string} vendorId
 * @param {string} reference
 */
export async function verifyCampaignPaymentForVendor(vendorId, reference) {
   const verifyRes = await verifyAdTransaction(reference);
   const data = verifyRes?.data;
   if (!data || data.status !== "success") {
      const err = new Error("Payment not successful");
      err.statusCode = 400;
      throw err;
   }

   const metadata = data.metadata || {};
   if (String(metadata.vendor_id ?? metadata.vendorId) !== String(vendorId)) {
      const err = new Error("Payment does not belong to this vendor");
      err.statusCode = 403;
      throw err;
   }

   const result = await settleAdCampaignFromChargeSuccess({
      reference: data.reference,
      amount: data.amount,
      metadata,
   });
   if (!result.ok && !["duplicate", "not_pending"].includes(result.reason)) {
      const err = new Error(`Settlement failed: ${result.reason || "unknown"}`);
      err.statusCode = 400;
      throw err;
   }

   const campaignId = metadata.campaign_id ?? metadata.campaignId;
   return getVendorCampaign(String(campaignId), vendorId);
}
