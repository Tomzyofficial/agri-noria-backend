import pool from "../../lib/connect";

export async function retrieveRecipientsAccountDetails(vendorId) {
  const { result } = await pool.query(
    "SELECT bank_name, account_name, account_number FROM vendor_bank_accounts WHERE vendor_id = ANY($1)",
    [vendorId],
  );
  return result.rows;
}

export async function getPendingPayouts(orderId, client) {
    const { rows } = await client.query(
        `
        SELECT *
        FROM payouts
        WHERE order_id=$1
        AND status='pending'
        `,
        [orderId]
    );

    return rows;
}

export async function insertIntoEscrow(orderId, ) {
   const {result} = await pool.query("INSERT INTO ")
}

// export async function updateOrderStatus(orderId) {
//   const { result } = await pool.query(
//     "UPDATE orders SET status = $1 WHERE id = $2",
//     [status, orderId],
//   );
//   return result.rows;
// }

