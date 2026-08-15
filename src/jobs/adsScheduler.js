// jobs/adsScheduler.js
import pool from "../lib/connect.js";
import cron from "node-cron";

/**
 * Promotes SCHEDULED campaigns whose window has opened to ACTIVE,
 * and expires ACTIVE campaigns whose window has closed.
 * Run on a periodic interval (e.g. every minute) alongside the wallet auto-release job.
 */
async function runAdsScheduler() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // lock the rows we're about to touch so a concurrent run (or overlapping
    // tick if the previous run is still finishing) can't double-process them
    const { rows: toActivate } = await client.query(
      `SELECT id FROM ad_campaigns
        WHERE status = 'SCHEDULED'
          AND start_at <= NOW()
          AND end_at >= NOW()
        FOR UPDATE SKIP LOCKED`,
    );

    if (toActivate.length > 0) {
      const ids = toActivate.map((r) => r.id);
      await client.query(
        `UPDATE ad_campaigns
            SET status = 'ACTIVE'::ad_status, updated_at = NOW()
          WHERE id = ANY($1::uuid[])`,
        [ids],
      );
    }

    const { rows: toExpire } = await client.query(
      `SELECT id FROM ad_campaigns
        WHERE status = 'ACTIVE'
          AND end_at < NOW()
        FOR UPDATE SKIP LOCKED`,
    );

    if (toExpire.length > 0) {
      const ids = toExpire.map((r) => r.id);
      await client.query(
        `UPDATE ad_campaigns
            SET status = 'ENDED'::ad_status, updated_at = NOW()
          WHERE id = ANY($1::uuid[])`,
        [ids],
      );
    }

    await client.query("COMMIT");

    return {
      activated: toActivate.length,
      expired: toExpire.length,
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export const startAdsScheduler = async () => {
  cron.schedule("*/1 * * * *", async () => {
    try {
      const result = await runAdsScheduler();
      if (result.activated || result.expired) {
        console.log(
          `[ads-scheduler] activated=${result.activated} expired=${result.expired}`,
        );
      }
    } catch (err) {
      console.error("[ads-scheduler] failed:", err);
    }
  });
};
