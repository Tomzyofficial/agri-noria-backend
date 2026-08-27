import pool from "../../../lib/connect.js";
import { assertPlacementTarget } from "../helpers/placementTarget.rules.js";
// import {
//   verifyProductOwnership,
//   verifyStorageOwnership,
//   verifyLogisticsOwnership,
//   verifyFarmServiceOwnership,
//   verifyTrainingOwnership,
//   verifyJobOwnership,
//   verifyVendorExists,
// } from "../helpers/ownership.helpers.js";
import verifyOwnership from "../helpers/ownership.helpers.js";
import {
  insertCampaign,
  updatePaystackReference,
  selectCampaignForVendor,
  listCampaignsByVendor,
  //   updateCampaignEditable,
  setCampaignStatus,
  deleteCampaignIfAllowed,
} from "../queries/campaign.queries.js";
import {
  initializeAdCampaignPayment,
  verifyAdTransaction,
} from "./ads.payment.service.js";
import { settleAdCampaignFromChargeSuccess } from "./ads.settlement.service.js";

export async function verifyAdTarget({
  vendorId,
  targetType,
  targetId,
  surfaces,
}) {
  const pt = assertPlacementTarget(surfaces, targetType);
  if (!pt.ok) return { ok: false, message: pt.message };

  if (targetType === "Product") {
    const ok = await verifyOwnership.product(vendorId, targetId);
    return ok
      ? { ok: true }
      : { ok: false, message: "You do not own this product listing" };
  }
  if (targetType === "Storage_listing") {
    const ok = await verifyOwnership.storage(vendorId, targetId);
    return ok
      ? { ok: true }
      : { ok: false, message: "You do not own this storage facility" };
  }
  if (targetType === "Logistics_service") {
    const ok = await verifyOwnership.logistics(vendorId, targetId);
    return ok
      ? { ok: true }
      : { ok: false, message: "You do not own this logistics service" };
  }
  if (targetType === "Farm_service") {
    const ok = await verifyOwnership.farmService(vendorId, targetId);
    return ok
      ? { ok: true }
      : { ok: false, message: "You do not own this farm service listing" };
  }
  if (targetType === "Agricultural_training") {
    const ok = await verifyOwnership.training(vendorId, targetId);
    return ok
      ? { ok: true }
      : { ok: false, message: "You do not own this training" };
  }
  if (targetType === "Agricultural_employment") {
    const ok = await verifyOwnership.job(vendorId, targetId);
    return ok
      ? { ok: true }
      : { ok: false, message: "You do not own this job listing" };
  }
  return { ok: false, message: "Unsupported target type" };
}

export async function createCampaignWithCheckout(input) {
  const own = await verifyAdTarget({
    vendorId: input.vendorId,
    targetType: input.targetType,
    targetId: input.targetId,
    surfaces: input.surfaces,
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
    input.surfaces,
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

    await pool.query(updatePaystackReference, [
      campaign.id,
      checkout.reference,
      input.vendorId,
    ]);

    return {
      campaign: { ...campaign, paystack_reference: checkout.reference },
      checkout,
    };
  } catch (e) {
    await pool.query(
      `UPDATE ad_campaigns SET status = 'CANCELLED'::ad_status WHERE id = $1`,
      [campaign.id],
    );
    throw e;
  }
}

export async function listVendorCampaigns(vendorId) {
  const { rows } = await pool.query(listCampaignsByVendor, [vendorId]);
  return rows;
}

export async function getVendorCampaign(campaignId, vendorId) {
  const { rows } = await pool.query(selectCampaignForVendor, [
    campaignId,
    vendorId,
  ]);
  return rows[0] ?? null;
}

// export async function updateVendorCampaign(campaignId, vendorId, patch) {
//   const { rows } = await pool.query(updateCampaignEditable, [
//     campaignId,
//     patch.budget ?? null,
//     patch.startAt ?? null,
//     patch.endAt ?? null,
//     vendorId,
//   ]);
//   if (rows.length === 0) {
//     const err = new Error(
//       "Campaign not found or not editable in current status",
//     );
//     err.statusCode = 400;
//     throw err;
//   }
//   return rows[0];
// }

export async function pauseCampaign(campaignId, vendorId) {
  const { rows } = await pool.query(setCampaignStatus, [
    campaignId,
    vendorId,
    "PAUSED",
  ]);
  if (rows.length === 0) {
    const err = new Error("Unable to pause campaign");
    err.statusCode = 400;
    throw err;
  }
  return rows[0];
}

export async function activateCampaign(campaignId, vendorId) {
  const { rows } = await pool.query(
    `UPDATE ad_campaigns
        SET status = CASE WHEN start_at <= NOW() THEN 'ACTIVE'::ad_status ELSE 'SCHEDULED'::ad_status END, updated_at = NOW()
        WHERE id = $1 AND vendor_id = $2
          AND status = 'PAUSED'::ad_status
          AND amount_paid > 0
        RETURNING *`,
    [campaignId, vendorId],
  );
  if (rows.length === 0) {
    console.log("error");
    const err = new Error(
      "Campaign cannot be activated (not paused, unpaid, or outside schedule)",
    );
    err.statusCode = 400;
    throw err;
  }
  return rows[0];
}

export async function deleteCampaign(campaignId, vendorId) {
  const { rows } = await pool.query(deleteCampaignIfAllowed, [
    campaignId,
    vendorId,
  ]);
  if (rows.length === 0) {
    return false;
  }
  return true;
}

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
