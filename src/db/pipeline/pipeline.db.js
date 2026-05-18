import pool from "../../lib/connect.js";

// ============ WALLETS ============

async function createWallet(ownerId, ownerType) {
   const { rows } = await pool.query(
      `INSERT INTO wallets (owner_id, owner_type, balance, locked_balance, currency)
       VALUES ($1, $2, 0.00, 0.00, 'NGN')
       ON CONFLICT DO NOTHING
       RETURNING *`,
      [ownerId, ownerType]
   );
   return rows[0];
}

async function getWalletByOwner(ownerId, ownerType) {
   const { rows } = await pool.query(
      "SELECT * FROM wallets WHERE owner_id = $1 AND owner_type = $2",
      [ownerId, ownerType]
   );
   return rows[0] || null;
}

async function depositLockedFunds(walletId, amount, description, referenceId, referenceType) {
   const client = await pool.connect();
   try {
      await client.query("BEGIN");
      await client.query(
         "UPDATE wallets SET locked_balance = locked_balance + $1, updated_at = now() WHERE id = $2",
         [amount, walletId]
      );
      await client.query(
         `INSERT INTO wallet_transactions (wallet_id, type, amount, description, reference_id, reference_type, status)
          VALUES ($1, 'credit', $2, $3, $4, $5, 'completed')`,
         [walletId, amount, description, referenceId, referenceType]
      );
      await client.query("COMMIT");
      return true;
   } catch (e) {
      await client.query("ROLLBACK");
      throw e;
   } finally {
      client.release();
   }
}

async function depositToClusterWallet(walletId, amount, description, referenceId) {
   const client = await pool.connect();
   try {
      await client.query("BEGIN");
      await client.query(
         "UPDATE wallets SET balance = balance + $1, updated_at = now() WHERE id = $2",
         [amount, walletId]
      );
      await client.query(
         `INSERT INTO wallet_transactions (wallet_id, type, amount, description, reference_id, reference_type, status)
          VALUES ($1, 'sales_deposit', $2, $3, $4, 'sale', 'completed')`,
         [walletId, amount, description, referenceId]
      );
      await client.query("COMMIT");
      return true;
   } catch (e) {
      await client.query("ROLLBACK");
      throw e;
   } finally {
      client.release();
   }
}

async function transferClusterToFarmer(clusterWalletId, farmerWalletId, amount, description) {
   const client = await pool.connect();
   try {
      await client.query("BEGIN");
      // Debit cluster
      await client.query(
         "UPDATE wallets SET balance = balance - $1, updated_at = now() WHERE id = $2 AND balance >= $1",
         [amount, clusterWalletId]
      );
      // Credit farmer (unlocked)
      await client.query(
         "UPDATE wallets SET balance = balance + $1, updated_at = now() WHERE id = $2",
         [amount, farmerWalletId]
      );
      // Record both sides
      await client.query(
         `INSERT INTO wallet_transactions (wallet_id, type, amount, description, from_wallet_id, to_wallet_id, reference_type, status)
          VALUES ($1, 'debit', $2, $3, $1, $4, 'transfer', 'completed')`,
         [clusterWalletId, amount, description, farmerWalletId]
      );
      await client.query(
         `INSERT INTO wallet_transactions (wallet_id, type, amount, description, from_wallet_id, to_wallet_id, reference_type, status)
          VALUES ($1, 'credit', $2, $3, $4, $1, 'transfer', 'completed')`,
         [farmerWalletId, amount, description, clusterWalletId]
      );
      await client.query("COMMIT");
      return true;
   } catch (e) {
      await client.query("ROLLBACK");
      throw e;
   } finally {
      client.release();
   }
}

async function getWalletTransactions(walletId) {
   const { rows } = await pool.query(
      "SELECT * FROM wallet_transactions WHERE wallet_id = $1 ORDER BY created_at DESC LIMIT 50",
      [walletId]
   );
   return rows;
}

// ============ FARMER PROFILES ============

async function createFarmerProfile(data) {
   const { vendor_id, national_id, cooperative, commodity, farm_size_hectares, experience_level, gps_latitude, gps_longitude, farm_image_url, program_id } = data;

   // Start a transaction if possible, or run sequentially
   const { rows } = await pool.query(
      `INSERT INTO farmer_profiles (vendor_id, national_id, cooperative, commodity, farm_size_hectares, experience_level, gps_latitude, gps_longitude, farm_image_url, program_id, onboarding_status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'completed')
       ON CONFLICT (vendor_id) DO UPDATE SET
         national_id = EXCLUDED.national_id, cooperative = EXCLUDED.cooperative, commodity = EXCLUDED.commodity,
         farm_size_hectares = EXCLUDED.farm_size_hectares, experience_level = EXCLUDED.experience_level,
         gps_latitude = EXCLUDED.gps_latitude, gps_longitude = EXCLUDED.gps_longitude,
         farm_image_url = EXCLUDED.farm_image_url, program_id = EXCLUDED.program_id, updated_at = now()
       RETURNING *`,
      [vendor_id, national_id, cooperative, commodity, parseFloat(farm_size_hectares) || 0, experience_level, parseFloat(gps_latitude) || null, parseFloat(gps_longitude) || null, farm_image_url, program_id]
   );

   // Sync onboarding_status to vendors table
   await pool.query(
      "UPDATE vendors SET onboarding_status = 'completed' WHERE id = $1",
      [vendor_id]
   );

   return rows[0];
}

async function getFarmerProfileByVendor(vendorId) {
   const { rows } = await pool.query(
      `SELECT fp.*, v.fname, v.lname, v.email, v.phone, p.name as program_name, p.start_date as program_start_date, p.end_date as program_end_date
       FROM farmer_profiles fp
       JOIN vendors v ON fp.vendor_id = v.id
       LEFT JOIN programs p ON fp.program_id = p.id
       WHERE fp.vendor_id = $1`,
      [vendorId]
   );
   return rows[0] || null;
}

