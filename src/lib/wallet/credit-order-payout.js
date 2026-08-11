import pool from "../connect.js";

async function findOrCreateWallet(
  client,
  ownerId,
  ownerType,
  currency,
  countryCode,
) {
  // Try to find an existing wallet first
  const existing = await client.query(
    `SELECT id, balance FROM marketplace_wallets
     WHERE owner_id = $1 AND owner_type = $2 AND currency = $3 AND country_code = $4
     FOR UPDATE`, // lock the row so concurrent credits serialize correctly
    [ownerId, ownerType, currency, countryCode],
  );

  if (existing.rows.length > 0) {
    return existing.rows[0];
  }

  // No wallet yet — create one. ON CONFLICT guards against a
  // race where two requests try to create the same wallet at
  // the exact same moment (extremely unlikely but cheap to guard).
  const created = await client.query(
    `INSERT INTO marketplace_wallets (owner_id, owner_type, currency, country_code)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT DO NOTHING
     RETURNING id, balance, pending_balance`,
    [ownerId, ownerType, currency, countryCode],
  );

  if (created.rows.length > 0) {
    console.log("insert and returning", created.rows[0]);
    return created.rows[0];
  }

  // If ON CONFLICT DO NOTHING fired (row already existed by the time
  // we inserted), fetch it again.
  const retry = await client.query(
    `SELECT * FROM marketplace_wallets
     WHERE owner_id = $1 AND owner_type = $2 AND currency = $3 AND country_code = $4
     FOR UPDATE`,
    [ownerId, ownerType, currency, countryCode],
  );

  console.log("retry", retry.rows[0]);
  return retry.rows[0];
}

// ---------------------------------------------------------
// Main function: credit all pending payouts for an order
// ---------------------------------------------------------
// Call this when the buyer confirms satisfaction with the order. It will credit the vendor's wallet with the net amount of each pending payout for that order. It does NOT talk to Paystack at all — pure internal ledger work.
export async function creditVendorWalletsForOrder(orderId) {
  const client = await pool.connect();

  let creditedCount = 0;
  let skippedCount = 0;
  let totalCredited = 0;

  try {
    await client.query("BEGIN");

    const payoutsResult = await client.query(
      `SELECT id, order_id, recipient_vendor_id, recipient_type, net_amount, currency, country_code, status
       FROM payouts
       WHERE order_id = $1 AND status = 'pending'
       FOR UPDATE`,
      [orderId],
    );

    const payoutRows = payoutsResult.rows;

    if (payoutRows.length === 0) {
      await client.query("COMMIT");
      return { orderId, creditedCount: 0, skippedCount: 0, totalCredited: 0 };
    }

    for (const payout of payoutRows) {
      const amount = Number(payout.net_amount);
      const reference = `credit_${payout.id}`;

      const alreadyCredited = await client.query(
        `SELECT id FROM marketplace_wallet_transactions WHERE reference = $1`,
        [reference],
      );

      if (alreadyCredited.rows.length > 0) {
        skippedCount++;
        continue;
      }

      const wallet = await findOrCreateWallet(
        client,
        payout.recipient_vendor_id,
        payout.recipient_type,
        payout.currency,
        payout.country_code,
      );

      // CHANGED: money goes into pending_balance, NOT balance.
      // It is not withdrawable yet — it becomes withdrawable when
      // the release job (below) moves it into `balance` after 48h.
      const newPendingBalance = Number(wallet.pending_balance) + amount;

      await client.query(
        `UPDATE marketplace_wallets
         SET pending_balance = $1, updated_at = now()
         WHERE id = $2`,
        [newPendingBalance, wallet.id],
      );

      // balance_after here records pending_balance's new value, since
      // that's the balance this specific transaction actually affected.
      // (balance itself is untouched by a 'credit' transaction.)
      await client.query(
        `INSERT INTO marketplace_wallet_transactions
           (wallet_id, type, amount, balance_after, reference, related_order_id, description, currency, country_code)
         VALUES ($1, 'credit', $2, $3, $4, $5, $6, $7, $8)`,
        [
          wallet.id,
          amount,
          newPendingBalance,
          reference,
          payout.order_id,
          `Order payout credited to pending_balance for order ${payout.order_id} (5 hold)`,
          payout.currency,
          payout.country_code,
        ],
      );

      await client.query(
        `UPDATE payouts
         SET status = 'credited', updated_at = now()
         WHERE id = $1`,
        [payout.id],
      );
      creditedCount++;
      totalCredited += amount;
    }

    await client.query("COMMIT");
    return { orderId, creditedCount, skippedCount, totalCredited };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
