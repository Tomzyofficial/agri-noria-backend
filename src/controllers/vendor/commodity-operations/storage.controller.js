import pool from "../../../lib/connect.js";

// Get Dashboard Stats
export const getStorageDashboardStats = async (req, res) => {
  const warehouse_id = req.user.id;
  try {
    await pool.query('ALTER TABLE vendors ADD COLUMN IF NOT EXISTS location TEXT');
    // 1. Get Capacity & Location
    const vendorRes = await pool.query('SELECT total_capacity_mt, location FROM vendors WHERE id = $1', [warehouse_id]);
    const totalCapacity = vendorRes.rows[0]?.total_capacity_mt || 0;
    const location = vendorRes.rows[0]?.location || '';

    // 2. Active Tickets & Stored Inventory
    // We consider "active" and "stored" statuses
    const statsRes = await pool.query(`
      SELECT 
        COUNT(*) as active_tickets,
        COALESCE(SUM(reserved_volume_mt), 0) as stored_inventory
      FROM storage_tickets
      WHERE warehouse_id = $1 AND status IN ('active', 'stored')
    `, [warehouse_id]);

    const { active_tickets, stored_inventory } = statsRes.rows[0];

    // 3. Expected Arrivals
    const expectedRes = await pool.query(`
      SELECT COUNT(*) as expected_arrivals
      FROM storage_tickets
      WHERE warehouse_id = $1 AND status IN ('reserved', 'in_transit')
    `, [warehouse_id]);

    const expected_arrivals = expectedRes.rows[0].expected_arrivals;

    res.status(200).json({
      success: true,
      data: {
        total_capacity: totalCapacity,
        location: location,
        active_tickets: parseInt(active_tickets),
        stored_inventory: parseFloat(stored_inventory),
        expected_arrivals: parseInt(expected_arrivals)
      }
    });
  } catch (error) {
    console.error("Error fetching storage stats:", error);
    res.status(500).json({ success: false, error: "Server Error" });
  }
};

// Get Incoming and Active Tickets
export const getIncomingTickets = async (req, res) => {
  const warehouse_id = req.user.id;
  try {
    await pool.query(`
      ALTER TABLE storage_tickets ADD COLUMN IF NOT EXISTS nwr_number VARCHAR(100);
      ALTER TABLE harvest_batches ADD COLUMN IF NOT EXISTS nwr_number VARCHAR(100);
    `);
    const query = `
      SELECT 
        st.ticket_id, st.ticket_number, st.reserved_volume_mt, st.storage_duration_days, 
        st.expected_delivery_date, st.status, st.created_at, st.nwr_number,
        st.intake_proof_url, st.intake_latitude, st.intake_longitude, st.intake_geospatial_metadata, st.intake_verified_at,
        hb.crop, hb.quantity_mt, hb.batch_number,
        ca.grade, ca.moisture_pct, ca.foreign_matter_pct,
        COALESCE(NULLIF(TRIM(CONCAT(v.fname, ' ', v.lname)), ''), v.company_name, 'Unknown Entity') as entity_name, v.role as entity_role
      FROM storage_tickets st
      JOIN harvest_batches hb ON st.batch_id = hb.batch_id
      LEFT JOIN (
        SELECT DISTINCT ON (batch_id) batch_id, grade, moisture_pct, foreign_matter_pct 
        FROM commodity_assessments 
        ORDER BY batch_id, created_at DESC
      ) ca ON ca.batch_id = hb.batch_id
      JOIN vendors v ON hb.vendor_id = v.id
      WHERE st.warehouse_id = $1
      ORDER BY st.created_at DESC
    `;
    const result = await pool.query(query, [warehouse_id]);
    res.status(200).json({ success: true, data: result.rows });
  } catch (error) {
    console.error("Error fetching incoming tickets:", error);
    res.status(500).json({ success: false, error: "Server Error" });
  }
};

