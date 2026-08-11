import { z } from "zod";
import pool from "../lib/connect.js";
import { verifyVendorToken } from "../sessions/vendor.auth.session.js";
import { requestWithdrawal } from "../lib/wallet/request-withdrawal.js";

const DEFAULT_PAGE_SIZE = 8;
const MAX_PAGE_SIZE = 50;
const HOLD_WINDOW_MINUTES = 5;

async function getWalletByOwner(ownerId) {
  const result = await pool.query(
    `SELECT mw.id, mw.balance, mw.pending_balance, mw.currency, mw.country_code, mw.status
     FROM marketplace_wallets mw
     INNER JOIN country_utils cu
       ON cu.vendor_id = mw.owner_id
      AND cu.currency = mw.currency
      AND cu.country_code = mw.country_code
     WHERE mw.owner_id = $1
     ORDER BY mw.updated_at DESC
     LIMIT 1`,
    [ownerId],
  );
  return result.rows[0] ?? null;
}

export async function getWalletSummary(req, res) {
  try {
    const payload = await verifyVendorToken(req);

    if (!payload.id) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const wallet = await getWalletByOwner(payload.id);

    if (!wallet) {
      return res.status(200).json({
        availableBalance: 0,
        pendingBalance: 0,
        lifetimeEarned: 0,
        nextReleaseAt: null,
        currency: null,
        countryCode: null,
      });
    }

    // Lifetime earned = total of every 'credit' ever recorded for this
    // wallet, regardless of whether it's since been released or not.
    // This is a running historical total, not a current balance.
    const lifetimeResult = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) AS lifetime_earned
       FROM marketplace_wallet_transactions
       WHERE wallet_id = $1 AND type = 'credit'`,
      [wallet.id],
    );

    // Next release = the oldest still-unreleased credit's created_at,
    // plus the hold window. If there's nothing pending, this is null
    // and the UI should just say "nothing on hold."
    const nextReleaseResult = await pool.query(
      `SELECT (created_at + ($1 || ' minutes')::interval) AS next_release_at
       FROM marketplace_wallet_transactions
       WHERE wallet_id = $2 AND type = 'credit' AND released = false
       ORDER BY created_at ASC
       LIMIT 1`,
      [HOLD_WINDOW_MINUTES.toString(), wallet.id],
    );

    return res.status(200).json({
      availableBalance: Number(wallet.balance),
      pendingBalance: Number(wallet.pending_balance),
      lifetimeEarned: Number(lifetimeResult.rows[0].lifetime_earned),
      nextReleaseAt: nextReleaseResult.rows[0]?.next_release_at ?? null,
      currency: wallet.currency,
      countryCode: wallet.country_code,
    });
  } catch (err) {
    console.error("Failed to fetch wallet summary:", err);
    return res.status(500).json({ error: "Couldn't load wallet summary" });
  }
}

export async function requestVendorWithdrawal(req, res) {
  try {
    const payload = await verifyVendorToken(req);
    if (!payload) return res.status(401).json({ error: "Not authenticated" });

    const amount = Number(req.body?.amount);
    const bankAccountId = req.body?.bankAccountId;
    if (!Number.isFinite(amount) || amount <= 0 || !bankAccountId) {
      return res.status(400).json({
        error: "A valid withdrawal amount and bank account are required",
      });
    }

    const result = await requestWithdrawal({
      vendorId: payload.id,
      amount,
      bankAccountId,
    });

    if (!result.success) {
      console.log("result from wallet controller", result);
      return res.status(422).json({ error: result.reason });
    }

    return res.status(200).json({
      success: true,
      message:
        result.status === "pending"
          ? "Withdrawal submitted and awaiting payment confirmation"
          : "Withdrawal submitted successfully",
      data: result,
    });
  } catch (err) {
    console.error("Failed to request vendor withdrawal:", err);
    return res.status(500).json({ error: "Couldn't process withdrawal" });
  }
}

// ---------------------------------------------------------
// Query param validation for the transactions endpoint.
// Coerces page/pageSize from strings (query params are always
// strings) into numbers, and caps pageSize so nobody can request
// page size 100000 and hammer the DB.
// ---------------------------------------------------------
const transactionsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .max(MAX_PAGE_SIZE)
    .default(DEFAULT_PAGE_SIZE),
  search: z.string().trim().max(255).optional(),
  type: z
    .enum(["all", "credit", "release", "debit", "reversal"])
    .default("all"),
});

// ---------------------------------------------------------
// GET /wallet/transactions?page=1&pageSize=8&search=&type=all
//
// Maps onto TransactionHistory's search/filter/pagination. Filtering
// and pagination both happen in SQL, not in JS, so this stays fast
// as transaction volume grows.
// ---------------------------------------------------------
export async function getWalletTransactions(req, res) {
  try {
    const payload = await verifyVendorToken(req);

    if (!payload) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const parsed = transactionsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({
        error: "Invalid query parameters",
        details: parsed.error.flatten(),
      });
    }
    const { page, pageSize, search, type } = parsed.data;

    const wallet = await getWalletByOwner(payload.id);

    if (!wallet) {
      return res.status(200).json({
        transactions: [],
        total: 0,
        page,
        pageSize,
        totalPages: 1,
      });
    }

    // Build WHERE clause dynamically but safely — every value is still
    // passed as a bound parameter, never string-concatenated into the
    // query itself.
    const conditions = ["wallet_id = $1"];
    const params = [wallet.id];

    if (type !== "all") {
      params.push(type);
      conditions.push(`type = $${params.length}`);
    }

    if (search) {
      params.push(`%${search}%`);
      const searchParamIndex = params.length;
      conditions.push(
        `(description ILIKE $${searchParamIndex} OR reference ILIKE $${searchParamIndex})`,
      );
    }

    const whereClause = conditions.join(" AND ");

    // Total count for pagination — run alongside the page query.
    const countResult = await pool.query(
      `SELECT COUNT(*) AS total FROM marketplace_wallet_transactions WHERE ${whereClause}`,
      params,
    );
    const total = Number(countResult.rows[0].total);
    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    // Page query — LIMIT/OFFSET added as the final two params.
    const offset = (page - 1) * pageSize;
    const limitParamIndex = params.length + 1;
    const offsetParamIndex = params.length + 2;

    const rowsResult = await pool.query(
      `SELECT id, type, amount, balance_after, reference, related_order_id, description, created_at, currency, country_code
       FROM marketplace_wallet_transactions
       WHERE ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${limitParamIndex} OFFSET $${offsetParamIndex}`,
      [...params, pageSize, offset],
    );

    // Reshape rows to match what WalletPage's TransactionHistory expects
    // (camelCase `date`/`balanceAfter` instead of raw DB column names).
    const transactions = rowsResult.rows.map((row) => ({
      id: row.id,
      type: row.type,
      amount: Number(row.amount),
      balanceAfter: Number(row.balance_after),
      description: row.description,
      reference: row.reference,
      date: row.created_at,
      currency: row.currency,
      countryCode: row.country_code,
    }));

    return res
      .status(200)
      .json({ transactions, total, page, pageSize, totalPages });
  } catch (err) {
    console.error("Failed to fetch wallet transactions:", err);
    return res.status(500).json({ error: "Couldn't load transaction history" });
  }
}