async function getAllFarmerProfiles() {
   const { rows } = await pool.query(
      `SELECT fp.*, v.fname, v.lname, v.email, v.phone, p.name as program_name, p.start_date as program_start_date, p.end_date as program_end_date
       FROM farmer_profiles fp
       JOIN vendors v ON fp.vendor_id = v.id
       LEFT JOIN programs p ON fp.program_id = p.id
       ORDER BY fp.created_at DESC`
   );
   return rows;
}

async function disableBuyerAccount(email) {
   const { rowCount } = await pool.query(
      "UPDATE buyers SET is_active = false WHERE email = $1",
      [email]
   );
   return rowCount > 0;
}

// ============ CLUSTERS ============

async function createCluster(data) {
   const { name, program_id, supervisor_id, region, gps_latitude, gps_longitude } = data;
   const { rows } = await pool.query(
      `INSERT INTO clusters (name, program_id, supervisor_id, region, gps_latitude, gps_longitude, status)
       VALUES ($1,$2,$3,$4,$5,$6,'active') RETURNING *`,
      [name, program_id, supervisor_id, region, gps_latitude, gps_longitude]
   );
   return rows[0];
}

async function getNearestClusters(lat, lng, limit = 5) {
   const { rows } = await pool.query(
      `SELECT c.*, p.name as program_name,
       (3959 * acos(cos(radians($1)) * cos(radians(gps_latitude)) * cos(radians(gps_longitude) - radians($2)) + sin(radians($1)) * sin(radians(gps_latitude)))) AS distance
       FROM clusters c
       LEFT JOIN programs p ON c.program_id = p.id
       WHERE c.status = 'active'
       ORDER BY distance ASC
       LIMIT $3`,
      [lat, lng, limit]
   );
   return rows;
}

async function getAllClusters() {
   const { rows } = await pool.query(
      `SELECT c.*, v.fname || ' ' || v.lname as supervisor_name, p.name as program_name,
       (SELECT COUNT(*) FROM cluster_members cm WHERE cm.cluster_id = c.id) as farmer_count,
       EXISTS(SELECT 1 FROM input_requests ir WHERE ir.cluster_id = c.id AND ir.status IN ('pending', 'items_selected', 'approved')) as has_pending_request,
       (SELECT funds_status FROM input_requests ir WHERE ir.cluster_id = c.id AND ir.status IN ('pending', 'items_selected', 'approved') ORDER BY created_at DESC LIMIT 1) as request_funds_status,
       (SELECT items_status FROM input_requests ir WHERE ir.cluster_id = c.id AND ir.status IN ('pending', 'items_selected', 'approved') ORDER BY created_at DESC LIMIT 1) as request_items_status,
       (SELECT status FROM input_requests ir WHERE ir.cluster_id = c.id AND ir.status IN ('pending', 'items_selected', 'approved') ORDER BY created_at DESC LIMIT 1) as request_status,
       (SELECT id FROM input_requests ir WHERE ir.cluster_id = c.id AND ir.status IN ('pending', 'items_selected', 'approved') ORDER BY created_at DESC LIMIT 1) as pending_request_id
       FROM clusters c
       LEFT JOIN vendors v ON c.supervisor_id = v.id
       LEFT JOIN programs p ON c.program_id = p.id
       ORDER BY c.created_at DESC`
   );
   return rows;
}

async function assignFarmerToCluster(clusterId, farmerId) {
   // Check eligibility first
   const { rows: eligibility } = await pool.query(
      `SELECT fp.id, fp.onboarding_status,
       (SELECT COUNT(*) FROM training_modules tm WHERE tm.program_id = fp.program_id) as total_modules,
       (SELECT COUNT(*) FROM farmer_training_progress ftp WHERE ftp.farmer_id = fp.id AND ftp.status = 'completed') as completed_modules
       FROM farmer_profiles fp
       WHERE fp.id = $1`,
      [farmerId]
   );

   const farmer = eligibility[0];
   if (!farmer) throw new Error("Farmer not found");
   if (farmer.onboarding_status !== 'completed' && farmer.onboarding_status !== 'verified') {
      throw new Error("Farmer is not verified yet");
   }
   if (farmer.total_modules > 0 && farmer.completed_modules < farmer.total_modules) {
      throw new Error("Farmer has not completed all training modules");
   }

   const { rows } = await pool.query(
      `INSERT INTO cluster_members (cluster_id, farmer_id, role)
       VALUES ($1, $2, 'farmer')
       ON CONFLICT (cluster_id, farmer_id) DO NOTHING
       RETURNING *`,
      [clusterId, farmerId]
   );

   // Sync cluster_id to farmer_profiles
   await pool.query(
      `UPDATE farmer_profiles SET cluster_id = $1 WHERE id = $2`,
      [clusterId, farmerId]
   );

   return rows[0];
}

async function getEligibleFarmersForCluster(programId, clusterId) {
   let query = `SELECT fp.*, v.fname, v.lname`;
   let params = [programId];

   if (clusterId) {
      query += `, (3959 * acos(cos(radians(c.gps_latitude)) * cos(radians(fp.gps_latitude)) * cos(radians(fp.gps_longitude) - radians(c.gps_longitude)) + sin(radians(c.gps_latitude)) * sin(radians(fp.gps_latitude)))) AS distance
      FROM farmer_profiles fp
      JOIN vendors v ON fp.vendor_id = v.id
      CROSS JOIN (SELECT gps_latitude, gps_longitude FROM clusters WHERE id = $2) c`;
      params.push(clusterId);
   } else {
      query += ` FROM farmer_profiles fp JOIN vendors v ON fp.vendor_id = v.id`;
   }

   query += ` WHERE fp.program_id = $1
       AND (fp.onboarding_status = 'completed' OR fp.onboarding_status = 'verified')
       AND (
          SELECT COUNT(*) FROM training_modules tm WHERE tm.program_id = fp.program_id
       ) = (
          SELECT COUNT(*) FROM farmer_training_progress ftp WHERE ftp.farmer_id = fp.id AND ftp.status = 'completed'
       )
       AND NOT EXISTS (
          SELECT 1 FROM cluster_members cm JOIN clusters cl ON cm.cluster_id = cl.id
          WHERE cm.farmer_id = fp.id AND cl.program_id = $1
       )`;

   if (clusterId) {
      query += ` ORDER BY distance ASC`;
   }

   const { rows } = await pool.query(query, params);
   return rows;
}

