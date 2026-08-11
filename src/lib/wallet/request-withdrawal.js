// // lib/wallet/request-withdrawal.ts

// import pool  from "../connect.js";
// import { createTransferRecipient, initiateTransfer } from "../services/paystack-transfer.service.js";

// // ---------------------------------------------------------
// // Step 1: Vendor requests a withdrawal
// // ---------------------------------------------------------
// // Debits `balance` and creates the payout_requests row inside
// // a DB transaction FIRST (so the money is reserved / can't be
// // double-spent), then calls Paystack. If Paystack fails, we
// // roll the debit back in a separate follow-up step (not inside
// // the same DB transaction, since Paystack is an external call —
// // see note below).

// export async function requestWithdrawal(
//   input
// ) {
//   const client = await pool.connect();
//   let payoutRequestId = null;

//   try {
//     await client.query("BEGIN");

//     // Lock the wallet so a double-click or concurrent request can't
//     // both read the same balance and both succeed.
//     const walletResult = await client.query(
//       `SELECT id, balance, status FROM marketplace_wallets WHERE id = $1 FOR UPDATE`,
//       [input.walletId]
//     );

//     if (walletResult.rows.length === 0) {
//       await client.query("ROLLBACK");
//       return { success: false, reason: "Wallet not found" };
//     }

//     const wallet = walletResult.rows[0];

//     if (wallet.status !== "active") {
//       await client.query("ROLLBACK");
//       return { success: false, reason: "Wallet is not active" };
//     }

//     const currentBalance = Number(wallet.balance);

//     if (input.amount <= 0) {
//       await client.query("ROLLBACK");
//       return { success: false, reason: "Withdrawal amount must be greater than zero" };
//     }

//     if (input.amount > currentBalance) {
//       await client.query("ROLLBACK");
//       return { success: false, reason: "Insufficient withdrawable balance" };
//     }

//     const newBalance = currentBalance - input.amount;

//     // Debit the wallet immediately — this reserves the funds so they
//     // can't also be withdrawn by a second concurrent request.
//     await client.query(
//       `UPDATE marketplace_wallets SET balance = $1, updated_at = now() WHERE id = $2`,
//       [newBalance, wallet.id]
//     );

//     // Create the payout_requests row — this is the thing the vendor
//     // and your admin dashboard will track the status of.
//     const payoutRequestResult = await client.query(
//       `INSERT INTO payout_requests
//          (wallet_id, owner_id, owner_type, amount, currency,
//           bank_account_id, account_name, account_number, bank_code, status)
//        VALUES ($1, $2, $3, $4, 'NGN', $5, $6, $7, $8, 'pending')
//        RETURNING id`,
//       [
//         wallet.id,
//         input.ownerId,
//         input.ownerType,
//         input.amount,
//         input.bankAccountId,
//         input.accountName,
//         input.accountNumber,
//         input.bankCode,
//       ]
//     );

//     payoutRequestId = payoutRequestResult.rows[0].id;

//     // Ledger entry for the debit. Reference is tied to the payout
//     // request id, so it's traceable and idempotent.
//     await client.query(
//       `INSERT INTO marketplace_wallet_transactions
//          (wallet_id, type, amount, balance_after, reference, related_payout_request_id, description)
//        VALUES ($1, 'debit', $2, $3, $4, $5, $6)`,
//       [
//         wallet.id,
//         input.amount,
//         newBalance,
//         `debit_${payoutRequestId}`,
//         payoutRequestId,
//         `Withdrawal requested`,
//       ]
//     );

//     await client.query("COMMIT");
//   } catch (err) {
//     await client.query("ROLLBACK");
//     throw err;
//   } finally {
//     client.release();
//   }

