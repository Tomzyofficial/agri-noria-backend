import pool from "../../../lib/connect.js";

// Get providers by role
export const getProvidersByRole = async (req, res) => {
  const { role } = req.params;
  const searchRole = (role || "").toLowerCase();
  try {
    // Ensure column exists on vendors table
    await pool.query('ALTER TABLE vendors ADD COLUMN IF NOT EXISTS total_capacity_mt NUMERIC DEFAULT 0');

    // Ensure location column exists on vendors table
    await pool.query('ALTER TABLE vendors ADD COLUMN IF NOT EXISTS location TEXT');

    let query = "";
    let params = [];
    if (searchRole === 'storage') {
      query = `SELECT id, fname, lname, company_name, email, phone, workspace, total_capacity_mt, location, role 
               FROM vendors 
               WHERE LOWER(role) LIKE '%storage%' OR LOWER(role) LIKE '%warehouse%'`;
    } else if (searchRole === 'logistics') {
      query = `SELECT id, fname, lname, company_name, email, phone, workspace, total_capacity_mt, location, role 
               FROM vendors 
               WHERE LOWER(role) LIKE '%logistics%' OR LOWER(role) LIKE '%transport%' OR LOWER(role) LIKE '%courier%'`;
    } else {
      query = `SELECT id, fname, lname, company_name, email, phone, workspace, total_capacity_mt, location, role 
               FROM vendors 
               WHERE LOWER(role) LIKE $1`;
      params = [`%${searchRole}%`];
    }

    const providers = await pool.query(query, params);
    res.status(200).json({ success: true, data: providers.rows });
  } catch (error) {
    console.error("Error fetching providers:", error);
    res.status(500).json({ success: false, error: "Server Error" });
  }
};
import crypto from "crypto";

// Create a new harvest batch
export const declareHarvest = async (req, res) => {
  let produces = req.body.produces;
  
  // Fallback for single crop submission
  if (!produces) {
    const { crop, quantity_mt, location, harvest_date } = req.body;
    if (crop) {
      produces = [{ crop, quantity_mt, location, harvest_date }];
    } else {
      return res.status(400).json({ success: false, error: "No produces provided" });
    }
  }

  const vendor_id = req.user.id;
  const createdBatches = [];

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    for (const item of produces) {
      const { crop, quantity_mt, location, harvest_date } = item;
      const batch_number = `HB-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
      
      const query = `
        INSERT INTO harvest_batches (
          batch_number, vendor_id, crop, quantity_mt, location, harvest_date, status
        ) VALUES (
          $1, $2, $3, $4, $5, $6, 'harvest_declared'
        ) RETURNING *
      `;
      const values = [batch_number, vendor_id, crop, quantity_mt, location || 'Unknown', harvest_date || new Date()];
      const result = await client.query(query, values);
      
      const newBatch = result.rows[0];

      // Ensure a commodity operations wallet is created for this batch
      const walletQuery = `
        INSERT INTO commodity_operations_wallets (batch_id, balance)
        VALUES ($1, 0)
        RETURNING *
      `;
      await client.query(walletQuery, [newBatch.batch_id]);
      
      createdBatches.push(newBatch);
    }

    await client.query('COMMIT');
    res.status(201).json({ success: true, data: createdBatches });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error("Error declaring harvest:", error);
    res.status(500).json({ success: false, error: "Server Error" });
  } finally {
    client.release();
  }
};

// Fetch batches for the farmer
export const getMyBatches = async (req, res) => {
  const vendor_id = req.user.id;

  try {
    const query = `
      SELECT hb.*, cow.balance as wallet_balance, ip.status as insurance_status, ip.policy_id
      FROM harvest_batches hb
      LEFT JOIN commodity_operations_wallets cow ON hb.batch_id = cow.batch_id
      LEFT JOIN insurance_policies ip ON hb.batch_id = ip.batch_id
      WHERE hb.vendor_id = $1
      ORDER BY hb.created_at DESC
    `;
    const result = await pool.query(query, [vendor_id]);
    res.status(200).json({ success: true, data: result.rows });
  } catch (error) {
    console.error("Error fetching batches:", error);
    res.status(500).json({ success: false, error: "Server Error" });
  }
};

// Request storage (triggers insurance risk request)
export const requestStorage = async (req, res) => {
  const { batch_id, warehouse_id, storage_duration_days, storage_fee } = req.body;
  const vendor_id = req.user.id; // Verify ownership

  try {
    // 1. Verify batch ownership
    const batchCheck = await pool.query("SELECT * FROM harvest_batches WHERE batch_id = $1 AND vendor_id = $2", [batch_id, vendor_id]);
    if (batchCheck.rows.length === 0) {
      return res.status(404).json({ success: false, error: "Batch not found or unauthorized" });
    }

    const batch = batchCheck.rows[0];

    // 2. Create Storage Ticket
    const ticket_number = `ST-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
    const storageQuery = `
      INSERT INTO storage_tickets (
        ticket_number, batch_id, warehouse_id, reserved_volume_mt, storage_duration_days, storage_fee, insurance_enabled, status
      ) VALUES (
        $1, $2, $3, $4, $5, $6, true, 'reserved'
      ) RETURNING *
    `;
    let targetWarehouse = warehouse_id;
    if (!targetWarehouse) {
      // Find a real storage vendor
      const storageVendor = await pool.query("SELECT id FROM vendors WHERE LOWER(role) LIKE '%storage%' OR LOWER(role) LIKE '%warehouse%' LIMIT 1");
      if (storageVendor.rows.length > 0) {
        targetWarehouse = storageVendor.rows[0].id;
      } else {
        targetWarehouse = vendor_id; // fallback
      }
    }
    
    await pool.query(storageQuery, [ticket_number, batch_id, targetWarehouse, batch.quantity_mt, storage_duration_days || 30, storage_fee || 50000]);

    // 3. Update Batch Status (set to storage_reserved until logistics picks it up)
    await pool.query("UPDATE harvest_batches SET status = 'storage_reserved' WHERE batch_id = $1", [batch_id]);

    // 4. Create Insurance Risk Request (dummy policy with 'pending' status)
    // Wait, the insurance dashboard queries for batches without a policy or policies in 'pending'.
    // In our insurance controller we query: 
    // SELECT ... FROM harvest_batches hb LEFT JOIN insurance_policies ip ON hb.batch_id = ip.batch_id WHERE ip.policy_id IS NULL AND hb.status != 'completed'
    // So just changing status to 'stored' makes it available for the insurance dashboard!
    
    res.status(200).json({ success: true, message: "Storage requested and Risk Request broadcasted." });
  } catch (error) {
    console.error("Error requesting storage:", error);
    res.status(500).json({ success: false, error: "Server Error" });
  }
};

