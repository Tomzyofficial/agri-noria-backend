// controllers/bankAccount.controller.js

import pool from "../lib/connect.js";
import {
  resolveAccountNumber,
  listBanks,
} from "../lib/services/paystack-transfer.service.js";
import { verifyVendorToken } from "../sessions/vendor.auth.session.js";

async function getVendorPaymentRegion(vendorId) {
  const result = await pool.query(
    `SELECT country_code, currency
     FROM country_utils
     WHERE vendor_id = $1
     LIMIT 1`,
    [vendorId],
  );
  return result.rows[0] ?? null;
}

// ---------------------------------------------------------
// GET /wallet/banks
// Feeds the bank dropdown on the "add bank account" form.
// ---------------------------------------------------------
export async function getBanks(req, res) {
  try {
    const payload = await verifyVendorToken(req);
    if (!payload) return res.status(401).json({ error: "Not authenticated" });

    const region = await getVendorPaymentRegion(payload.id);
    if (!region?.country_code) {
      return res
        .status(422)
        .json({ error: "Vendor country is not configured" });
    }

    const banks = await listBanks({ countryCode: region.country_code });
    return res.status(200).json({ banks });
  } catch (err) {
    console.error("Failed to fetch bank list:", err);
    return res.status(502).json({ error: "Couldn't load bank list right now" });
  }
}

// ---------------------------------------------------------
// GET /wallet/bank-accounts
// Returns the vendor's saved, verified accounts — this is what
// populates the dropdown in the withdrawal modal.
// ---------------------------------------------------------
export async function getBankAccounts(req, res) {
  try {
    const payload = await verifyVendorToken(req);
    if (!payload) return res.status(401).json({ error: "Not authenticated" });

    const result = await pool.query(
      `SELECT id, account_name, account_number, bank_name, bank_code, is_default
       FROM vendor_bank_accounts
       WHERE vendor_id = $1 AND verified = true
       ORDER BY is_default DESC, created_at ASC`,
      [payload.id],
    );

    return res.status(200).json({ bankAccounts: result.rows });
  } catch (err) {
    console.error("Failed to fetch bank accounts:", err);
    return res.status(500).json({ error: "Couldn't load saved bank accounts" });
  }
}

// ---------------------------------------------------------
// POST /wallet/bank-accounts
// Body: { accountNumber, bankCode, bankName, confirmedAccountName }
//
// Two-step-in-one-request pattern is intentionally NOT used here —
// this endpoint expects the frontend to have already called
// /wallet/bank-accounts/resolve (below) and shown the vendor the
// resolved name for confirmation. This endpoint is the "yes, save
// it" step, and re-resolves server-side anyway as a trust boundary
// (never trust a name the client claims was resolved).
// ---------------------------------------------------------
// export async function addBankAccount(req, res) {
//   try {
//     const vendorId = await verifyVendorToken(req);
//     if (!vendorId) return res.status(401).json({ error: "Not authenticated" });

//     const { accountNumber, bankCode, bankName } = req.body;

//     if (!accountNumber || !bankCode) {
//       return res
//         .status(400)
//         .json({ error: "Account number and bank are required" });
//     }

//     // Re-resolve server-side. Never trust an account name passed in
//     // from the client, even if the frontend already showed it once —
//     // the request body can be tampered with between "resolve" and
//     // "save."
//     let resolved;
//     try {
//       resolved = await resolveAccountNumber({ accountNumber, bankCode });
//     } catch (err) {
//       return res.status(422).json({
//         error:
//           "Couldn't verify this account with the bank. Double-check the details.",
//       });
//     }

//     // Prevent duplicate saves of the exact same account under this vendor.
//     const existing = await pool.query(
//       `SELECT id FROM vendor_bank_accounts
//        WHERE vendor_id = $1 AND account_number = $2 AND bank_code = $3`,
//       [vendorId, accountNumber, bankCode],
//     );

//     if (existing.rows.length > 0) {
//       return res.status(409).json({ error: "This account is already saved" });
//     }