//   // -------------------------------------------------------
//   // Step 2: Call Paystack — OUTSIDE the DB transaction.
//   // -------------------------------------------------------
//   // Why outside: Paystack is a network call that can be slow or
//   // time out. Holding a Postgres transaction (and row locks) open
//   // while waiting on an external API is bad practice — it blocks
//   // other operations on that wallet for however long Paystack takes.
//   // Instead, we've already safely debited + recorded the request as
//   // 'pending'. Now we attempt the transfer, and update status based
//   // on the outcome. If this whole process crashes right here, the
//   // payout_request is left in 'pending' with money already debited —
//   // safe to detect and retry/reconcile later (a job that finds stale
//   // 'pending' requests and retries them).

//   try {
//     const recipientCode = await createTransferRecipient({
//       accountName: input.accountName,
//       accountNumber: input.accountNumber,
//       bankCode: input.bankCode,
//     });

//     const reference = `payout_${payoutRequestId}_${Date.now()}`;

//     const transfer = await initiateTransfer({
//       recipientCode,
//       amountKobo: Math.round(input.amount * 100), // Paystack expects kobo
//       reference,
//       reason: `Wallet withdrawal for ${input.ownerType} ${input.ownerId}`,
//     });

//     // Mark as processing — final confirmation comes via webhook (Phase 3b)
//     await pool.query(
//       `UPDATE payout_requests
//        SET status = 'processing',
//            paystack_recipient_code = $1,
//            paystack_transfer_code = $2,
//            paystack_transfer_reference = $3,
//            updated_at = now()
//        WHERE id = $4`,
//       [recipientCode, transfer.transfer_code, reference, payoutRequestId]
//     );

//     return { success: true, payoutRequestId, status: "processing" };
//   } catch (err) {
//     // Paystack call failed — reverse the debit so the vendor's money
//     // isn't stuck in limbo, and mark the request as failed.
//     await reverseFailedWithdrawal(payoutRequestId, String(err));
//     return { success: false, reason: "Failed to initiate transfer with Paystack" };
//   }
// }

// // ---------------------------------------------------------
// // Helper: reverse a failed withdrawal
// // ---------------------------------------------------------
// // Puts the debited amount back into `balance` and writes a
// // 'reversal' ledger row. Called either immediately (Paystack call
// // itself failed) or later, from the webhook handler (Phase 3b),
// // if Paystack confirms the transfer failed after being accepted.

// async function reverseFailedWithdrawal(payoutRequestId, reason) {
//   const client = await pool.connect();

//   try {
//     await client.query("BEGIN");

//     const requestResult = await client.query(
//       `SELECT id, wallet_id, amount, status FROM payout_requests
//        WHERE id = $1 FOR UPDATE`,
//       [payoutRequestId]
//     );

//     if (requestResult.rows.length === 0) {
//       await client.query("ROLLBACK");
//       return;
//     }

//     const request = requestResult.rows[0];

//     // Guard against double-reversal (e.g. Paystack call fails AND
//     // a webhook later also reports failure for the same request).
//     if (request.status === "failed" || request.status === "reversed") {
//       await client.query("ROLLBACK");
//       return;
//     }

//     const walletResult = await client.query(
//       `SELECT id, balance FROM marketplace_wallets WHERE id = $1 FOR UPDATE`,
//       [request.wallet_id]
//     );

//     const wallet = walletResult.rows[0];
//     const amount = Number(request.amount);
//     const newBalance = Number(wallet.balance) + amount;

//     await client.query(
//       `UPDATE marketplace_wallets SET balance = $1, updated_at = now() WHERE id = $2`,
//       [newBalance, wallet.id]
//     );

//     await client.query(
//       `INSERT INTO marketplace_wallet_transactions
//          (wallet_id, type, amount, balance_after, reference, related_payout_request_id, description)
//        VALUES ($1, 'reversal', $2, $3, $4, $5, $6)`,
//       [
//         wallet.id,
//         amount,
//         newBalance,
//         `reversal_${payoutRequestId}`,
//         payoutRequestId,
//         `Withdrawal failed, funds returned: ${reason}`,
//       ]
//     );

//     await client.query(
//       `UPDATE payout_requests
//        SET status = 'failed', failure_reason = $1, updated_at = now()
//        WHERE id = $2`,
//       [reason, payoutRequestId]
//     );