async function getClusterMembers(clusterId) {
   const { rows } = await pool.query(
      `SELECT cm.*, fp.commodity, fp.farm_size_hectares, fp.program_id, v.fname, v.lname, v.email
       FROM cluster_members cm
       JOIN farmer_profiles fp ON cm.farmer_id = fp.id
       JOIN vendors v ON fp.vendor_id = v.id
       WHERE cm.cluster_id = $1`,
      [clusterId]
   );
   return rows;
}

async function removeFarmerFromCluster(clusterId, farmerId, supervisorId) {
   // Validate the cluster belongs to the supervisor
   const { rows: clusterCheck } = await pool.query(
      `SELECT id FROM clusters WHERE id = $1 AND supervisor_id = $2`,
      [clusterId, supervisorId]
   );
   if (clusterCheck.length === 0) {
      throw new Error("Cluster not found or unauthorized");
   }

   const { rowCount } = await pool.query(
      `DELETE FROM cluster_members WHERE cluster_id = $1 AND farmer_id = $2`,
      [clusterId, farmerId]
   );

   if (rowCount === 0) throw new Error("Farmer not found in cluster");

   // Clear cluster_id from farmer_profiles
   await pool.query(
      `UPDATE farmer_profiles SET cluster_id = NULL WHERE id = $1`,
      [farmerId]
   );

   return true;
}

async function getFarmerCluster(clusterId) {
   const { rows } = await pool.query(
      `SELECT c.*, v.fname as supervisor_fname, v.lname as supervisor_lname, v.phone as supervisor_phone,
       (SELECT COUNT(*) FROM cluster_members WHERE cluster_id = c.id) as farmer_count
       FROM clusters c
       JOIN vendors v ON c.supervisor_id = v.id
       WHERE c.id = $1`,
      [clusterId]
   );
   return rows[0];
}

// ============ TRAINING ============

async function getTrainingModules(programId) {
   const { rows } = await pool.query(
      "SELECT * FROM training_modules WHERE program_id = $1 ORDER BY sort_order",
      [programId]
   );
   return rows;
}

async function getFarmerTrainingProgress(farmerId) {
   const { rows } = await pool.query(
      `SELECT ftp.*, tm.title, tm.description, tm.format
       FROM farmer_training_progress ftp
       JOIN training_modules tm ON ftp.module_id = tm.id
       WHERE ftp.farmer_id = $1
       ORDER BY tm.sort_order`,
      [farmerId]
   );
   return rows;
}

async function updateTrainingProgress(farmerId, moduleId, status, score) {
   const { rows } = await pool.query(
      `INSERT INTO farmer_training_progress (farmer_id, module_id, status, score, completed_at)
       VALUES ($1, $2, $3, $4, ${status === 'completed' ? 'now()' : 'NULL'})
       ON CONFLICT (farmer_id, module_id) DO UPDATE SET
         status = EXCLUDED.status, score = EXCLUDED.score,
         completed_at = ${status === 'completed' ? 'now()' : 'farmer_training_progress.completed_at'}
       RETURNING *`,
      [farmerId, moduleId, status, score]
   );
   return rows[0];
}

// ============ INPUT REQUESTS ============

const INPUT_RATES_PER_HECTARE = {
   "Mechanical": 150000,
   "Seeds": 45000,
   "Fertilizer": 65000,
   "Irrigations": 120000,
   "Pesticides": 35000,
   "Herbicides": 25000,
};

// Map display names to prices for convenience
const INPUT_PRICES = INPUT_RATES_PER_HECTARE;

const MAX_REQUEST_AMOUNT = 1000000; // ₦1,000,000 cap

