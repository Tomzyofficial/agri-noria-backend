// lib/wallet/reconcile-withdrawals.ts

import pool from "../connect.js";
import {
  createTransferRecipient,
  initiateTransfer,
  verifyTransfer,
} from "../services/paystack-transfer.service.js";
import cron from "node-cron";

// How long to wait before treating a request as "stuck" rather than
// just "in flight normally." Keeps the job from racing a withdrawal
// that's only 10 seconds old and genuinely still processing.
const STUCK_PENDING_MINUTES = 5;
const STUCK_PROCESSING_MINUTES = 15;

// ---------------------------------------------------------
// Case 1: Stuck 'pending' — never reached Paystack. Safe to retry.
// ---------------------------------------------------------

async function retryStuckPending() {
  const stuck = await pool.query(
    `SELECT id, wallet_id, amount, currency, account_name, account_number, bank_code, owner_id, owner_type,
          paystack_transfer_reference
     FROM payout_requests
     WHERE status = 'pending'
       AND requested_at <= now() - ($1 || ' minutes')::interval`,
    [STUCK_PENDING_MINUTES.toString()],
  );

  let retried = 0;
  let failed = 0;

  for (const row of stuck.rows) {
    let reference = row.paystack_transfer_reference || null;
    try {
      if (row.paystack_transfer_reference) {
        const existingStatus = await verifyTransfer(
          row.paystack_transfer_reference,
        );
        if (existingStatus === "success") {
          await pool.query(
            `UPDATE payout_requests
             SET status = 'paid', processed_at = now(), updated_at = now()
             WHERE id = $1 AND status = 'pending'`,
            [row.id],
          );
          retried++;
          continue;
        }
        if (existingStatus === "failed" || existingStatus === "reversed") {
          await reverseFailedWithdrawal(
            row.id,
            `Reconciled from Paystack: transfer ${existingStatus}`,
          );
          failed++;
          continue;
        }
        // A reference that Paystack still reports as pending is ambiguous.
        // Never initiate the same reference again; verify it next run.
        continue;
      }

      const recipientCode = await createTransferRecipient({
        accountName: row.account_name,
        accountNumber: row.account_number,
        bankCode: row.bank_code,
        currency: row.currency,
      });

      reference = reference || `payout_${row.id}`;

      await pool.query(
        `UPDATE payout_requests
         SET paystack_transfer_reference = $1, updated_at = now()
         WHERE id = $2 AND status = 'pending'`,
        [reference, row.id],
      );

      const transfer = await initiateTransfer({
        recipientCode,
        amountKobo: Math.round(Number(row.amount) * 100),
        reference,
        reason: `Wallet withdrawal retry for ${row.owner_type} ${row.owner_id}`,
      });

      await pool.query(
        `UPDATE payout_requests
         SET status = 'processing',
             paystack_recipient_code = $1,
             paystack_transfer_code = $2,
             paystack_transfer_reference = $3,
             updated_at = now()
         WHERE id = $4`,
        [recipientCode, transfer.transfer_code, reference, row.id],
      );

      retried++;
    } catch (err) {
      if (reference) {
        try {
          const transferStatus = await verifyTransfer(reference);
          if (transferStatus === "success") {
            await pool.query(
              `UPDATE payout_requests
               SET status = 'paid', processed_at = now(), updated_at = now()
               WHERE id = $1 AND status = 'pending'`,
              [row.id],
            );
            retried++;
            continue;
          }
          if (transferStatus === "pending") {
            continue;
          }
        } catch {
          continue;
        }
      }

      await reverseFailedWithdrawal(row.id, `Retry failed: ${String(err)}`);
      failed++;
    }
  }

  return { retried, failed };
}

// ---------------------------------------------------------
// Case 2: Stuck 'processing' — a transfer WAS sent to Paystack, but
// no webhook update has arrived. We ask Paystack directly what
// happened, rather than re-initiating (which risks a double payout).
// ---------------------------------------------------------