//     await client.query("COMMIT");
//   } catch (err) {
//     await client.query("ROLLBACK");
//     throw err;
//   } finally {
//     client.release();
//   }
// }

// lib/wallet/request-withdrawal.js
// CHANGED: takes bankAccountId only (no raw account details from the
// client). Looks the account up server-side, and reuses a cached
// paystack_recipient_code if one already exists on that row instead
// of calling createTransferRecipient every single withdrawal.

import pool from "../connect.js";
import {
  createTransferRecipient,
  initiateTransfer,
  verifyTransfer,
} from "../services/paystack-transfer.service.js";

export async function requestWithdrawal({ vendorId, amount, bankAccountId }) {
  const client = await pool.connect();
  let payoutRequestId = null;
  let bankAccount = null;
  let walletCurrency = null;
  let withdrawalAmount = null;
  let transferReference = null;

  try {
    await client.query("BEGIN");

    // Confirm this bank account actually belongs to this vendor and
    // is verified — never trust a bankAccountId blindly, since it's
    // client-supplied.
    const bankAccountResult = await client.query(
      `SELECT id, account_name, account_number, bank_code, paystack_recipient_code
       FROM vendor_bank_accounts
       WHERE id = $1 AND vendor_id = $2 AND verified = true
       FOR UPDATE`,
      [bankAccountId, vendorId],
    );

    if (bankAccountResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return {
        success: false,
        reason: "Bank account not found or not verified",
      };
    }

    bankAccount = bankAccountResult.rows[0];

    const walletResult = await client.query(
      `SELECT mw.id, mw.balance, mw.status, mw.owner_type, mw.currency, mw.country_code
       FROM marketplace_wallets mw
       INNER JOIN country_utils cu
         ON cu.vendor_id = mw.owner_id
        AND cu.currency = mw.currency
        AND cu.country_code = mw.country_code
       WHERE mw.owner_id = $1
       ORDER BY mw.updated_at DESC
       LIMIT 1
       FOR UPDATE OF mw`,
      [vendorId],
    );

    if (walletResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return { success: false, reason: "Wallet not found" };
    }

    const wallet = walletResult.rows[0];
    walletCurrency = wallet.currency;

    if (wallet.status !== "active") {
      await client.query("ROLLBACK");
      return { success: false, reason: "Wallet is not active" };
    }

    withdrawalAmount = Number(amount);
    if (
      !Number.isFinite(withdrawalAmount) ||
      withdrawalAmount <= 0 ||
      withdrawalAmount > Number(wallet.balance)
    ) {
      await client.query("ROLLBACK");
      return { success: false, reason: "Insufficient withdrawable balance" };
    }

    const newBalance = Number(wallet.balance) - withdrawalAmount;

    console.log(wallet);
    console.log(newBalance);

    await client.query(
      `UPDATE marketplace_wallets SET balance = $1, updated_at = now() WHERE id = $2`,
      [newBalance, wallet.id],
    );

    const payoutRequestResult = await client.query(
      `INSERT INTO payout_requests
         (wallet_id, owner_id, owner_type, amount, currency,
          bank_account_id, account_name, account_number, bank_code, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending')
       RETURNING id`,
      [
        wallet.id,
        vendorId,
        wallet.owner_type,
        withdrawalAmount,
        wallet.currency,
        bankAccount.id,
        bankAccount.account_name,
        bankAccount.account_number,
        bankAccount.bank_code,
      ],
    );

    payoutRequestId = payoutRequestResult.rows[0].id;

    await client.query(
      `INSERT INTO marketplace_wallet_transactions
         (wallet_id, type, amount, balance_after, reference,
          related_payout_request_id, description, currency, country_code)
       VALUES ($1, 'debit', $2, $3, $4, $5, $6, $7, $8)`,
      [
        wallet.id,
        withdrawalAmount,
        newBalance,
        `debit_${payoutRequestId}`,
        payoutRequestId,
        "Withdrawal requested",
        wallet.currency,
        wallet.country_code,
      ],
    );

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  // Paystack call happens outside the DB transaction — same reasoning
  // as before: don't hold row locks open across a network call.
  try {
    // Reuse the cached recipient_code if this account has been
    // withdrawn to before. Only call Paystack to create one on first use.
    let recipientCode = bankAccount.paystack_recipient_code;

    if (!recipientCode) {
      console.log("creating new recipient in paystack");
      recipientCode = await createTransferRecipient({
        accountName: bankAccount.account_name,
        accountNumber: bankAccount.account_number,
        bankCode: bankAccount.bank_code,
        currency: walletCurrency,
      });

      // Cache it so future withdrawals from this same account skip
      // this step entirely.
      await pool.query(
        `UPDATE vendor_bank_accounts SET paystack_recipient_code = $1, updated_at = now() WHERE id = $2`,
        [recipientCode, bankAccount.id],
      );
    }

    transferReference = `payout_${payoutRequestId}`;

    await pool.query(
      `UPDATE payout_requests
       SET paystack_transfer_reference = $1, updated_at = now()
       WHERE id = $2`,
      [transferReference, payoutRequestId],
    );

    const transfer = await initiateTransfer({
      recipientCode,
      amountKobo: Math.round(withdrawalAmount * 100),
      reference: transferReference,
      reason: `Wallet withdrawal for vendor ${vendorId}`,
    });

    console.log("transfer initiated", transfer);

    await pool.query(
      `UPDATE payout_requests
       SET status = 'processing', paystack_recipient_code = $1,
           paystack_transfer_code = $2, paystack_transfer_reference = $3, updated_at = now()
       WHERE id = $4`,
      [
        recipientCode,
        transfer.transfer_code,
        transferReference,
        payoutRequestId,
      ],
    );

    return { success: true, payoutRequestId, status: "processing" };
  } catch (err) {
    console.log("failed to initiate transfer", err);
    if (transferReference) {
      try {
        const transferStatus = await verifyTransfer(transferReference);
        if (transferStatus === "success") {
          await pool.query(
            `UPDATE payout_requests
             SET status = 'paid', processed_at = now(), updated_at = now()
             WHERE id = $1 AND status = 'pending'`,
            [payoutRequestId],
          );
          return { success: true, payoutRequestId, status: "paid" };
        }
        if (transferStatus === "pending") {
          return {
            success: true,
            payoutRequestId,
            status: "pending",
            message:
              "Withdrawal is still being confirmed by the payment provider",
          };
        }
        await reverseFailedWithdrawal(
          payoutRequestId,
          `Paystack transfer ${transferStatus}: ${String(err)}`,
        );
      } catch {
        return {
          success: true,
          payoutRequestId,
          status: "pending",
          message: "Withdrawal is awaiting payment provider confirmation",
        };
      }
    } else {
      await reverseFailedWithdrawal(payoutRequestId, String(err));
    }
    return {
      success: false,
      reason: "Failed to initiate transfer with Paystack",
    };
  }
}

export async function reverseFailedWithdrawal(payoutRequestId, reason) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const requestResult = await client.query(
      `SELECT id, wallet_id, amount, status, currency
       FROM payout_requests
       WHERE id = $1
       FOR UPDATE`,
      [payoutRequestId],
    );

    if (requestResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return;
    }

    const request = requestResult.rows[0];
    if (["failed", "reversed", "paid"].includes(request.status)) {
      await client.query("ROLLBACK");
      return;
    }

    const walletResult = await client.query(
      `SELECT id, balance, currency, country_code
       FROM marketplace_wallets
       WHERE id = $1
       FOR UPDATE`,
      [request.wallet_id],
    );

    if (walletResult.rows.length === 0) {
      throw new Error("Wallet not found while reversing withdrawal");
    }

    const wallet = walletResult.rows[0];
    const amount = Number(request.amount);
    const newBalance = Number(wallet.balance) + amount;

    await client.query(
      `UPDATE marketplace_wallets
       SET balance = $1, updated_at = now()
       WHERE id = $2`,
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
        `reversal_${payoutRequestId}`,
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
