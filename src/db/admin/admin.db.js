import pool from "../../lib/connect.js";

// Get all vendors (users) for super admin
async function getAllUsers() {
   const { rows } = await pool.query(
      `SELECT id, fname, lname, email, phone, account_type, is_active, is_verified, is_suspended, created_at 
       FROM vendors 
       ORDER BY created_at DESC`,
   );
   return rows;
}

// Get user count by role
async function getUserCountByRole() {
   const { rows } = await pool.query(
      `SELECT account_type, COUNT(*) as count 
       FROM vendors 
       GROUP BY account_type 
       ORDER BY count DESC`,
   );
   return rows;
}

// Get total user count
async function getTotalUserCount() {
   const { rows } = await pool.query("SELECT COUNT(*) as total FROM vendors");
   return parseInt(rows[0]?.total || 0);
}

// Get all buyers
async function getAllBuyers() {
   const { rows } = await pool.query(
      `SELECT buyer_id, name, email, auth_provider, created_at 
       FROM buyers 
       ORDER BY created_at DESC`,
   );
   return rows;
}

// Toggle user suspension
async function toggleUserSuspension(userId, suspended) {
   const { rows } = await pool.query(
      "UPDATE vendors SET is_suspended = $1, updated_at = now() WHERE id = $2 RETURNING *",
      [suspended, userId],
   );
   return rows[0];
}

// Get all buyer agreements (with aggregator and buyer details)
async function getAllAgreements() {
   const { rows } = await pool.query(
      `SELECT 
         ba.id, ba.aggregator_id, ba.buyer_id, ba.financing_amount, ba.status, 
         ba.payment_status, ba.created_at, ba.updated_at,
         v.fname as aggregator_fname, v.lname as aggregator_lname, v.email as aggregator_email,
         ab.buyer_name, ab.buyer_email
       FROM buyer_agreements ba
       LEFT JOIN vendors v ON ba.aggregator_id = v.id
       LEFT JOIN aggregator_buyers ab ON ba.buyer_id = ab.id
       ORDER BY ba.created_at DESC`,
   );
   return rows;
}

// Get escrow payments with agreement details
async function getAllEscrowPayments() {
   const { rows } = await pool.query(
      `SELECT 
         ep.id, ep.agreement_id, ep.amount, ep.status, ep.released_at, ep.created_at,
         ba.financing_amount, ba.status as agreement_status,
         ab.buyer_name, v.fname as aggregator_fname, v.lname as aggregator_lname
       FROM escrow_payments ep
       LEFT JOIN buyer_agreements ba ON ep.agreement_id = ba.id
       LEFT JOIN aggregator_buyers ab ON ba.buyer_id = ab.id
       LEFT JOIN vendors v ON ba.aggregator_id = v.id
       ORDER BY ep.created_at DESC`,
   );
   return rows;
}

// Get finance wallets
async function getAllFinanceWallets() {
   const { rows } = await pool.query(
      `SELECT 
         fw.id, fw.finance_user_id, fw.balance, fw.held_in_escrow, fw.distributed,
         v.fname, v.lname, v.email, fw.created_at
       FROM finance_wallets fw
       JOIN vendors v ON fw.finance_user_id = v.id
       ORDER BY fw.updated_at DESC`,
   );
   return rows;
}

// Get all wallet transactions
async function getAllWalletTransactions(limit = 100) {
   const { rows } = await pool.query(
      `SELECT 
         wt.id, wt.wallet_id, wt.type, wt.amount, wt.description, wt.status, wt.created_at,
         w.owner_type, w.owner_id
       FROM wallet_transactions wt
       LEFT JOIN wallets w ON wt.wallet_id = w.id
       ORDER BY wt.created_at DESC
       LIMIT $1`,
      [limit],
   );
   return rows;
}