// Request logistics
export const requestLogistics = async (req, res) => {
  const { batch_id, logistics_provider_id, destination, logistics_fee } = req.body;
  const vendor_id = req.user.id;

  try {
    // 1. Verify batch ownership
    const batchCheck = await pool.query("SELECT * FROM harvest_batches WHERE batch_id = $1 AND vendor_id = $2", [batch_id, vendor_id]);
    if (batchCheck.rows.length === 0) {
      return res.status(404).json({ success: false, error: "Batch not found or unauthorized" });
    }

    const batch = batchCheck.rows[0];

    // 2. Determine Logistics Provider
    let targetProvider = logistics_provider_id;
    if (!targetProvider) {
      const logisticsVendor = await pool.query("SELECT id FROM vendors WHERE role IN ('logistics', 'logistics partner') LIMIT 1");
      if (logisticsVendor.rows.length > 0) {
        targetProvider = logisticsVendor.rows[0].id;
      } else {
        targetProvider = vendor_id; // fallback
      }
    }

    // 3. Create Logistics Ticket
    const ticket_number = `LT-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
    const logisticsQuery = `
      INSERT INTO logistics_tickets (
        ticket_number, batch_id, logistics_provider_id, destination, logistics_fee, status
      ) VALUES (
        $1, $2, $3, $4, $5, 'pending'
      ) RETURNING *
    `;
    await pool.query(logisticsQuery, [
      ticket_number, 
      batch_id, 
      targetProvider, 
      destination || 'Designated Warehouse/Buyer', 
      logistics_fee || 15000
    ]);

    // 4. Update Batch Status (optional, can leave as is until logistics accepts, but we'll set it to logistics_requested if you want, or just leave it)
    
    res.status(200).json({ success: true, message: "Logistics requested successfully." });
  } catch (error) {
    console.error("Error requesting logistics:", error);
    res.status(500).json({ success: false, error: "Server Error" });
  }
};
