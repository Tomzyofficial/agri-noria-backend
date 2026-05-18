/**
 * Paystack initialization for ad campaigns (one-off charges).
 * @module modules/ads/services/ads.payment.service
 */

import { initializePaystack, verifyPaystackTransaction } from "../../../services/paystack/paystack.service.js";

/**
 * @param {object} input
 * @param {string} input.email
 * @param {string} input.campaignId
 * @param {string} input.vendorId
 * @param {number} input.amountNaira
 * @param {string} input.callbackUrl
 * @returns {Promise<{ authorization_url: string, access_code: string, reference: string }>}
 */
export async function initializeAdCampaignPayment({ email, campaignId, vendorId, amountNaira, callbackUrl }) {
   const amountKobo = Math.round(Number(amountNaira) * 100);
   if (!Number.isFinite(amountKobo) || amountKobo < 100) {
      throw new Error("Invalid payment amount");
   }

   const initResponse = await initializePaystack("/transaction/initialize", {
      body: {
         email,
         amount: amountKobo,
         metadata: {
            category: "ad_campaign",
            campaign_id: campaignId,
            vendor_id: vendorId,
         },
         callback_url: callbackUrl,
      },
   });

   const data = initResponse?.data;
   if (!data?.reference || !data?.authorization_url) {
      throw new Error("Paystack did not return a valid checkout payload");
   }

   return {
      authorization_url: data.authorization_url,
      access_code: data.access_code,
      reference: data.reference,
   };
}

/**
 * @param {string} reference
 */
export async function verifyAdTransaction(reference) {
   return verifyPaystackTransaction(reference);
}