// Accept/Verify an incoming batch & Issue e-NWR
export const acceptStorageTicket = async (req, res) => {
  const warehouse_id = req.user.id;
  const { ticket_id } = req.params;
  const { 
    grade = "Grade A", 
    moisture_pct = 12.5, 
    foreign_matter_pct = 1.0, 
    notes = "Standard intake inspection & grading",
    intake_proof_url = null,
    intake_latitude = null,
    intake_longitude = null,
    intake_geospatial_metadata = null
  } = req.body || {};
  
  try {
    await pool.query(`
      ALTER TABLE storage_tickets ADD COLUMN IF NOT EXISTS nwr_number VARCHAR(100);
      ALTER TABLE harvest_batches ADD COLUMN IF NOT EXISTS nwr_number VARCHAR(100);
    `);

    const checkRes = await pool.query(`
      SELECT st.*, hb.vendor_id, hb.crop, hb.quantity_mt
      FROM storage_tickets st
      JOIN harvest_batches hb ON st.batch_id = hb.batch_id
      WHERE st.ticket_id = $1 AND st.warehouse_id = $2
    `, [ticket_id, warehouse_id]);

    if (checkRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: "Ticket not found or unauthorized" });
    }

    const ticket = checkRes.rows[0];
    const vendor_id = ticket.vendor_id;
    const fee = ticket.storage_fee;

    // Check farmer wallet (support liquid balance + locked program financing)
    let walletRes = await pool.query('SELECT * FROM wallets WHERE owner_id = $1', [vendor_id]);
    if (walletRes.rows.length === 0) {
       const newW = await pool.query("INSERT INTO wallets (owner_id, owner_type, balance, locked_balance, status) VALUES ($1, 'farmer', 100000, 0, 'active') RETURNING *", [vendor_id]);
       walletRes = newW;
    }

    const wallet = walletRes.rows[0];
    const currentBalance = parseFloat(wallet.balance || 0);
    const lockedBalance = parseFloat(wallet.locked_balance || 0);
    const totalAvailable = currentBalance + lockedBalance;

    if (currentBalance < fee && totalAvailable >= fee) {
       // Transfer fee deficit from locked_balance to balance
       const deficit = fee - currentBalance;
       await pool.query('UPDATE wallets SET locked_balance = locked_balance - $1, balance = balance + $1 WHERE owner_id = $2', [deficit, vendor_id]);
    } else if (totalAvailable < fee) {
       // Top up balance to cover storage fee
       await pool.query('UPDATE wallets SET balance = balance + $1 WHERE owner_id = $2', [fee, vendor_id]);
    }

    const year = new Date().getFullYear();
    const shortBatch = ticket.batch_id.replace(/-/g, '').slice(0, 8).toUpperCase();
    const nwrNumber = `NWR-${year}-${shortBatch}`;

    await pool.query('BEGIN');

    // Deduct from vendor
    await pool.query('UPDATE wallets SET balance = balance - $1 WHERE owner_id = $2', [fee, vendor_id]);

    // Credit to warehouse
    await pool.query('UPDATE wallets SET balance = balance + $1 WHERE owner_id = $2', [fee, warehouse_id]);

    // Update commodity_operations_wallets (log the storage fee expense)
    await pool.query(`
      UPDATE commodity_operations_wallets 
      SET allocated_storage = allocated_storage + $1, updated_at = NOW()
      WHERE batch_id = $2
    `, [fee, ticket.batch_id]);

    // Update ticket status & NWR number & intake geospatial evidence
    const updateRes = await pool.query(`
      UPDATE storage_tickets 
      SET status = 'active', 
          nwr_number = COALESCE(nwr_number, $2),
          intake_proof_url = COALESCE($3, intake_proof_url),
          intake_latitude = COALESCE($4, intake_latitude),
          intake_longitude = COALESCE($5, intake_longitude),
          intake_geospatial_metadata = COALESCE($6, intake_geospatial_metadata),
          intake_verified_at = NOW()
      WHERE ticket_id = $1 
      RETURNING *
    `, [
      ticket_id, 
      nwrNumber, 
      intake_proof_url, 
      intake_latitude ? parseFloat(intake_latitude) : null, 
      intake_longitude ? parseFloat(intake_longitude) : null, 
      intake_geospatial_metadata ? JSON.stringify(intake_geospatial_metadata) : null
    ]);

    // Also update the harvest batch to 'stored' and assign NWR number
    await pool.query(`
      UPDATE harvest_batches 
      SET status = 'stored', nwr_number = COALESCE(nwr_number, $2), updated_at = NOW()
      WHERE batch_id = $1
    `, [ticket.batch_id, nwrNumber]);

    // Insert quality inspection record in commodity_assessments
    await pool.query(`
      INSERT INTO commodity_assessments (batch_id, inspector_id, actual_quantity_mt, grade, moisture_pct, foreign_matter_pct, inspection_result, notes)
      VALUES ($1, $2, $3, $4, $5, $6, 'PASS', $7)
    `, [ticket.batch_id, warehouse_id, ticket.reserved_volume_mt, grade, parseFloat(moisture_pct), parseFloat(foreign_matter_pct), notes]);

    // Record or update warehouse inventory position as Available
    const estMarketValue = (parseFloat(ticket.reserved_volume_mt) || 1) * 350000;
    await pool.query(`
      INSERT INTO inventory_positions (batch_id, warehouse_id, current_quantity_mt, market_value, status)
      VALUES ($1, $2, $3, $4, 'Available')
      ON CONFLICT (batch_id) 
      DO UPDATE SET warehouse_id = $2, current_quantity_mt = $3, status = 'Available', updated_at = NOW()
    `, [ticket.batch_id, warehouse_id, ticket.reserved_volume_mt, estMarketValue]);

    await pool.query('COMMIT');

    res.status(200).json({ 
      success: true, 
      message: "Storage ticket verified, quality assessed, and e-NWR issued.",
      data: {
        ...updateRes.rows[0],
        nwr_number: nwrNumber,
        grade,
        moisture_pct
      }
    });
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error("Error accepting ticket:", error);
    res.status(500).json({ success: false, error: "Server Error" });
  }
};

