import pool from "../../lib/connect.js";

// Get all vendors (users) for super admin
async function getAllUsers() {
   const { rows } = await pool.query(
      `SELECT id, fname, lname, email, phone, role, is_active, is_verified, is_suspended, created_at 
       FROM vendors 
       ORDER BY created_at DESC`,
   );
   return rows;
}

// Get user count by role
async function getUserCountByRole() {
   const { rows } = await pool.query(
      `SELECT role, COUNT(*) as count 
       FROM vendors 
       GROUP BY role 
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
   const [vendorCount, buyerCount, agreementCount, escrowTotal, totalBalance, financeTotal] = await Promise.all([
      pool.query("SELECT COUNT(*) as count FROM vendors"),
      pool.query("SELECT COUNT(*) as count FROM buyers"),
      pool.query("SELECT COUNT(*) as count FROM buyer_agreements"),
      pool.query("SELECT COALESCE(SUM(amount), 0) as total FROM escrow_wallets WHERE status = 'held'"),
      pool.query("SELECT COALESCE(SUM(balance), 0) as total FROM wallets"),
      pool.query("SELECT COALESCE(SUM(balance), 0) as total FROM finance_wallets")
   ]);

   return {
      total_vendors: parseInt(vendorCount.rows[0]?.count || 0),
      total_buyers: parseInt(buyerCount.rows[0]?.count || 0),
      total_agreements: parseInt(agreementCount.rows[0]?.count || 0),
      escrow_held: parseFloat(escrowTotal.rows[0]?.total || 0),
      total_balance: parseFloat(totalBalance.rows[0]?.total || 0),
      finance_wallet_balance: parseFloat(financeTotal.rows[0]?.total || 0),
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
       WHERE v.role = 'Aggregator'
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
      let fwRes = await client.query(
         "SELECT * FROM finance_wallets WHERE finance_user_id = $1",
         [financeUserId]
      );

      if (fwRes.rows.length === 0) {
         // Auto-create with initial 5 Billion testing capital
         await client.query(
            "INSERT INTO finance_wallets (finance_user_id, balance, currency, status) VALUES ($1, $2, 'NGN', 'active')",
            [financeUserId, 5000000000]
         );
         fwRes = await client.query(
            "SELECT * FROM finance_wallets WHERE finance_user_id = $1",
            [financeUserId]
         );
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
   try {
      await pool.query(
         `INSERT INTO wallets (owner_id, owner_type, balance, locked_balance, currency)
          SELECT id, LOWER(role), 0.00, 0.00, 'NGN'
          FROM vendors
          WHERE id NOT IN (SELECT DISTINCT owner_id FROM wallets) AND role IS NOT NULL`
      );
   } catch (err) {
      console.error("Error auto-initializing wallets:", err);
   }
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

// Ensure research tables exist
async function ensureResearchTables() {
   try {
      await pool.query(`
         CREATE TABLE IF NOT EXISTS trial_plots (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
            plot_name TEXT NOT NULL,
            location TEXT NOT NULL,
            crop TEXT NOT NULL,
            size_hectares NUMERIC(10,2),
            status TEXT DEFAULT 'active',
            start_date DATE,
            end_date DATE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
         );
         CREATE TABLE IF NOT EXISTS research_advisories (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
            title TEXT NOT NULL,
            category TEXT,
            severity TEXT DEFAULT 'warning',
            message TEXT,
            status TEXT DEFAULT 'active',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
         );
      `);
   } catch (err) {
      console.error("Error ensuring research tables:", err);
   }
}

// Get institution-specific analytics for dashboard
async function getInstitutionAnalytics(institutionId, role) {
   await ensureResearchTables();
   const isGovernment = role === 'government';
   
   // If government, see all. Otherwise, see only programs created by this institution
   const programsFilter = isGovernment ? "" : `WHERE created_by = '${institutionId}'`;
   
   // If government, see all farmers. Otherwise, see only enrolled farmers
   const farmersCountQuery = isGovernment 
      ? `(SELECT COUNT(*) FROM vendors WHERE LOWER(role) = 'farmer' AND LOWER(workspace) = 'ecosystem')`
      : `(SELECT COUNT(DISTINCT farmer_id) FROM farmer_programmes WHERE program_id IN (SELECT id FROM programs WHERE created_by = '${institutionId}'))`;

   const [ecosystemStats, inputStats, walletStats, healthStats, deadlinesStats, extraStats, inputMetricsStats] = await Promise.all([
      pool.query(`
         SELECT 
            (SELECT COUNT(*) FROM programs ${programsFilter}) as active_programs,
            ${farmersCountQuery} as total_farmers,
            (SELECT COALESCE(SUM(target_hectares), 0) FROM programs ${programsFilter}) as total_hectares
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
      `),
      pool.query(`
         SELECT id, label, status, color FROM system_health ORDER BY id ASC
      `),
      pool.query(`
         SELECT id, title, deadline_date FROM upcoming_deadlines ORDER BY deadline_date ASC
      `),
      pool.query(`
         SELECT 
            (SELECT COUNT(*) FROM vendors WHERE LOWER(role) LIKE '%coop%') as total_cooperatives,
            (SELECT COALESCE(SUM(quantity_mt), 0) FROM harvest_batches) as total_harvests,
            (SELECT COALESCE(ROUND((COUNT(*) FILTER (WHERE status IN ('approved', 'distributed', 'completed')) * 100.0) / NULLIF(COUNT(*), 0)), 0) FROM input_requests) as program_kpi,
            (SELECT COUNT(*) FROM research_publications) as total_publications,
            (SELECT COUNT(*) FROM system_health WHERE status != 'operational') as active_alerts,
            (SELECT COALESCE(ROUND((COUNT(*) FILTER (WHERE is_verified = true) * 100.0) / NULLIF(COUNT(*), 0)), 0) FROM vendors WHERE LOWER(role) = 'farmer') as training_adoption,
            (SELECT COUNT(*) FROM trial_plots) as total_trial_plots,
            (SELECT COUNT(*) FROM research_advisories WHERE status = 'active') as research_alerts
      `),
      // Input Metrics: allocated, delivered, supplier fulfilment, programme utilisation
      pool.query(`
         WITH eco_vendors AS (
            SELECT id FROM vendors WHERE LOWER(workspace) = 'ecosystem'
         )
         SELECT
            -- Inputs Allocated: count of requests that have been approved/assigned or beyond
            COUNT(*) FILTER (WHERE funds_status = 'approved' OR items_status IN ('assigned', 'approved', 'dispatched', 'delivered', 'confirmed_delivered')) as inputs_allocated,
            COALESCE(SUM(total_value) FILTER (WHERE funds_status = 'approved' OR items_status IN ('assigned', 'approved', 'dispatched', 'delivered', 'confirmed_delivered')), 0) as allocated_value,
            -- Inputs Delivered: count of requests where items have been delivered
            COUNT(*) FILTER (WHERE items_status IN ('delivered', 'confirmed_delivered')) as inputs_delivered,
            COALESCE(SUM(total_value) FILTER (WHERE items_status IN ('delivered', 'confirmed_delivered')), 0) as delivered_value,
            -- Supplier Fulfilment: % of assigned requests that have been delivered
            COALESCE(
               ROUND(
                  (COUNT(*) FILTER (WHERE distributor_id IS NOT NULL AND items_status IN ('delivered', 'confirmed_delivered')) * 100.0) /
                  NULLIF(COUNT(*) FILTER (WHERE distributor_id IS NOT NULL), 0),
                  1
               ),
               0
            ) as supplier_fulfilment,
            -- Total requests for reference
            COUNT(*) as total_requests
         FROM input_requests ir
         JOIN farmer_profiles fp ON ir.farmer_id = fp.id
         WHERE fp.vendor_id IN (SELECT id FROM eco_vendors)
      `)
   ]);

   // Programme Utilisation: % of programme wallet funds that have been deployed
   let programmeUtilisation = 0;
   try {
      const utilRes = await pool.query(`
         SELECT
            COALESCE(SUM(pw.balance), 0) as remaining_balance,
            COALESCE(SUM(ew.total_escrowed), 0) as total_escrowed
         FROM program_wallets pw
         LEFT JOIN (
            SELECT program_id, SUM(amount) as total_escrowed 
            FROM escrow_wallets 
            GROUP BY program_id
         ) ew ON pw.program_id = ew.program_id
      `);
      const remaining = parseFloat(utilRes.rows[0]?.remaining_balance || 0);
      const escrowed = parseFloat(utilRes.rows[0]?.total_escrowed || 0);
      const totalFunded = remaining + escrowed;
      programmeUtilisation = totalFunded > 0 ? Math.round((escrowed / totalFunded) * 100) : 0;
   } catch (e) {
      // Fallback: use input_requests approved value vs total programme wallet balance
      try {
         const fallbackRes = await pool.query(`
            SELECT
               COALESCE(SUM(balance), 0) as total_balance
            FROM program_wallets
         `);
         const totalBalance = parseFloat(fallbackRes.rows[0]?.total_balance || 0);
         const approvedValue = parseFloat(inputStats.rows[0]?.approved_value || 0);
         const totalFunded = totalBalance + approvedValue;
         programmeUtilisation = totalFunded > 0 ? Math.round((approvedValue / totalFunded) * 100) : 0;
      } catch (e2) {
         programmeUtilisation = 0;
      }
   }

   let scm = {
      harvestVolume: 0, harvestBatches: 0, 
      logisticsActive: 0, logisticsDelivered: 0,
      inventoryVolume: 0, inventoryValue: 0,
      salesValue: 0, 
      buyerAgreements: 0, buyerFinancing: 0
   };
   try {
      const scRes = await pool.query(`
         WITH eco_vendors AS (
            SELECT id FROM vendors WHERE LOWER(workspace) = 'ecosystem'
         )
         SELECT 
            (SELECT COALESCE(SUM(quantity_mt), 0) FROM harvest_batches WHERE vendor_id IN (SELECT id FROM eco_vendors)) as harvest_volume,
            (SELECT COUNT(*) FROM harvest_batches WHERE vendor_id IN (SELECT id FROM eco_vendors)) as harvest_batches,
            (SELECT COUNT(*) FROM transit_logs WHERE status = 'in_transit' AND transporter_id IN (SELECT id FROM eco_vendors)) as logistics_active,
            (SELECT COUNT(*) FROM transit_logs WHERE status = 'delivered' AND transporter_id IN (SELECT id FROM eco_vendors)) as logistics_delivered,
            (SELECT COALESCE(SUM(current_quantity_mt), 0) FROM inventory_positions WHERE status = 'Available' AND warehouse_id IN (SELECT id FROM eco_vendors)) as inventory_volume,
            (SELECT COALESCE(SUM(market_value), 0) FROM inventory_positions WHERE status = 'Available' AND warehouse_id IN (SELECT id FROM eco_vendors)) as inventory_value,
            (SELECT COALESCE(SUM(s.buyer_payment), 0) FROM settlements s JOIN harvest_batches hb ON s.batch_id = hb.batch_id WHERE hb.vendor_id IN (SELECT id FROM eco_vendors)) as sales_value,
            (SELECT COUNT(*) FROM buyer_agreements WHERE status IN ('signed', 'approved', 'paid', 'completed') AND aggregator_id IN (SELECT id FROM eco_vendors)) as buyer_agreements,
            (SELECT COALESCE(SUM(financing_amount), 0) FROM buyer_agreements WHERE status IN ('signed', 'approved', 'paid', 'completed') AND aggregator_id IN (SELECT id FROM eco_vendors)) as buyer_financing
      `);
      
      const scRows = scRes.rows[0] || {};
      scm = {
         harvestVolume: parseFloat(scRows.harvest_volume || 0),
         harvestBatches: parseInt(scRows.harvest_batches || 0),
         logisticsActive: parseInt(scRows.logistics_active || 0),
         logisticsDelivered: parseInt(scRows.logistics_delivered || 0),
         inventoryVolume: parseFloat(scRows.inventory_volume || 0),
         inventoryValue: parseFloat(scRows.inventory_value || 0),
         salesValue: parseFloat(scRows.sales_value || 0),
         buyerAgreements: parseInt(scRows.buyer_agreements || 0),
         buyerFinancing: parseFloat(scRows.buyer_financing || 0)
      };
   } catch (e) {
      console.warn("Supply chain metrics query failed, some tables might not exist:", e.message);
   }

   const im = inputMetricsStats.rows[0];

   return {
      overview: {
         activePrograms: parseInt(ecosystemStats.rows[0].active_programs),
         totalFarmers: parseInt(ecosystemStats.rows[0].total_farmers),
         totalHectares: parseFloat(ecosystemStats.rows[0].total_hectares),
         totalDeployed: parseFloat(inputStats.rows[0].approved_value),
         totalCooperatives: parseInt(extraStats.rows[0].total_cooperatives || 0),
         totalHarvests: parseFloat(extraStats.rows[0].total_harvests || 0),
         programKpi: parseInt(extraStats.rows[0].program_kpi || 0),
         totalPublications: parseInt(extraStats.rows[0].total_publications || 0),
         activeAlerts: parseInt(extraStats.rows[0].active_alerts || 0),
         researchAlerts: parseInt(extraStats.rows[0].research_alerts || 0),
         totalTrialPlots: parseInt(extraStats.rows[0].total_trial_plots || 0),
         trainingAdoption: parseInt(extraStats.rows[0].training_adoption || 0),
         irrigationCoverage: parseInt(extraStats.rows[0].training_adoption || 0),
         womenPercentage: parseInt(extraStats.rows[0].program_kpi || 0)
      },
      inputMetrics: {
         inputsAllocated: parseInt(im.inputs_allocated || 0),
         allocatedValue: parseFloat(im.allocated_value || 0),
         inputsDelivered: parseInt(im.inputs_delivered || 0),
         deliveredValue: parseFloat(im.delivered_value || 0),
         supplierFulfilment: parseFloat(im.supplier_fulfilment || 0),
         programmeUtilisation: programmeUtilisation,
         totalRequests: parseInt(im.total_requests || 0)
      },
      supplyChainMetrics: scm,
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
      },
      systemHealth: healthStats.rows.map(row => ({
         id: row.id,
         label: row.label,
         status: row.status,
         color: row.color
      })),
      upcomingDeadlines: deadlinesStats.rows.map(row => ({
         id: row.id,
         title: row.title,
         date: row.deadline_date
      }))
   };
}

// Get institution portfolio metrics — purely from DB, 0 if no data
async function getInstitutionPortfolio() {
   const [loansData, repaymentData, enrolledFarmers] = await Promise.all([
      pool.query(`
         SELECT COALESCE(SUM(total_value), 0) as active_loans
         FROM input_requests
         WHERE status IN ('approved', 'distributed')
      `),
      pool.query(`
         SELECT 
            COALESCE(SUM(financing_amount), 0) as total_financing,
            COALESCE(SUM(recovered_amount), 0) as total_recovered
         FROM repayments
      `),
      pool.query(`
         SELECT COUNT(*) as total_farmers FROM vendors WHERE LOWER(role) = 'farmer' AND LOWER(workspace) = 'ecosystem'
      `)
   ]);

   const activeLoans = parseFloat(loansData.rows[0].active_loans) || 0;
   const totalFinancing = parseFloat(repaymentData.rows[0].total_financing) || 0;
   const totalRecovered = parseFloat(repaymentData.rows[0].total_recovered) || 0;

   // Pure calculation: if no financing records exist, rate is 0, not 100
   const repaymentRate = totalFinancing > 0 
      ? ((totalRecovered / totalFinancing) * 100).toFixed(1) 
      : 0;

   // At risk = outstanding balance only, no estimates
   const atRisk = totalFinancing > 0 
      ? Math.max(0, totalFinancing - totalRecovered) 
      : 0;

   return {
      activeLoans,
      repaymentRate,
      atRisk,
      enrolledFarmers: parseInt(enrolledFarmers.rows[0].total_farmers) || 0
   };
}

// Get institution impact metrics — purely from DB, 0 if no data
async function getInstitutionImpact() {
   // Count completed harvest approvals for yield data
   const harvestData = await pool.query(`
      SELECT 
         COUNT(id) as total_harvests,
         COALESCE(SUM(expected_yield_tons), 0) as total_yield
      FROM harvest_approvals
      WHERE status = 'approved'
   `);

   // Count completed field verifications
   const verificationData = await pool.query(`
      SELECT COUNT(id) as total_verifications
      FROM field_verifications
      WHERE status = 'verified'
   `);

   // Count farmers with completed training
   const trainingData = await pool.query(`
      SELECT COUNT(DISTINCT farmer_id) as trained_farmers
      FROM farmer_training_progress
      WHERE status = 'completed'
   `);

   // Actual wallet credits to farmers (income)
   const incomeData = await pool.query(`
      SELECT COALESCE(SUM(wt.amount), 0) as total_farmer_income
      FROM wallet_transactions wt
      JOIN wallets w ON wt.wallet_id = w.id
      WHERE w.owner_type = 'farmer' AND wt.type = 'credit'
   `);

   const totalHarvests = parseInt(harvestData.rows[0].total_harvests) || 0;
   const totalYield = parseFloat(harvestData.rows[0].total_yield) || 0;
   const totalVerifications = parseInt(verificationData.rows[0].total_verifications) || 0;
   const trainedFarmers = parseInt(trainingData.rows[0].trained_farmers) || 0;
   const totalFarmerIncome = parseFloat(incomeData.rows[0].total_farmer_income) || 0;

   return {
      totalHarvests,
      totalYield,
      totalVerifications,
      trainedFarmers,
      totalFarmerIncome
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

async function getInstitutionMonitoring(institutionId, role) {
   const filter = role === 'government' ? "" : `WHERE created_by = '${institutionId}'`;
   const { rows } = await pool.query(`SELECT * FROM programme_monitoring ${filter} ORDER BY created_at DESC`);
   return rows;
}

async function getInstitutionEscrow(institutionId, role) {
   // Fetch from the real 4-wallet escrow table!
   let query = `
      SELECT 
         ew.id,
         ew.amount,
         ew.status,
         ew.created_at,
         'disbursement' as transaction_type,
         'Held in escrow for input delivery' as description
      FROM escrow_wallets ew
   `;
   
   if (role !== 'government') {
      // Join program_wallets to filter by institution
      query += `
         JOIN program_wallets pw ON ew.program_id = pw.program_id
         WHERE pw.institution_id = '${institutionId}'
      `;
   }
   
   query += ` ORDER BY ew.created_at DESC`;

   const { rows } = await pool.query(query);
   return rows;
}

async function getInstitutionProcurement(institutionId, role) {
   const filter = role === 'government' ? "" : `WHERE institution_id = '${institutionId}'`;
   const { rows } = await pool.query(`SELECT * FROM procurement_orders ${filter} ORDER BY created_at DESC`);
   return rows;
}

async function getInstitutionTraceability(institutionId, role) {
   const filter = role === 'government' ? "" : `WHERE institution_id = '${institutionId}'`;
   const { rows } = await pool.query(`SELECT * FROM traceability_logs ${filter} ORDER BY timestamp DESC`);
   return rows;
}

async function getInstitutionReports(institutionId, role) {
   const filter = role === 'government' ? "" : `WHERE generated_by = '${institutionId}'`;
   const { rows } = await pool.query(`SELECT * FROM institutional_reports ${filter} ORDER BY created_at DESC`);
   return rows;
}

async function getInstitutionExtension(institutionId, role) {
   const filter = role === 'government' ? "" : `WHERE institution_id = '${institutionId}'`;
   const { rows } = await pool.query(`SELECT * FROM extension_services ${filter} ORDER BY created_at DESC`);
   return rows;
}

async function getInstitutionNgoDistribution(institutionId, role) {
   const filter = role === 'government' ? "" : `WHERE institution_id = '${institutionId}'`;
   const { rows } = await pool.query(`SELECT * FROM ngo_distributions ${filter} ORDER BY created_at DESC`);
   return rows;
}

async function getInstitutionTrialPlots(vendorId, role) {
   await ensureResearchTables();
   const filter = (role === 'government' || role === 'admin' || role === 'super admin') ? "" : `WHERE vendor_id = '${vendorId}'`;
   const { rows } = await pool.query(`SELECT * FROM trial_plots ${filter} ORDER BY created_at DESC`);
   return rows;
}

async function createInstitutionTrialPlot(vendorId, plotData) {
   await ensureResearchTables();
   const { plot_name, location, crop, size_hectares, status, start_date, end_date } = plotData;
   const { rows } = await pool.query(
      `INSERT INTO trial_plots (vendor_id, plot_name, location, crop, size_hectares, status, start_date, end_date) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [vendorId, plot_name, location, crop, size_hectares || 0, status || 'active', start_date || null, end_date || null]
   );
   return rows[0];
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
   getInstitutionPortfolio,
   getInstitutionImpact,
   getInstitutionTransactions,
   getInstitutionMonitoring,
   getInstitutionEscrow,
   getInstitutionProcurement,
   getInstitutionTraceability,
   getInstitutionReports,
   getInstitutionExtension,
   getInstitutionNgoDistribution,
   getInstitutionTrialPlots,
   createInstitutionTrialPlot,
};