//     // If this is the vendor's first account, make it the default.
//     const countResult = await pool.query(
//       `SELECT COUNT(*) AS count FROM vendor_bank_accounts WHERE vendor_id = $1 AND verified = true`,
//       [vendorId],
//     );
//     const isFirstAccount = Number(countResult.rows[0].count) === 0;

//     const inserted = await pool.query(
//       `INSERT INTO vendor_bank_accounts
//          (vendor_id, bank_name, account_name, account_number, bank_code, verified, is_default)
//        VALUES ($1, $2, $3, $4, $5, true, $6)
//        RETURNING id, account_name, account_number, bank_name, bank_code, is_default`,
//       [
//         vendorId,
//         bankName ?? null,
//         resolved.accountName,
//         accountNumber,
//         bankCode,
//         isFirstAccount,
//       ],
//     );

//     // NOTE: we deliberately do NOT call createTransferRecipient here.
//     // Doing so eagerly for every saved account (even ones that never
//     // get withdrawn to) creates Paystack recipients you don't need.
//     // Instead, requestWithdrawal (Phase D) creates the recipient lazily
//     // on first use and caches it back onto this row.

//     return res.status(201).json({ bankAccount: inserted.rows[0] });
//   } catch (err) {
//     console.error("Failed to add bank account:", err);
//     return res.status(500).json({ error: "Couldn't save this bank account" });
//   }
// }

export async function addBankAccount(req, res) {
  try {
    const payload = await verifyVendorToken(req);
    if (!payload) return res.status(401).json({ error: "Not authenticated" });

    const { accountNumber, bankCode, bankName } = req.body;
    if (!accountNumber || !bankCode || !bankName) {
      return res.status(400).json({
        error: "Account number, bank code, and bank name are required",
      });
    }

    const resolved = await resolveAccountNumber({ accountNumber, bankCode });
    const existing = await pool.query(
      `SELECT id FROM vendor_bank_accounts
       WHERE vendor_id = $1 AND account_number = $2 AND bank_code = $3`,
      [payload.id, accountNumber, bankCode],
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: "This account is already saved" });
    }

    const countResult = await pool.query(
      `SELECT COUNT(*) AS count
       FROM vendor_bank_accounts
       WHERE vendor_id = $1 AND verified = true`,
      [payload.id],
    );
    const inserted = await pool.query(
      `INSERT INTO vendor_bank_accounts
         (vendor_id, bank_name, account_name, account_number, bank_code, verified, is_default)
       VALUES ($1, $2, $3, $4, $5, true, $6)
       RETURNING id, account_name, account_number, bank_name, bank_code, is_default`,
      [
        payload.id,
        bankName,
        resolved.accountName,
        accountNumber,
        bankCode,
        Number(countResult.rows[0].count) === 0,
      ],
    );

    return res.status(201).json({ bankAccount: inserted.rows[0] });
  } catch (err) {
    console.error("Failed to add bank account:", err);
    return res.status(422).json({
      error: "Couldn't verify or save this bank account",
    });
  }
}

// ---------------------------------------------------------
// POST /wallet/bank-accounts/resolve
// Body: { accountNumber, bankCode }
//
// The "preview" step — resolves the name WITHOUT saving anything, so
// the frontend can show "this account belongs to: X" and let the
// vendor confirm before addBankAccount is ever called.
// ---------------------------------------------------------
export async function resolveBankAccount(req, res) {
  try {
    const payload = await verifyVendorToken(req);
    if (!payload) return res.status(401).json({ error: "Not authenticated" });

    const { account_number, bank_code } = req.body;

    console.log(account_number, bank_code);
    if (!account_number || !bank_code) {
      return res
        .status(400)
        .json({ error: "Account number and bank are required" });
    }

    const resolved = await resolveAccountNumber({
      accountNumber: account_number,
      bankCode: bank_code,
    });
    return res.status(200).json(resolved);
  } catch (err) {
    console.error("Failed to resolve bank account:", err);
    return res.status(422).json({
      error:
        "Couldn't verify this account with the bank. Double-check the details.",
    });
  }
}