// Get dashboard statistics
async function getDashboardStats() {
   const [vendorCount, buyerCount, agreementCount, escrowTotal, totalBalance] = await Promise.all([
      pool.query("SELECT COUNT(*) as count FROM vendors"),
      pool.query("SELECT COUNT(*) as count FROM buyers"),
      pool.query("SELECT COUNT(*) as count FROM buyer_agreements"),
      pool.query("SELECT COALESCE(SUM(amount), 0) as total FROM escrow_payments WHERE status = 'held'"),
      pool.query("SELECT COALESCE(SUM(balance), 0) as total FROM wallets"),
   ]);

   return {
      total_vendors: parseInt(vendorCount.rows[0]?.count || 0),
      total_buyers: parseInt(buyerCount.rows[0]?.count || 0),
      total_agreements: parseInt(agreementCount.rows[0]?.count || 0),
      escrow_held: parseFloat(escrowTotal.rows[0]?.total || 0),
      total_balance: parseFloat(totalBalance.rows[0]?.total || 0),
   };
}

// Get monthly user growth (last 12 months)
async function getMonthlyUserGrowth() {
   const { rows } = await pool.query(
      `SELECT 
         TO_CHAR(DATE_TRUNC('month', gs.month), 'Mon') as month,
         TO_CHAR(DATE_TRUNC('month', gs.month), 'YYYY-MM') as month_key,
         COALESCE(COUNT(DISTINCT v.id), 0) as users,
         COALESCE(COUNT(DISTINCT ba.id), 0) as transactions
       FROM generate_series(
         DATE_TRUNC('month', NOW() - INTERVAL '11 months'),
         DATE_TRUNC('month', NOW()),
         INTERVAL '1 month'
       ) AS gs(month)
       LEFT JOIN vendors v ON DATE_TRUNC('month', v.created_at) = gs.month
       LEFT JOIN buyer_agreements ba ON DATE_TRUNC('month', ba.created_at) = gs.month
       GROUP BY gs.month
       ORDER BY gs.month ASC`
   );
   return rows;
}

// Get agreements by status
async function getAgreementsByStatus() {
   const { rows } = await pool.query(
      `SELECT status, COUNT(*) as count
       FROM buyer_agreements
       GROUP BY status`,
   );
   return rows;
}

// Get programs with cluster counts
async function getAllProgramsWithStats() {
   const { rows } = await pool.query(
      `SELECT 
         p.id, p.name, p.description, p.created_at,
         COUNT(DISTINCT c.id) as cluster_count,
         COUNT(DISTINCT ir.id) as input_request_count
       FROM programs p
       LEFT JOIN clusters c ON p.id = c.program_id
       LEFT JOIN input_requests ir ON c.id = ir.cluster_id
       GROUP BY p.id, p.name, p.description, p.created_at
       ORDER BY p.created_at DESC`,
   );
   return rows;
}

// Get all buyers registered by aggregators (with aggregator profile details)
async function getAllAggregatorBuyers() {
   const { rows } = await pool.query(
      `SELECT ab.id, ab.buyer_name, ab.buyer_email, ab.buyer_phone, ab.aggregator_id,
              v.fname as aggregator_fname, v.lname as aggregator_lname, v.email as aggregator_email,
              v.phone as aggregator_phone, ab.created_at
       FROM aggregator_buyers ab
       LEFT JOIN vendors v ON ab.aggregator_id = v.id
       ORDER BY ab.created_at DESC`,
   );
   return rows;
}

// Get aggregators with their buyer counts and completed sales (for grouped ecosystem view)
async function getAggregatorsWithBuyerStats() {
   const { rows } = await pool.query(
      `SELECT 
         v.id as aggregator_id,
         v.fname,
         v.lname,
         v.email,
         v.phone,
         v.created_at as joined_at,
         COUNT(DISTINCT ab.id) as total_buyers,
         COUNT(DISTINCT CASE WHEN ba.payment_status = 'paid' OR ba.status = 'signed' THEN ba.id END) as completed_sales
       FROM vendors v
       LEFT JOIN aggregator_buyers ab ON ab.aggregator_id = v.id
       LEFT JOIN buyer_agreements ba ON ba.aggregator_id = v.id
       WHERE v.account_type = 'Aggregator'
       GROUP BY v.id, v.fname, v.lname, v.email, v.phone, v.created_at
       ORDER BY total_buyers DESC`
   );
   return rows;
}