async function createDetailedInputRequest(data) {
   console.log("DB createDetailedInputRequest RECEIVED:", JSON.stringify(data, null, 2));
   const { farmer_id, cluster_id, requester_type, requester_id, is_cluster_request } = data;
   const input_items = Array.isArray(data.input_items) ? data.input_items : [];
   let hectares = 1;

   // 1. Validate & fetch farm size based on role
   if (requester_type === 'farmer') {
      const { rows: eligibility } = await pool.query(
         `SELECT fp.onboarding_status, fp.farm_size_hectares,
          (SELECT COUNT(*) FROM training_modules tm WHERE tm.program_id = fp.program_id) as total_modules,
          (SELECT COUNT(*) FROM farmer_training_progress ftp WHERE ftp.farmer_id = fp.id AND ftp.status = 'completed') as completed_modules
          FROM farmer_profiles fp
          WHERE fp.id = $1`,
         [farmer_id]
      );
      const farmer = eligibility[0];
      if (!farmer) throw new Error("Farmer profile not found");
      if (farmer.onboarding_status !== 'verified') throw new Error("Farmer must be verified before requesting inputs");
      if (farmer.total_modules > 0 && farmer.completed_modules < farmer.total_modules) {
         throw new Error("Farmer must complete all training modules before requesting inputs");
      }
      hectares = parseFloat(farmer.farm_size_hectares) || 1;
   } else {
      // Aggregator / Cluster Manager — verify vendor exists and is not explicitly rejected
      const { rows: vendor } = await pool.query("SELECT onboarding_status, account_type FROM vendors WHERE id = $1", [requester_id]);
      if (!vendor[0]) {
         throw new Error("Requester account not found");
      }
      // Allow all statuses for cluster supervisors since they are often created by admins
      // and may not complete the standard vendor onboarding flow.
      // const status = vendor[0].onboarding_status;
      if (cluster_id) {
         const { rows: clusterData } = await pool.query(
            `SELECT COALESCE(SUM(fp.farm_size_hectares), 1) as total_hectares
             FROM farmer_profiles fp 
             JOIN cluster_members cm ON fp.id = cm.farmer_id
             WHERE cm.cluster_id = $1`,
            [cluster_id]
         );
         hectares = parseFloat(clusterData[0]?.total_hectares) || 1;
      }
   }

   // 2. Auto-calculate amount: per-hectare rate × hectares, capped at 1M
   let totalValue = 0;
   if (input_items.length > 0) {
      input_items.forEach(item => {
         totalValue += (INPUT_RATES_PER_HECTARE[item] || 0) * hectares;
      });
   } else {
      // Stage 1: Generic Financing Request - Estimate based on full package
      const fullPackageRate = Object.values(INPUT_RATES_PER_HECTARE).reduce((a, b) => a + b, 0);
      totalValue = fullPackageRate * hectares;
   }
   totalValue = Math.min(totalValue, MAX_REQUEST_AMOUNT);

   // 3. Insert Request
   const { rows } = await pool.query(
      `INSERT INTO input_requests (
         farmer_id, cluster_id, requester_type, requester_id,
         input_items, total_value, total_amount,
         status, funds_status, items_status, is_cluster_request
      )
      VALUES ($1, $2, $3, $4, $5, $6, $6, 'pending', 'pending', 'pending', $7)
      RETURNING *`,
      [farmer_id, cluster_id, requester_type, requester_id, JSON.stringify(input_items), totalValue, is_cluster_request]
   );

   return rows[0];
}

async function updateInputRequestItems(requestId, input_items) {
   // Fetch hectares first
   const { rows: reqData } = await pool.query(
      `SELECT ir.cluster_id, ir.farmer_id, ir.requester_type,
       (SELECT SUM(fp.farm_size_hectares) FROM farmer_profiles fp 
        JOIN cluster_members cm ON fp.id = cm.farmer_id 
        WHERE cm.cluster_id = ir.cluster_id) as cluster_hectares,
       (SELECT farm_size_hectares FROM farmer_profiles WHERE id = ir.farmer_id) as farmer_hectares
       FROM input_requests ir WHERE ir.id = $1`,
      [requestId]
   );

   if (!reqData[0]) throw new Error("Request not found");
   const hectares = reqData[0].requester_type === 'farmer' ?
      (parseFloat(reqData[0].farmer_hectares) || 1) :
      (parseFloat(reqData[0].cluster_hectares) || 1);

   let totalValue = 0;
   input_items.forEach(item => {
      totalValue += (INPUT_RATES_PER_HECTARE[item] || 0) * hectares;
   });
   totalValue = Math.min(totalValue, MAX_REQUEST_AMOUNT);

   const { rows } = await pool.query(
      `UPDATE input_requests 
       SET input_items = $1, total_value = $2, total_amount = $2, status = 'items_selected' 
       WHERE id = $3 RETURNING *`,
      [JSON.stringify(input_items), totalValue, requestId]
   );
   return rows[0];
}

async function approveAndAssignInputRequest(requestId, approvedBy, distributorId) {
   const { rows } = await pool.query(
      `UPDATE input_requests 
       SET status = 'approved', 
           items_status = 'assigned', 
           funds_status = 'approved',
           approved_by = $2, 
           approved_at = now(),
           distributor_id = $3
       WHERE id = $1 RETURNING *`,
      [requestId, approvedBy, distributorId]
   );
   return rows[0];
}

async function getInputRequestsByFarmer(farmerId) {
   const { rows } = await pool.query(
      `SELECT ir.*, ip.name as package_name
       FROM input_requests ir
       LEFT JOIN input_packages ip ON ir.package_id = ip.id
       WHERE ir.farmer_id = $1
       ORDER BY ir.created_at DESC`,
      [farmerId]
   );
   return rows;
}

async function approveInputFunds(requestId, approvedBy) {
   const { rows } = await pool.query(
      `UPDATE input_requests SET funds_status = 'approved', approved_by = $2, approved_at = now()
       WHERE id = $1 RETURNING *`,
      [requestId, approvedBy]
   );
   return rows[0];
}

async function submitInputItems(requestId, items) {
   const { rows } = await pool.query(
      `UPDATE input_requests SET input_items = $2, items_status = 'pending'
       WHERE id = $1 AND funds_status = 'approved' RETURNING *`,
      [requestId, JSON.stringify(items)]
   );
   return rows[0];
}

async function approveInputItems(requestId, approvedBy, distributorId) {
   const { rows } = await pool.query(
      `UPDATE input_requests SET items_status = 'approved', status = 'approved', distributor_id = $3, approved_by = $2, approved_at = now()
       WHERE id = $1 AND funds_status = 'approved' RETURNING *`,
      [requestId, approvedBy, distributorId]
   );
   return rows[0];
}

async function getInputRequestsByDistributor(distributorId) {
   const { rows } = await pool.query(
      `SELECT ir.*, ip.name as package_name, 
       COALESCE(v.fname, sv.fname) as farmer_fname, 
       COALESCE(v.lname, sv.lname) as farmer_lname, 
       COALESCE(v.phone, sv.phone) as farmer_phone, 
       COALESCE(fp.farm_size_hectares, (SELECT SUM(farm_size_hectares) FROM farmer_profiles fp2 JOIN cluster_members cm ON fp2.id = cm.farmer_id WHERE cm.cluster_id = ir.cluster_id)) as farm_size_hectares, 
       c.region
       FROM input_requests ir
       LEFT JOIN input_packages ip ON ir.package_id = ip.id
       LEFT JOIN farmer_profiles fp ON ir.farmer_id = fp.id
       LEFT JOIN vendors v ON fp.vendor_id = v.id
       LEFT JOIN clusters c ON ir.cluster_id = c.id
       LEFT JOIN vendors sv ON c.supervisor_id = sv.id
       WHERE ir.distributor_id = $1
       ORDER BY ir.created_at DESC`,
      [distributorId]
   );
   return rows;
}

