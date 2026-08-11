// lib/paystack.ts (add/replace these functions)

const PAYSTACK_BASE_URL = "https://api.paystack.co";
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

const paystackHeaders = {
  Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
  "Content-Type": "application/json",
};

export async function resolveAccountNumber({ accountNumber, bankCode }) {
  const url = `${PAYSTACK_BASE_URL}/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`;

  const response = await fetch(url, {
    method: "GET",
    headers: paystackHeaders,
  });
  const data = await response.json();

  if (!response.ok || !data.status) {
    console.error("resolve error", data.message, response.status);
    // Paystack returns a clear error here for invalid account/bank
    // combos — surface it directly rather than a generic message.
    throw new Error(data.message ?? "Could not resolve account number");
  }

  return {
    accountName: data.data.account_name,
    accountNumber: data.data.account_number,
  };
}

// ---------------------------------------------------------
// listBanks
// ---------------------------------------------------------
// Powers the "select your bank" dropdown when a vendor adds an
// account, so they pick from Paystack's actual supported bank list
// (name + code) instead of you hardcoding one.
// ---------------------------------------------------------
export async function listBanks({ countryCode }) {
  if (!countryCode) {
    throw new Error("Country code is required to fetch banks");
  }

  const paystackCountryNames = {
    NG: "nigeria",
    GH: "ghana",
    ZA: "south africa",
    KE: "kenya",
  };
  const country = paystackCountryNames[countryCode.toUpperCase()];
  if (!country) {
    throw new Error(
      `Paystack bank transfers are not configured for ${countryCode}`,
    );
  }

  const response = await fetch(
    `${PAYSTACK_BASE_URL}/bank?country=${encodeURIComponent(country)}`,
    {
      method: "GET",
      headers: paystackHeaders,
    },
  );
  const data = await response.json();

  if (!response.ok || !data.status) {
    console.log("not found", data.message);
    throw new Error(data.message ?? "Could not fetch bank list");
  }

  return data.data.map((bank) => ({ name: bank.name, code: bank.code }));
}

// ---------------------------------------------------------
// createTransferRecipient
// ---------------------------------------------------------
// Paystack requires a "transfer recipient" object to exist before
// you can send money to a bank account. If the same account number +
// bank code was already registered as a recipient before, Paystack
// returns the SAME recipient_code rather than erroring — that's the
// behavior you saw earlier with Tomzy / Chukwuebuka Ibeh sharing a code.

export async function createTransferRecipient(params) {
  if (!params.currency) {
    throw new Error("Currency is required to create a transfer recipient");
  }

  const response = await fetch(`${PAYSTACK_BASE_URL}/transferrecipient`, {
    method: "POST",
    headers: paystackHeaders,
    body: JSON.stringify({
      type: "nuban",
      name: params.accountName,
      account_number: params.accountNumber,
      bank_code: params.bankCode,
      currency: params.currency,
    }),
  });

  const data = await response.json();

  if (!response.ok || !data.status) {
    throw new Error(
      `Failed to create transfer recipient: ${data.message ?? "Unknown error"}`,
    );
  }

  return data.data.recipient_code;
}

// ---------------------------------------------------------
// initiateTransfer  (SINGLE transfer — POST /transfer)
// ---------------------------------------------------------
// This is what request-withdrawal.ts and reconcile-withdrawals.ts
// should call. It sends ONE transfer for ONE payout_request at a
// time — distinct from initiateBulkTransfer (POST /transfer/bulk),
// which sends an array of transfers in a single call and is no
// longer used in this flow, since withdrawals are now vendor-
// initiated and asynchronous, not batched on order confirmation.

export async function initiateTransfer(params) {
  const response = await fetch(`${PAYSTACK_BASE_URL}/transfer`, {
    method: "POST",
    headers: paystackHeaders,
    body: JSON.stringify({
      source: "balance",
      amount: params.amountKobo,
      recipient: params.recipientCode,
      reference: params.reference,
      reason: params.reason,
    }),
  });

  const data = await response.json();

  if (!response.ok || !data.status) {
    // Paystack returns this exact message when the business account
    // hasn't completed KYC/verification for third-party payouts —
    // this is the error from your original test.
    console.log("failed to initiate transfer", response.status, data.message);
    throw new Error(
      `Failed to initiate transfer: ${data.message ?? "Unknown error"}`,
    );
  }

  return {
    transfer_code: data.data.transfer_code,
    status: data.data.status,
  };
}

// ---------------------------------------------------------
// verifyTransfer  (GET /transfer/verify/:reference)
// ---------------------------------------------------------
// Used by the reconciliation job to ask Paystack directly what
// happened to a transfer when your webhook never arrived. Normalizes
// Paystack's raw status into the small set of values your reconcile
// job checks against.

export async function verifyTransfer(reference) {
  const response = await fetch(
    `${PAYSTACK_BASE_URL}/transfer/verify/${reference}`,
    {
      method: "GET",
      headers: paystackHeaders,
    },
  );

  const data = await response.json();

  if (!response.ok || !data.status) {
    throw new Error(
      `Failed to verify transfer: ${data.message ?? "Unknown error"}`,
    );
  }

  const rawStatus = data.data.status;

  // Paystack's raw statuses include: success, failed, reversed, pending,
  // otp (awaiting OTP confirmation), abandoned. We collapse anything
  // that isn't a clear success/failed/reversed into "pending" so the
  // reconcile job just leaves it alone and checks again next run.
  if (rawStatus === "success") return "success";
  if (rawStatus === "failed") return "failed";
  if (rawStatus === "reversed") return "reversed";
  return "pending";
}
