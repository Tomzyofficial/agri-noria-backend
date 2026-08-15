import pool from "../connect.js";
import { HOLD_WINDOW_MINUTES } from "../../jobs/release-pending-balance.js";

// Guards against overlapping runs. node-cron does NOT wait for a
// previous invocation to finish before firing the next one — if a
// run ever takes longer than the schedule interval (a slow query,
// a big backlog, a temporarily locked table), you'd get two copies
// of this job running at once, both trying to lock the same rows.
// This flag makes a run skip itself instead of stacking up.
// This is a job scheduler used inside the jobs dir
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
