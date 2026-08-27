import pool from "../../../lib/connect.js";
import { selectActiveCampaignById } from "../queries/campaign.queries.js";

const IMPRESSION_DEDUPE_WINDOW = "30 minutes";

function inetOrNull(ip) {
  if (!ip || typeof ip !== "string") return null;
  const t = ip.trim();
  if (t.length > 128) return null;
  if (/^[\d.]+$/.test(t) || t.includes(":")) return t;
  return null;
}

export async function recordImpression({
  campaignId,
  viewerUserId,
  ip,
  userAgent,
}) {
  const active = await pool.query(selectActiveCampaignById, [campaignId]);
  if (active.rowCount === 0) {
    return { ok: false, reason: "not_active" };
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      `WITH inserted AS (
          INSERT INTO ad_impressions (campaign_id, viewer_user_id, ip_address, user_agent)
          SELECT $1, $2::uuid, $3::inet, $4
          WHERE NOT EXISTS (
            SELECT 1
            FROM ad_impressions
            WHERE campaign_id = $1
              AND created_at >= NOW() - $5::interval
              AND (
                ($2::uuid IS NOT NULL AND viewer_user_id = $2::uuid)
                OR (
                  $2::uuid IS NULL
                  AND viewer_user_id IS NULL
                  AND ip_address IS NOT DISTINCT FROM $3::inet
                  AND COALESCE(user_agent, '') = COALESCE($4, '')
                )
              )
          )
          RETURNING id
        ),
        bumped AS (
          UPDATE ad_campaigns
          SET impressions_count = impressions_count + 1, updated_at = NOW()
          WHERE id = $1
            AND EXISTS (SELECT 1 FROM inserted)
          RETURNING id
        )
        SELECT EXISTS (SELECT 1 FROM inserted) AS counted`,
      [
        campaignId,
        viewerUserId,
        inetOrNull(ip),
        userAgent ?? null,
        IMPRESSION_DEDUPE_WINDOW,
      ],
    );
    await client.query("COMMIT");
    return { ok: true, counted: Boolean(rows[0]?.counted) };
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("[ads.tracking.impression]", e);
    return { ok: false, reason: "db_error" };
  } finally {
    client.release();
  }
}

export async function recordClick({ campaignId, viewerUserId, ip, userAgent }) {
  const active = await pool.query(selectActiveCampaignById, [campaignId]);
  if (active.rowCount === 0) {
    return { ok: false, reason: "not_active" };
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO ad_clicks (campaign_id, viewer_user_id, ip_address, user_agent)
          VALUES ($1, $2, $3::inet, $4)`,
      [campaignId, viewerUserId, inetOrNull(ip), userAgent ?? null],
    );
    await client.query(
      `UPDATE ad_campaigns SET clicks_count = clicks_count + 1, updated_at = NOW() WHERE id = $1`,
      [campaignId],
    );
    await client.query("COMMIT");
    return { ok: true };
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("[ads.tracking.click]", e);
    return { ok: false, reason: "db_error" };
  } finally {
    client.release();
  }
}
