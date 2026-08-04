import pool from "../../../lib/connect.js";

// Get Dashboard Stats
export const getStorageDashboardStats = async (req, res) => {
  const warehouse_id = req.user.id;
  try {
    // 1. Get Capacity
    const vendorRes = await pool.query('SELECT total_capacity_mt FROM vendors WHERE id = $1', [warehouse_id]);
    const totalCapacity = vendorRes.rows[0]?.total_capacity_mt || 0;

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
    const query = `
      SELECT 
        st.ticket_id, st.ticket_number, st.reserved_volume_mt, st.storage_duration_days, 
        st.expected_delivery_date, st.status, st.created_at,
        hb.crop, hb.quantity_mt, hb.batch_number,
        COALESCE(NULLIF(TRIM(CONCAT(v.fname, ' ', v.lname)), ''), v.company_name, 'Unknown Entity') as entity_name, v.role as entity_role
      FROM storage_tickets st
      JOIN harvest_batches hb ON st.batch_id = hb.batch_id
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

// Accept/Verify an incoming batch
export const acceptStorageTicket = async (req, res) => {
  const warehouse_id = req.user.id;
  const { ticket_id } = req.params;
  
  try {
    const checkRes = await pool.query(`
      SELECT st.*, hb.vendor_id 
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

    // Update ticket status
    const updateRes = await pool.query(`
      UPDATE storage_tickets 
      SET status = 'active' 
      WHERE ticket_id = $1 
      RETURNING *
    `, [ticket_id]);

    // Also update the harvest batch to 'stored'
    await pool.query(`
      UPDATE harvest_batches 
      SET status = 'stored' 
      WHERE batch_id = $1
    `, [ticket.batch_id]);

    await pool.query('COMMIT');

    res.status(200).json({ success: true, data: updateRes.rows[0] });
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error("Error accepting ticket:", error);
    res.status(500).json({ success: false, error: "Server Error" });
  }
};

// Update global storage settings (capacity)
export const updateStorageSettings = async (req, res) => {
  const warehouse_id = req.user.id;
  const { total_capacity_mt } = req.body;
  
  try {
    const result = await pool.query(`
      UPDATE vendors 
      SET total_capacity_mt = $1 
      WHERE id = $2 
      RETURNING total_capacity_mt
    `, [total_capacity_mt, warehouse_id]);

    res.status(200).json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error("Error updating settings:", error);
    res.status(500).json({ success: false, error: "Server Error" });
  }
};