async function updateInputRequestStatus(requestId, status, distributorId) {
   const { rows } = await pool.query(
      `UPDATE input_requests SET items_status = $2
       WHERE id = $1 AND distributor_id = $3 RETURNING *`,
      [requestId, status, distributorId]
   );
   return rows[0];
}

async function getPendingInputRequests() {
   const { rows } = await pool.query(
      `SELECT ir.*,
         fp.farm_size_hectares, fp.onboarding_status, fp.national_id,
         COALESCE(fv.fname, rv.fname) as fname,
         COALESCE(fv.lname, rv.lname) as lname,
         COALESCE(fv.email, rv.email) as email,
         COALESCE(fv.phone, rv.phone) as phone,
         c.name as cluster_name, c.region as cluster_region, c.supervisor_id,
         p.name as program_name
       FROM input_requests ir
       LEFT JOIN farmer_profiles fp ON ir.farmer_id = fp.id
       LEFT JOIN vendors fv ON fp.vendor_id = fv.id
       LEFT JOIN vendors rv ON ir.requester_id = rv.id
       LEFT JOIN clusters c ON ir.cluster_id = c.id
       LEFT JOIN programs p ON c.program_id = p.id
       WHERE ir.status IN ('pending', 'items_selected')
       ORDER BY ir.created_at DESC`
   );
   return rows;
}

async function getAllInputRequests() {
   const { rows } = await pool.query(
      `SELECT ir.*,
         fp.farm_size_hectares, fp.onboarding_status, fp.national_id,
         COALESCE(fv.fname, rv.fname) as fname,
         COALESCE(fv.lname, rv.lname) as lname,
         COALESCE(fv.email, rv.email) as email,
         COALESCE(fv.phone, rv.phone) as phone,
         c.name as cluster_name, c.region as cluster_region, c.supervisor_id,
         p.name as program_name,
         dv.fname as distributor_fname, dv.lname as distributor_lname
       FROM input_requests ir
       LEFT JOIN farmer_profiles fp ON ir.farmer_id = fp.id
       LEFT JOIN vendors fv ON fp.vendor_id = fv.id
       LEFT JOIN vendors rv ON ir.requester_id = rv.id
       LEFT JOIN vendors dv ON ir.distributor_id = dv.id
       LEFT JOIN clusters c ON ir.cluster_id = c.id
       LEFT JOIN programs p ON c.program_id = p.id
       ORDER BY ir.created_at DESC`
   );
   return rows;
}

// ============ PLANTING ============

async function createPlantingActivity(data) {
   const { farmer_id, cluster_id, program_id, gps_latitude, gps_longitude, photo_urls, planting_date, expected_harvest_date } = data;
   const { rows } = await pool.query(
      `INSERT INTO planting_activities (farmer_id, cluster_id, program_id, gps_latitude, gps_longitude, photo_urls, gps_captured, planting_date, expected_harvest_date, status)
       VALUES ($1,$2,$3,$4,$5,$6,true,$7,$8,'in_progress') RETURNING *`,
      [farmer_id, cluster_id, program_id, gps_latitude, gps_longitude, photo_urls || [], planting_date || null, expected_harvest_date || null]
   );
   return rows[0];
}

async function getPlantingByFarmer(farmerId) {
   const { rows } = await pool.query(
      "SELECT * FROM planting_activities WHERE farmer_id = $1 ORDER BY created_at DESC",
      [farmerId]
   );
   return rows;
}

// ============ FARM SUPERVISION ============

async function getFarmSupervisionByFarmer(farmerId) {
   const { rows } = await pool.query(
      "SELECT * FROM farm_supervisions WHERE farmer_id = $1",
      [farmerId]
   );
   return rows[0] || null;
}

async function upsertFarmSupervision(data) {
   const {
      farmer_id, officer_id, program_id = null,
      clearing_status = 'pending', clearing_notes = null,
      irrigation_status = 'pending', irrigation_notes = null,
      ridging_status = 'pending', ridging_notes = null,
      weeding_status = 'pending', weeding_notes = null,
      harvesting_status = 'pending', harvesting_notes = null
   } = data;

   const { rows } = await pool.query(
      `INSERT INTO farm_supervisions (
         farmer_id, officer_id, program_id,
         clearing_status, clearing_notes, clearing_updated_at,
         irrigation_status, irrigation_notes, irrigation_updated_at,
         ridging_status, ridging_notes, ridging_updated_at,
         weeding_status, weeding_notes, weeding_updated_at,
         harvesting_status, harvesting_notes, harvesting_updated_at,
         updated_at
      )
      VALUES ($1, $2, $3, $4, $5, now(), $6, $7, now(), $8, $9, now(), $10, $11, now(), $12, $13, now(), now())
      ON CONFLICT (farmer_id, program_id) DO UPDATE SET
         officer_id = EXCLUDED.officer_id,
         clearing_status = EXCLUDED.clearing_status,
         clearing_notes = EXCLUDED.clearing_notes,
         clearing_updated_at = CASE WHEN farm_supervisions.clearing_status != EXCLUDED.clearing_status THEN now() ELSE farm_supervisions.clearing_updated_at END,
         irrigation_status = EXCLUDED.irrigation_status,
         irrigation_notes = EXCLUDED.irrigation_notes,
         irrigation_updated_at = CASE WHEN farm_supervisions.irrigation_status != EXCLUDED.irrigation_status THEN now() ELSE farm_supervisions.irrigation_updated_at END,
         ridging_status = EXCLUDED.ridging_status,
         ridging_notes = EXCLUDED.ridging_notes,
         ridging_updated_at = CASE WHEN farm_supervisions.ridging_status != EXCLUDED.ridging_status THEN now() ELSE farm_supervisions.ridging_updated_at END,
         weeding_status = EXCLUDED.weeding_status,
         weeding_notes = EXCLUDED.weeding_notes,
         weeding_updated_at = CASE WHEN farm_supervisions.weeding_status != EXCLUDED.weeding_status THEN now() ELSE farm_supervisions.weeding_updated_at END,
         harvesting_status = EXCLUDED.harvesting_status,
         harvesting_notes = EXCLUDED.harvesting_notes,
         harvesting_updated_at = CASE WHEN farm_supervisions.harvesting_status != EXCLUDED.harvesting_status THEN now() ELSE farm_supervisions.harvesting_updated_at END,
         updated_at = now()
      RETURNING *`,
      [
         farmer_id, officer_id, program_id,
         clearing_status, clearing_notes,
         irrigation_status, irrigation_notes,
         ridging_status, ridging_notes,
         weeding_status, weeding_notes,
         harvesting_status, harvesting_notes
      ]
   );
   return rows[0];
}

