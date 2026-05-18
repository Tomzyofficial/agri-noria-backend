/**
 * Idempotent Paystack settlement → ACTIVE campaign transition.
 * @module modules/ads/services/ads.settlement.service
 */

import pool from "../../../lib/connect.js";

/**
 * @param {object} data Paystack `charge.success` data object
 * @param {string} data.reference
 * @param {number} data.amount amount in kobo
 * @param {object} [data.metadata]
 * @returns {Promise<{ ok: boolean, reason?: string }>}
 */
export async function settleAdCampaignFromChargeSuccess(data) {
   const reference = data?.reference;
   const amountKobo = data?.amount;
   const metadata = data?.metadata ?? {};
   const campaignId = metadata.campaign_id ?? metadata.campaignId;
   const vendorId = metadata.vendor_id ?? metadata.vendorId;

   if (!reference || !campaignId || !vendorId) {
      return { ok: false, reason: "missing_metadata" };
   }

   const client = await pool.connect();
   try {
      await client.query("BEGIN");

      const dup = await client.query(`SELECT 1 FROM ad_paystack_settlements WHERE paystack_reference = $1 FOR UPDATE`, [
         reference,
      ]);
      if (dup.rowCount > 0) {
         await client.query("COMMIT");
         return { ok: true, reason: "duplicate" };
      }

      const campRes = await client.query(
         `SELECT id, vendor_id, budget, status FROM ad_campaigns WHERE id = $1 FOR UPDATE`,
         [campaignId],
      );
      if (campRes.rowCount === 0) {
         await client.query("ROLLBACK");
         return { ok: false, reason: "campaign_not_found" };
      }

      const campaign = campRes.rows[0];
      if (String(campaign.vendor_id) !== String(vendorId)) {
         await client.query("ROLLBACK");
         return { ok: false, reason: "vendor_mismatch" };
      }

      if (campaign.status !== "PENDING_PAYMENT") {
         await client.query("ROLLBACK");
         return { ok: true, reason: "not_pending" };
      }

      const expectedKobo = Math.round(Number(campaign.budget) * 100);
      if (!Number.isFinite(amountKobo) || amountKobo < expectedKobo) {
         await client.query("ROLLBACK");
         return { ok: false, reason: "amount_mismatch" };
      }

      const paidNaira = amountKobo / 100;

      await client.query(
         `INSERT INTO ad_paystack_settlements (paystack_reference, campaign_id, vendor_id, amount_kobo)
          VALUES ($1, $2, $3, $4)`,
         [reference, campaignId, vendorId, amountKobo],
      );

      await client.query(
         `UPDATE ad_campaigns
          SET status = 'ACTIVE'::ad_status,
              amount_paid = $2,
              paystack_reference = COALESCE(paystack_reference, $3),
              updated_at = NOW()
          WHERE id = $1`,
         [campaignId, paidNaira, reference],
      );

      await client.query("COMMIT");
      return { ok: true };
   } catch (err) {
      await client.query("ROLLBACK");
      console.error("[ads.settlement]", err);
      throw err;
   } finally {
      client.release();
   }
}