// Explicit Issue / Re-issue e-NWR
export const issueNwrReceipt = async (req, res) => {
  const warehouse_id = req.user.id;
  const { ticket_id } = req.params;
  const { grade = "Grade A", moisture_pct = 12.5, foreign_matter_pct = 1.0, notes = "Certified electronic Negotiable Warehouse Receipt" } = req.body || {};

  try {
    const checkRes = await pool.query(`
      SELECT st.*, hb.crop, hb.quantity_mt
      FROM storage_tickets st
      JOIN harvest_batches hb ON st.batch_id = hb.batch_id
      WHERE st.ticket_id = $1 AND st.warehouse_id = $2
    `, [ticket_id, warehouse_id]);

    if (checkRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: "Storage ticket not found" });
    }

    const ticket = checkRes.rows[0];
    const year = new Date().getFullYear();
    const shortBatch = ticket.batch_id.replace(/-/g, '').slice(0, 8).toUpperCase();
    const nwrNumber = ticket.nwr_number || `NWR-${year}-${shortBatch}`;

    await pool.query('BEGIN');

    await pool.query(`
      UPDATE storage_tickets 
      SET nwr_number = $1 
      WHERE ticket_id = $2
    `, [nwrNumber, ticket_id]);

    await pool.query(`
      UPDATE harvest_batches 
      SET nwr_number = $1, status = 'stored', updated_at = NOW() 
      WHERE batch_id = $2
    `, [nwrNumber, ticket.batch_id]);

    await pool.query(`
      INSERT INTO commodity_assessments (batch_id, inspector_id, actual_quantity_mt, grade, moisture_pct, foreign_matter_pct, inspection_result, notes)
      VALUES ($1, $2, $3, $4, $5, $6, 'PASS', $7)
    `, [ticket.batch_id, warehouse_id, ticket.reserved_volume_mt, grade, parseFloat(moisture_pct), parseFloat(foreign_matter_pct), notes]);

    await pool.query('COMMIT');

    res.status(200).json({
      success: true,
      message: "e-NWR successfully issued",
      data: {
        ticket_id,
        nwr_number: nwrNumber,
        grade,
        moisture_pct
      }
    });
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error("Error issuing e-NWR:", error);
    res.status(500).json({ success: false, error: "Server Error" });
  }
};

// Update global storage settings (capacity & location)
export const updateStorageSettings = async (req, res) => {
  const warehouse_id = req.user.id;
  const { total_capacity_mt, location } = req.body;
  
  try {
    await pool.query('ALTER TABLE vendors ADD COLUMN IF NOT EXISTS location TEXT');
    const result = await pool.query(`
      UPDATE vendors 
      SET total_capacity_mt = $1,
          location = COALESCE($2, location)
      WHERE id = $3 
      RETURNING total_capacity_mt, location
    `, [parseFloat(total_capacity_mt) || 0, location !== undefined ? location : null, warehouse_id]);

    res.status(200).json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error("Error updating settings:", error);
    res.status(500).json({ success: false, error: "Server Error" });
  }
};

// ==========================================
// STORAGE AVAILABILITY CALENDAR CONTROLLERS
// ==========================================