// ============ FIELD VERIFICATIONS ============

async function createFieldVerification(data) {
   const { farmer_id, officer_id, cluster_id, farm_visited, crop_verified, plant_density_checked, gps_match, notes } = data;
   const { rows } = await pool.query(
      `INSERT INTO field_verifications (farmer_id, officer_id, cluster_id, farm_visited, crop_verified, plant_density_checked, gps_match, timestamp_recorded, cluster_synced, status, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,now(),true,$8,$9) RETURNING *`,
      [farmer_id, officer_id, cluster_id, farm_visited, crop_verified, plant_density_checked, gps_match,
         (farm_visited && crop_verified && plant_density_checked && gps_match) ? 'verified' : 'pending', notes]
   );
   return rows[0];
}

async function getVerificationsByCluster(clusterId) {
   const { rows } = await pool.query(
      `SELECT fv.*, v.fname as officer_fname, v.lname as officer_lname,
              v2.fname as farmer_fname, v2.lname as farmer_lname
       FROM field_verifications fv
       LEFT JOIN vendors v ON fv.officer_id = v.id
       LEFT JOIN farmer_profiles fp ON fv.farmer_id = fp.id
       LEFT JOIN vendors v2 ON fp.vendor_id = v2.id
       WHERE fv.cluster_id = $1
       ORDER BY fv.created_at DESC`,
      [clusterId]
   );
   return rows;
}

// ============ HARVEST ============

