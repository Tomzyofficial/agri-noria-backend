import crypto from "crypto";

const PAYSTACK_BASE_URL = "https://api.paystack.co";
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

if (!PAYSTACK_SECRET_KEY) {
  // Fail loudly at boot rather than silently failing every transfer call later.
  console.warn("[paystack.service] PAYSTACK_SECRET_KEY is not set in env.");
}

async function paystackRequest(path, { method = "GET", body } = {}) {
  const res = await fetch(`${PAYSTACK_BASE_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json();

  if (!res.ok || data.status === false) {
    const err = new Error(data.message || `Paystack request to ${path} failed`);
    err.paystackResponse = data;
    err.statusCode = res.status;
    throw err;
  }

  return data; // { status, message, data }
}

/**
 * Creates a Paystack transfer recipient for a vendor's bank account.
 * Call this once per vendor_bank_accounts row and cache the recipient_code —
 * don't recreate it on every payout.
 *
 * @param {{ account_name: string, account_number: string, bank_code: string, currency?: string }} bankAccount
 * @returns {Promise<string>} recipient_code
 */
export async function createTransferRecipient(bankAccount) {
  const data = await paystackRequest("/transferrecipient", {
    method: "POST",
    body: {
      type: "nuban",
      name: bankAccount.account_name,
      account_number: bankAccount.account_number,
      bank_code: bankAccount.bank_code,
      currency: bankAccount.currency || "NGN",
    },
  });

  return data.data.recipient_code;
}

/**
 * Initiates a bulk transfer. Amounts must already be in kobo (NGN * 100).
 *
 * @param {{ recipient_code: string, amount: number, reference: string, reason?: string }[]} transfers
 * @param {string} currency
 * @returns {Promise<Array>} Paystack's per-transfer result array
 */
export async function initiateBulkTransfer(transfers, currency = "NGN") {
  const data = await paystackRequest("/transfer/bulk", {
    method: "POST",
    body: {
      currency,
      source: "balance",
      transfers: transfers.map((t) => ({
        amount: t.amount,
        reference: t.reference,
        recipient: t.recipient_code,
        reason: t.reason || "Order payout",
      })),
    },
  });

  // Paystack returns { data: [ { reference, recipient, amount, status (or error), transfer_code, ... } ] }
  return data.data;
}

/**
 * Verifies that a webhook payload genuinely came from Paystack.
 * @param {Buffer|string} rawBody - the RAW (unparsed) request body
 * @param {string} signatureHeader - value of the `x-paystack-signature` header
 */
export function verifyWebhookSignature(rawBody, signatureHeader) {
  if (!signatureHeader) return false;

  const hash = crypto
    .createHmac("sha512", PAYSTACK_SECRET_KEY)
    .update(rawBody)
    .digest("hex");

  return hash === signatureHeader;
}