// Disburse funds from Finance Wallet to any Target Wallet
async function disburseFundsFromFinance(financeUserId, targetWalletId, amount, description) {
   const client = await pool.connect();
   try {
      await client.query("BEGIN");

      // Get the finance wallet
      const fwRes = await client.query(
         "SELECT * FROM finance_wallets WHERE finance_user_id = $1",
         [financeUserId]
      );

      if (fwRes.rows.length === 0) {
         throw new Error("Finance wallet not found for user");
      }

      const financeWalletId = fwRes.rows[0].id;

      if (parseFloat(fwRes.rows[0].balance) < parseFloat(amount)) {
         throw new Error("Insufficient funds in Platform Wallet");
      }

      // Deduct from finance wallet
      await client.query(
         "UPDATE finance_wallets SET balance = balance - $1, distributed = distributed + $1 WHERE id = $2",
         [amount, financeWalletId]
      );

      // Credit target wallet
      await client.query(
         "UPDATE wallets SET balance = balance + $1 WHERE id = $2",
         [amount, targetWalletId]
      );

      // Record finance transaction
      await client.query(
         "INSERT INTO finance_wallet_transactions (finance_wallet_id, type, amount, description, related_wallet_id, status) VALUES ($1, $2, $3, $4, $5, $6)",
         [financeWalletId, 'disbursement', amount, description || 'Platform Disbursement', targetWalletId, 'completed']
      );

      // Record wallet transaction
      await client.query(
         "INSERT INTO wallet_transactions (wallet_id, type, amount, description, reference_type, status) VALUES ($1, $2, $3, $4, $5, $6)",
         [targetWalletId, 'credit', amount, description || 'Received from Platform', 'disbursement', 'completed']
      );

      await client.query("COMMIT");
      return true;
   } catch (error) {
      await client.query("ROLLBACK");
      throw error;
   } finally {
      client.release();
   }
}

// Get all active entity wallets for dropdown
async function getAllEntityWallets() {
   const { rows } = await pool.query(
      `SELECT w.id, w.owner_type, w.owner_id, w.balance, v.fname, v.lname, v.email, v.company_name
       FROM wallets w
       LEFT JOIN vendors v ON w.owner_id = v.id
       ORDER BY w.owner_type, v.fname`
   );
   return rows;
}

// Get audit logs
async function getAllAuditLogs() {
   const { rows } = await pool.query(
      `SELECT id, user_id as "userId", user_email as "userEmail", action, resource, details, ip_address as "ipAddress", timestamp
       FROM audit_logs
       ORDER BY timestamp DESC`
   );
   return rows;
}