async function reconcileStuckProcessing() {
  const stuck = await pool.query(
    `SELECT id, paystack_transfer_code, paystack_transfer_reference
     FROM payout_requests
     WHERE status = 'processing'
       AND updated_at <= now() - ($1 || ' minutes')::interval`,
    [STUCK_PROCESSING_MINUTES.toString()],
  );

  let resolved = 0;
  let stillPending = 0;

  for (const row of stuck.rows) {
    if (!row.paystack_transfer_reference) {
      // Shouldn't happen if requestWithdrawal ran correctly, but guard
      // against it rather than crash the whole batch on one bad row.
      stillPending++;
      continue;
    }

    try {
      // Ask Paystack for the real, current status of this transfer —
      // this is the same as what GET /transfer/verify/:reference returns.
      const status = await verifyTransfer(row.paystack_transfer_reference);

      if (status === "success") {
        await pool.query(
          `UPDATE payout_requests
           SET status = 'paid', processed_at = now(), updated_at = now()
           WHERE id = $1`,
          [row.id],
        );
        resolved++;
      } else if (status === "failed" || status === "reversed") {
        await reverseFailedWithdrawal(
          row.id,
          `Reconciled from Paystack: transfer ${status}`,
        );
        resolved++;
      } else {
        // Still genuinely 'pending'/'otp' on Paystack's side — leave
        // it alone, it'll get picked up again next run (or resolved
        // by the webhook whenever it arrives).
        stillPending++;
      }
    } catch {
      // Couldn't reach Paystack to verify — leave as-is, don't guess.
      // Will be retried on the next scheduled run.
      stillPending++;
    }
  }

  return { resolved, stillPending };
}

// ---------------------------------------------------------
// Shared reversal helper for requests that were sent to Paystack but failed.
// ---------------------------------------------------------

async function reverseFailedWithdrawal(payoutRequestId, reason) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const requestResult = await client.query(
      `SELECT id, wallet_id, amount, currency, status FROM payout_requests
       WHERE id = $1 FOR UPDATE`,
      [payoutRequestId],
    );

    if (requestResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return;
    }

    const request = requestResult.rows[0];

    if (
      request.status === "failed" ||
      request.status === "reversed" ||
      request.status === "paid"
    ) {
      // Already resolved (possibly by the webhook arriving between
      // our query and now) — don't double-reverse.
      await client.query("ROLLBACK");
      return;
    }

    const walletResult = await client.query(
      `SELECT id, balance, currency, country_code FROM marketplace_wallets WHERE id = $1 FOR UPDATE`,
      [request.wallet_id],
    );

    const wallet = walletResult.rows[0];
    const amount = Number(request.amount);
    const newBalance = Number(wallet.balance) + amount;

    await client.query(
      `UPDATE marketplace_wallets SET balance = $1, updated_at = now() WHERE id = $2`,
      [newBalance, wallet.id],
    );

    await client.query(
      `INSERT INTO marketplace_wallet_transactions
         (wallet_id, type, amount, balance_after, reference,
          related_payout_request_id, description, currency, country_code)
       VALUES ($1, 'reversal', $2, $3, $4, $5, $6, $7, $8)`,
      [
        wallet.id,
        amount,
        newBalance,
        `reversal_${payoutRequestId}_${Date.now()}`, // timestamped: a request could theoretically be reversed once, retried, and reversed again
        payoutRequestId,
        `Withdrawal failed, funds returned: ${reason}`,
        request.currency || wallet.currency,
        wallet.country_code,
      ],
    );

    await client.query(
      `UPDATE payout_requests
       SET status = 'failed', failure_reason = $1, updated_at = now()
       WHERE id = $2`,
      [reason, payoutRequestId],
    );

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------
// Entry point — run this on a schedule (e.g. every 5-10 minutes)
// ---------------------------------------------------------

export async function reconcileWithdrawals() {
  const { retried, failed } = await retryStuckPending();
  const { resolved, stillPending } = await reconcileStuckProcessing();

  return {
    pendingRetried: retried,
    pendingFailed: failed,
    processingResolved: resolved,
    processingStillPending: stillPending,
  };
}

export function startWithdrawalReconciliationJob() {
  let isRunning = false;

  cron.schedule("*/30 * * * *", async () => {
    if (isRunning) return;
    isRunning = true;
    try {
      const result = await reconcileWithdrawals();
      console.log("[reconciled withdrawals] Done:", result);
    } catch (err) {
      console.error("[reconciled withdrawals] Job crashed:", err);
    } finally {
      isRunning = false;
    }
  });

  console.log(
    "[reconciled withdrawals] Cron job registered (every 30 minutes).",
  );
}
