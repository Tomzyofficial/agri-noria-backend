// lib/wallet/release-pending-balances.js

import pool from "../connect.js";
import cron from "node-cron";

const HOLD_WINDOW_MINUTES = 5;

// Guards against overlapping runs. node-cron does NOT wait for a
// previous invocation to finish before firing the next one — if a
// run ever takes longer than the schedule interval (a slow query,
// a big backlog, a temporarily locked table), you'd get two copies
// of this job running at once, both trying to lock the same rows.
// This flag makes a run skip itself instead of stacking up.
let isRunning = false;

export async function releaseEligiblePendingBalances() {
  const client = await pool.connect();

  let releasedCount = 0;
  let skippedCount = 0;
  let totalReleased = 0;

  try {
    await client.query("BEGIN");

    const eligible = await client.query(
      `SELECT id, wallet_id, amount, related_order_id, currency, country_code
       FROM marketplace_wallet_transactions
       WHERE type = 'credit'
         AND released = false
         AND created_at <= now() - ($1 || ' minutes')::interval
       ORDER BY created_at ASC
       FOR UPDATE`,
      [HOLD_WINDOW_MINUTES.toString()],
    );

    for (const row of eligible.rows) {
      const amount = Number(row.amount);

      const walletResult = await client.query(
        `SELECT id, balance, pending_balance FROM marketplace_wallets
         WHERE id = $1
         FOR UPDATE`,
        [row.wallet_id],
      );

      if (walletResult.rows.length === 0) {
        skippedCount++;
        continue;
      }

      const wallet = walletResult.rows[0];
      const newPendingBalance = Number(wallet.pending_balance) - amount;
      const newBalance = Number(wallet.balance) + amount;

      if (newPendingBalance < 0) {
        skippedCount++;
        continue;
      }

      await client.query(
        `UPDATE marketplace_wallets
         SET pending_balance = $1, balance = $2, updated_at = now()
         WHERE id = $3`,
        [newPendingBalance, newBalance, wallet.id],
      );

      await client.query(
        `UPDATE marketplace_wallet_transactions
         SET released = true
         WHERE id = $1`,
        [row.id],
      );

      await client.query(
        `INSERT INTO marketplace_wallet_transactions
           (wallet_id, type, amount, balance_after, reference,
            related_order_id, description, currency, country_code)
         VALUES ($1, 'release', $2, $3, $4, $5, $6, $7, $8)`,
        [
          wallet.id,
          amount,
          newBalance,
          `release_${row.id}`,
          row.related_order_id,
          `Released from pending_balance to balance after ${HOLD_WINDOW_MINUTES}m hold`,
          row.currency,
          row.country_code,
        ],
      );

      releasedCount++;
      totalReleased += amount;
    }

    await client.query("COMMIT");
    return { releasedCount, skippedCount, totalReleased };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------
// Registers the schedule. Call this ONCE, from your server's entry
// point, after the app has started — not as a side effect of just
// importing this file. This makes "is the job running?" a matter of
// checking one obvious line in your startup code, rather than hoping
// some transitive import happened to pull this file in.
// ---------------------------------------------------------
export function startPendingBalanceReleaseJob() {
  cron.schedule("*/5 * * * *", async () => {
    if (isRunning) {
      console.warn(
        "[release pending balances] Previous run still in progress — skipping this tick.",
      );
      return;
    }

    isRunning = true;
    const startedAt = Date.now();

    try {
      const result = await releaseEligiblePendingBalances();
      console.log(
        `[release pending balances] Done in ${Date.now() - startedAt}ms — ` +
          `released: ${result.releasedCount}, skipped: ${result.skippedCount}, ` +
          `total: ${result.totalReleased}`,
      );
    } catch (err) {
      console.error("[release pending balances] Job crashed:", err);
    } finally {
      isRunning = false;
    }
  });

  console.log(
    `[release pending balances] Cron job registered (every 5 minutes, ${HOLD_WINDOW_MINUTES}m hold).`,
  );
}