// Get calendar schedules & reservations for the storage vendor
export const getStorageCalendar = async (req, res) => {
  const warehouse_id = req.user.id;
  try {
    // 1. Fetch availability schedule windows
    const schedulesRes = await pool.query(`
      SELECT * FROM storage_availability_schedules
      WHERE vendor_id = $1
      ORDER BY start_date ASC
    `, [warehouse_id]);

    // 2. Fetch incoming and active reservations / tickets
    const reservationsRes = await pool.query(`
      SELECT 
        st.ticket_id, st.ticket_number, st.batch_id, st.reserved_volume_mt,
        st.storage_duration_days, st.start_date, st.end_date, st.status,
        st.storage_fee, st.created_at,
        hb.crop, hb.batch_number, hb.location as batch_location,
        COALESCE(NULLIF(TRIM(CONCAT(v.fname, ' ', v.lname)), ''), v.company_name, 'Unknown Entity') as entity_name,
        v.phone as entity_phone, v.email as entity_email
      FROM storage_tickets st
      JOIN harvest_batches hb ON st.batch_id = hb.batch_id
      JOIN vendors v ON hb.vendor_id = v.id
      WHERE st.warehouse_id = $1
      ORDER BY st.created_at DESC
    `, [warehouse_id]);

    // 3. Fetch storage facilities
    const facilitiesRes = await pool.query(`
      SELECT id, listing_name, storage_type, location, capacity, available, price_per_mt_month, operating_days
      FROM storage_facility
      WHERE account_id = $1
    `, [warehouse_id]);

    res.status(200).json({
      success: true,
      data: {
        schedules: schedulesRes.rows,
        reservations: reservationsRes.rows,
        facilities: facilitiesRes.rows
      }
    });
  } catch (error) {
    console.error("Error fetching storage calendar:", error);
    res.status(500).json({ success: false, error: "Server Error" });
  }
};

// Add a new availability window
export const addStorageCalendarSchedule = async (req, res) => {
  const warehouse_id = req.user.id;
  const {
    facility_id,
    start_date,
    end_date,
    available_capacity_mt,
    price_per_mt_month = 1200,
    accepted_commodities = ["Maize", "Rice", "Soybeans", "Wheat"],
    status = "available",
    notes = ""
  } = req.body;

  if (!start_date || !end_date) {
    return res.status(400).json({ success: false, error: "Start date and End date are required." });
  }

  try {
    const result = await pool.query(`
      INSERT INTO storage_availability_schedules (
        facility_id, vendor_id, start_date, end_date, available_capacity_mt,
        price_per_mt_month, status, accepted_commodities, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [
      facility_id || null,
      warehouse_id,
      start_date,
      end_date,
      parseFloat(available_capacity_mt) || 0,
      parseFloat(price_per_mt_month) || 1200,
      status,
      Array.isArray(accepted_commodities) ? accepted_commodities : ["Maize", "Rice", "Soybeans", "Wheat"],
      notes
    ]);

    res.status(201).json({ success: true, message: "Availability window added", data: result.rows[0] });
  } catch (error) {
    console.error("Error adding calendar schedule:", error);
    res.status(500).json({ success: false, error: "Server Error" });
  }
};

// Update an availability window
export const updateStorageCalendarSchedule = async (req, res) => {
  const warehouse_id = req.user.id;
  const { id } = req.params;
  const {
    start_date,
    end_date,
    available_capacity_mt,
    price_per_mt_month,
    status,
    accepted_commodities,
    notes
  } = req.body;

  try {
    const result = await pool.query(`
      UPDATE storage_availability_schedules
      SET 
        start_date = COALESCE($1, start_date),
        end_date = COALESCE($2, end_date),
        available_capacity_mt = COALESCE($3, available_capacity_mt),
        price_per_mt_month = COALESCE($4, price_per_mt_month),
        status = COALESCE($5, status),
        accepted_commodities = COALESCE($6, accepted_commodities),
        notes = COALESCE($7, notes),
        updated_at = NOW()
      WHERE id = $8 AND vendor_id = $9
      RETURNING *
    `, [
      start_date,
      end_date,
      available_capacity_mt ? parseFloat(available_capacity_mt) : null,
      price_per_mt_month ? parseFloat(price_per_mt_month) : null,
      status,
      accepted_commodities,
      notes,
      id,
      warehouse_id
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: "Schedule not found or unauthorized" });
    }

    res.status(200).json({ success: true, message: "Availability window updated", data: result.rows[0] });
  } catch (error) {
    console.error("Error updating calendar schedule:", error);
    res.status(500).json({ success: false, error: "Server Error" });
  }
};

// Delete an availability window
export const deleteStorageCalendarSchedule = async (req, res) => {
  const warehouse_id = req.user.id;
  const { id } = req.params;

  try {
    const result = await pool.query(`
      DELETE FROM storage_availability_schedules
      WHERE id = $1 AND vendor_id = $2
      RETURNING id
    `, [id, warehouse_id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: "Schedule not found or unauthorized" });
    }

    res.status(200).json({ success: true, message: "Availability window deleted" });
  } catch (error) {
    console.error("Error deleting calendar schedule:", error);
    res.status(500).json({ success: false, error: "Server Error" });
  }
};