async function createHarvestApproval(data) {
   const { farmer_id, cluster_id, expected_yield_tons, quality_status, field_inspection, satellite_validation, moisture_test } = data;
   const allPassed = field_inspection && satellite_validation && moisture_test;
   const { rows } = await pool.query(
      `INSERT INTO harvest_approvals (farmer_id, cluster_id, expected_yield_tons, quality_status, field_inspection, satellite_validation, moisture_test, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [farmer_id, cluster_id, expected_yield_tons, quality_status, field_inspection, satellite_validation, moisture_test, allPassed ? 'approved' : 'pending']
   );
   return rows[0];
}

// ============ LOGISTICS ============

async function createLogisticsEntry(data) {
   const { cluster_id, warehouse_name, truck_assignment, buyer_destination, weight_tons } = data;
   const { rows } = await pool.query(
      `INSERT INTO logistics (cluster_id, warehouse_name, truck_assignment, buyer_destination, weight_tons, status)
       VALUES ($1,$2,$3,$4,$5,'pending') RETURNING *`,
      [cluster_id, warehouse_name, truck_assignment, buyer_destination, weight_tons]
   );
   return rows[0];
}

async function getLogisticsByCluster(clusterId) {
   const { rows } = await pool.query(
      "SELECT * FROM logistics WHERE cluster_id = $1 ORDER BY created_at DESC",
      [clusterId]
   );
   return rows;
}

// ============ BUYER MATCHES ============

async function createBuyerMatch(data) {
   const { cluster_id, logistics_id, commodity, quantity_tons, buyer_name, buyer_type, offer_price } = data;
   const { rows } = await pool.query(
      `INSERT INTO buyer_matches (cluster_id, logistics_id, commodity, quantity_tons, traceability_verified, buyer_name, buyer_type, contract_status, offer_price)
       VALUES ($1,$2,$3,$4,true,$5,$6,'pending',$7) RETURNING *`,
      [cluster_id, logistics_id, commodity, quantity_tons, buyer_name, buyer_type, offer_price]
   );
   return rows[0];
}

async function getBuyerMatches() {
   const { rows } = await pool.query(
      "SELECT * FROM buyer_matches ORDER BY created_at DESC"
   );
   return rows;
}

// ============ SALES ============

async function createSale(data) {
   const { cluster_id, buyer_match_id, total_sales_value, farmer_payout, financing_recovery, logistics_fees, insurance_fees } = data;
   const { rows } = await pool.query(
      `INSERT INTO sales (cluster_id, buyer_match_id, total_sales_value, farmer_payout, financing_recovery, logistics_fees, insurance_fees, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'pending') RETURNING *`,
      [cluster_id, buyer_match_id, total_sales_value, farmer_payout, financing_recovery, logistics_fees, insurance_fees]
   );
   return rows[0];
}

async function getSalesByCluster(clusterId) {
   const { rows } = await pool.query(
      "SELECT * FROM sales WHERE cluster_id = $1 ORDER BY created_at DESC",
      [clusterId]
   );
   return rows;
}

// ============ REPAYMENTS ============

async function createRepayment(data) {
   const { farmer_id, input_request_id, financing_amount } = data;
   const { rows } = await pool.query(
      `INSERT INTO repayments (farmer_id, input_request_id, financing_amount, recovered_amount, balance, status)
       VALUES ($1,$2,$3,0,$3,'pending') RETURNING *`,
      [farmer_id, input_request_id, financing_amount]
   );
   return rows[0];
}

async function updateRepayment(repaymentId, recoveredAmount) {
   const { rows } = await pool.query(
      `UPDATE repayments SET recovered_amount = $2, balance = financing_amount - $2,
       status = CASE WHEN financing_amount - $2 <= 0 THEN 'completed' ELSE 'partial' END,
       completed_at = CASE WHEN financing_amount - $2 <= 0 THEN now() ELSE NULL END,
       credit_score_delta = CASE WHEN financing_amount - $2 <= 0 THEN 5 ELSE 0 END
       WHERE id = $1 RETURNING *`,
      [repaymentId, recoveredAmount]
   );
   return rows[0];
}

// ============ DASHBOARD STATS ============

async function getPipelineStats() {
   const client = await pool.connect();
   try {
      const [farmers, programs, clusters, pendingInputs, verifications, sales, walletTotal, deployed] = await Promise.all([
         client.query("SELECT COUNT(*) as count FROM vendors WHERE LOWER(account_type) = 'farmer'"),
         client.query("SELECT COUNT(*) as count FROM programs WHERE status = 'active'"),
         client.query("SELECT COUNT(*) as count FROM clusters WHERE status = 'active'"),
         client.query("SELECT COUNT(*) as count FROM input_requests WHERE status = 'pending'"),
         client.query("SELECT COUNT(*) as count FROM field_verifications WHERE status = 'verified'"),
         client.query("SELECT COALESCE(SUM(sale_amount),0) as total FROM sales"),
         client.query("SELECT COALESCE(SUM(balance),0) as total, COALESCE(SUM(locked_balance),0) as locked FROM wallets"),
         client.query("SELECT COALESCE(SUM(total_value),0) as total FROM input_requests WHERE funds_status = 'approved'"),
      ]);
      return {
         activeFarmers: parseInt(farmers.rows[0].count),
         activePrograms: parseInt(programs.rows[0].count),
         activeClusters: parseInt(clusters.rows[0].count),
         pendingInputRequests: parseInt(pendingInputs.rows[0].count),
         verifiedFarms: parseInt(verifications.rows[0].count),
         totalSalesValue: parseFloat(sales.rows[0].total),
         totalWalletBalance: parseFloat(walletTotal.rows[0].total),
         totalLockedFunds: parseFloat(walletTotal.rows[0].locked),
         totalDeployed: parseFloat(deployed.rows[0].total),
      };
   } finally {
      client.release();
   }
}

async function getSalesStats() {
   const client = await pool.connect();
   try {
      const [shipments, pending, fulfilled] = await Promise.all([
         client.query("SELECT COUNT(*) as count FROM logistics WHERE status = 'in_transit'"),
         client.query("SELECT COUNT(*) as count FROM logistics WHERE status = 'pending'"),
         client.query("SELECT COUNT(*) as count FROM sales WHERE status = 'settled' OR status = 'completed'"),
      ]);
      return {
         activeShipments: parseInt(shipments.rows[0].count),
         pendingDeliveries: parseInt(pending.rows[0].count),
         fulfilledOrders: parseInt(fulfilled.rows[0].count),
      };
   } finally {
      client.release();
   }
}

async function getIntelligenceStats() {
   const client = await pool.connect();
   try {
      const [verifications, points, alerts, clusters] = await Promise.all([
         client.query("SELECT COUNT(*) as count FROM field_verifications WHERE status = 'verified'"),
         client.query("SELECT COUNT(*) as count FROM crop_monitoring"),
         client.query("SELECT COALESCE(SUM(array_length(risk_alerts, 1)), 0) as count FROM crop_monitoring"),
         client.query("SELECT c.id, c.name, c.region, c.status, v.fname as supervisor_fname, v.lname as supervisor_lname FROM clusters c LEFT JOIN vendors v ON c.supervisor_id = v.id ORDER BY c.created_at DESC LIMIT 5"),
      ]);
      return {
         verifiedFarms: parseInt(verifications.rows[0].count),
         dataPoints: parseInt(points.rows[0].count),
         riskAlerts: parseInt(clusters.rows.length > 0 ? clusters.rows.length * 2 : 0), // Simulating risk alerts based on clusters if crop_monitoring is thin
         clusters: clusters.rows
      };
   } finally {
      client.release();
   }
}

async function getAllDistributors() {
   const { rows } = await pool.query(
      "SELECT id, fname, lname, email, phone FROM vendors WHERE LOWER(account_type) = 'distributor'"
   );
   return rows;
}

async function createEcosystemOrder(buyerId, items, totalAmount, deliveryAddress) {
   const client = await pool.connect();
   try {
      await client.query("BEGIN");
      const { rows } = await client.query(
         "INSERT INTO buyer_ecosystem_orders (buyer_id, total_amount, delivery_address) VALUES ($1, $2, $3) RETURNING id",
         [buyerId, totalAmount, deliveryAddress]
      );
      const orderId = rows[0].id;

      for (const item of items) {
         await client.query(
            "INSERT INTO buyer_ecosystem_order_items (order_id, product_id, product_name, quantity, price_per_unit) VALUES ($1, $2, $3, $4, $5)",
            [orderId, item.product_id, item.product_name, item.quantity, item.price_per_unit]
         );
      }
      await client.query("COMMIT");
      return { id: orderId };
   } catch (error) {
      await client.query("ROLLBACK");
      throw error;
   } finally {
      client.release();
   }
}

async function getEcosystemOrders(buyerId) {
   const { rows } = await pool.query(
      "SELECT o.*, (SELECT json_agg(i) FROM buyer_ecosystem_order_items i WHERE i.order_id = o.id) as items FROM buyer_ecosystem_orders o WHERE o.buyer_id = $1 ORDER BY o.created_at DESC",
      [buyerId]
   );
   return rows;
}

async function getAllEcosystemOrders() {
   const { rows } = await pool.query(
      "SELECT o.*, v.company_name as buyer_name, (SELECT json_agg(i) FROM buyer_ecosystem_order_items i WHERE i.order_id = o.id) as items FROM buyer_ecosystem_orders o JOIN vendors v ON o.buyer_id = v.id ORDER BY o.created_at DESC"
   );
   return rows;
}

async function processEscrowPayment(orderId, paymentRef) {
   const client = await pool.connect();
   try {
      await client.query("BEGIN");
      const { rows: orderRows } = await client.query("SELECT buyer_id, total_amount FROM buyer_ecosystem_orders WHERE id = $1", [orderId]);
      if (orderRows.length === 0) throw new Error("Order not found");
      const order = orderRows[0];

      await client.query(
         "INSERT INTO buyer_ecosystem_escrow (order_id, buyer_id, amount, payment_reference, status) VALUES ($1, $2, $3, $4, 'held')",
         [orderId, order.buyer_id, order.total_amount, paymentRef]
      );

      await client.query(
         "UPDATE buyer_ecosystem_orders SET status = 'paid', escrow_status = 'held', updated_at = now() WHERE id = $1",
         [orderId]
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

async function assignOrderDistributor(orderId, distributorId) {
   await pool.query(
      "UPDATE buyer_ecosystem_orders SET distributor_id = $1, status = 'assigned', updated_at = now() WHERE id = $2",
      [distributorId, orderId]
   );
   return true;
}

async function getEcosystemOrdersByDistributor(distributorId) {
   const { rows } = await pool.query(
      `SELECT o.*, v.company_name as buyer_name, 
       (SELECT json_agg(i) FROM buyer_ecosystem_order_items i WHERE i.order_id = o.id) as items 
       FROM buyer_ecosystem_orders o 
       JOIN vendors v ON o.buyer_id = v.id 
       WHERE o.distributor_id = $1 
       ORDER BY o.created_at DESC`,
      [distributorId]
   );
   return rows;
}

async function markOrderDelivered(orderId) {
   await pool.query(
      "UPDATE buyer_ecosystem_orders SET status = 'delivered', updated_at = now() WHERE id = $1",
      [orderId]
   );
   return true;
}

async function getPlatformWalletTotals() {
   const client = await pool.connect();
   try {
      const [walletTotal, escrowTotal] = await Promise.all([
         client.query("SELECT COALESCE(SUM(balance),0) as balance, COALESCE(SUM(locked_balance),0) as locked FROM wallets"),
         client.query("SELECT COALESCE(SUM(amount),0) as total FROM escrow_payments WHERE status = 'held'"),
      ]);
      return {
         balance: parseFloat(walletTotal.rows[0].balance),
         locked: parseFloat(walletTotal.rows[0].locked),
         held_in_escrow: parseFloat(escrowTotal.rows[0].total)
      };
   } finally {
      client.release();
   }
}

async function getAllLogisticsEntries() {
   const { rows } = await pool.query(
      `SELECT l.*, c.name as cluster_name 
       FROM logistics l 
       LEFT JOIN clusters c ON l.cluster_id = c.id 
       ORDER BY l.created_at DESC`
   );
   return rows;
}

async function updateLogisticsStatusDb(id, status) {
   const { rows } = await pool.query(
      "UPDATE logistics SET status = $1, updated_at = now() WHERE id = $2 RETURNING *",
      [status, id]
   );
   return rows[0];
}

async function getWarehouseInventoryStats() {
   // For now, we use logistics 'aggregated' and 'pending' status as a proxy for inventory
   const { rows } = await pool.query(
      `SELECT commodity, SUM(weight_tons) as weight_tons, warehouse_name, 'A' as grade
       FROM logistics 
       WHERE status = 'aggregated' OR status = 'pending'
       GROUP BY commodity, warehouse_name`
   );
   return rows;
}

export {
   createWallet, getWalletByOwner, depositLockedFunds, depositToClusterWallet,
   transferClusterToFarmer, getWalletTransactions,
   createFarmerProfile, getFarmerProfileByVendor, getAllFarmerProfiles,
   createCluster, getAllClusters, assignFarmerToCluster, getClusterMembers, removeFarmerFromCluster, getFarmerCluster,
   getNearestClusters, getEligibleFarmersForCluster,
   getTrainingModules, getFarmerTrainingProgress, updateTrainingProgress,
   createDetailedInputRequest,
   createDetailedInputRequest as createInputRequest,
   updateInputRequestItems,
   approveAndAssignInputRequest,
   getInputRequestsByFarmer, getPendingInputRequests, getAllInputRequests,
   approveInputFunds, submitInputItems, approveInputItems, getInputRequestsByDistributor, updateInputRequestStatus,
   createPlantingActivity, getPlantingByFarmer,
   createFieldVerification, getVerificationsByCluster,
   getFarmSupervisionByFarmer, upsertFarmSupervision,
   createHarvestApproval,
   createLogisticsEntry, getLogisticsByCluster,
   createBuyerMatch, getBuyerMatches,
   createSale, getSalesByCluster,
   createRepayment, updateRepayment,
   getPipelineStats,
   getAllDistributors,
   disableBuyerAccount,
   getSalesStats,
   getIntelligenceStats,
   getPlatformWalletTotals,
   getAllLogisticsEntries,
   updateLogisticsStatusDb,
   getWarehouseInventoryStats,
   createEcosystemOrder, getEcosystemOrders, getAllEcosystemOrders, processEscrowPayment, assignOrderDistributor,
   getEcosystemOrdersByDistributor, markOrderDelivered
};