// Create an audit log entry
async function createAuditLog(userId, userEmail, action, resource, details, ipAddress) {
   const { rows } = await pool.query(
      `INSERT INTO audit_logs (user_id, user_email, action, resource, details, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [userId, userEmail, action, resource, details, ipAddress]
   );
   return rows[0];
}

// Get system settings
async function getSystemSettings() {
   const { rows } = await pool.query("SELECT key, value FROM system_settings");
   const settings = {};
   rows.forEach(row => {
      settings[row.key] = row.value;
   });
   return settings;
}

// Update system settings
async function updateSystemSettings(settings) {
   const client = await pool.connect();
   try {
      await client.query("BEGIN");
      for (const [key, value] of Object.entries(settings)) {
         await client.query(
            "INSERT INTO system_settings (key, value, updated_at) VALUES ($1, $2, now()) ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = now()",
            [key, value]
         );
      }
      await client.query("COMMIT");
      return true;
   } catch (error) {
      await client.query("ROLLBACK");
      throw error;
   } finally {
      client.release();
   }
}

// Get institution-specific analytics for dashboard
async function getInstitutionAnalytics() {
   const [ecosystemStats, inputStats, walletStats] = await Promise.all([
      pool.query(`
         SELECT 
            (SELECT COUNT(*) FROM programs) as active_programs,
            (SELECT COUNT(*) FROM farmer_profiles) as total_farmers,
            (SELECT COALESCE(SUM(target_hectares), 0) FROM programs) as total_hectares
      `),
      pool.query(`
         SELECT 
            COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
            COALESCE(SUM(total_value) FILTER (WHERE status = 'pending'), 0) as pending_value,
            COUNT(*) FILTER (WHERE status = 'approved' OR status = 'distributed') as approved_count,
            COALESCE(SUM(total_value) FILTER (WHERE status = 'approved' OR status = 'distributed'), 0) as approved_value,
            COUNT(*) FILTER (WHERE status = 'rejected') as rejected_count,
            COALESCE(SUM(total_value) FILTER (WHERE status = 'rejected'), 0) as rejected_value
         FROM input_requests
      `),
      pool.query(`
         SELECT 
            COALESCE(SUM(balance), 0) as total_balance,
            COALESCE(SUM(locked_balance), 0) as total_locked
         FROM wallets
      `)
   ]);

   return {
      overview: {
         activePrograms: parseInt(ecosystemStats.rows[0].active_programs),
         totalFarmers: parseInt(ecosystemStats.rows[0].total_farmers),
         totalHectares: parseFloat(ecosystemStats.rows[0].total_hectares),
         totalDeployed: parseFloat(inputStats.rows[0].approved_value)
      },
      disbursements: {
         pendingCount: parseInt(inputStats.rows[0].pending_count),
         pendingValue: parseFloat(inputStats.rows[0].pending_value),
         totalDisbursed: parseFloat(inputStats.rows[0].approved_value),
         rejectedCount: parseInt(inputStats.rows[0].rejected_count),
         rejectedValue: parseFloat(inputStats.rows[0].rejected_value)
      },
      wallets: {
         totalBalance: parseFloat(walletStats.rows[0].total_balance),
         totalLocked: parseFloat(walletStats.rows[0].total_locked)
      }
   };
}

// Get recent transactions across the ecosystem for institutions
async function getInstitutionTransactions(limit = 10) {
   const { rows } = await pool.query(
      `SELECT 
         wt.id, wt.amount, wt.type, wt.description, wt.status, wt.created_at,
         w.owner_type, v.fname, v.lname, v.email, COALESCE(v.company_name, '') as company_name
       FROM wallet_transactions wt
       JOIN wallets w ON wt.wallet_id = w.id
       LEFT JOIN vendors v ON w.owner_id = v.id
       WHERE wt.type = 'credit' OR wt.description ILIKE '%disbursement%'
       ORDER BY wt.created_at DESC
       LIMIT $1`,

      [limit]
   );
   return rows;
}

export {
   getAllUsers,
   getUserCountByRole,
   getTotalUserCount,
   getAllBuyers,
   getAllAggregatorBuyers,
   getAggregatorsWithBuyerStats,
   toggleUserSuspension,
   getAllAgreements,
   getAllEscrowPayments,
   getAllFinanceWallets,
   getAllWalletTransactions,
   getDashboardStats,
   getMonthlyUserGrowth,
   getAgreementsByStatus,
   getAllProgramsWithStats,
   disburseFundsFromFinance,
   getAllEntityWallets,
   getAllAuditLogs,
   createAuditLog,
   getSystemSettings,
   updateSystemSettings,
   getInstitutionAnalytics,
   getInstitutionTransactions,
};

