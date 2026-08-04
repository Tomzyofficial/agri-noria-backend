import pool from "../../../lib/connect.js";

// Get Dashboard Stats
export const getLogisticsDashboardStats = async (req, res) => {
  const provider_id = req.user.id;
  try {
    // 1. Active Transit
    const activeRes = await pool.query(`
      SELECT COUNT(*) as count 
      FROM logistics_tickets 
      WHERE logistics_provider_id = $1 AND status = 'in_transit'
    `, [provider_id]);
    
    // 2. Pending Dispatches
    const pendingRes = await pool.query(`
      SELECT COUNT(*) as count 
      FROM logistics_tickets 
      WHERE logistics_provider_id = $1 AND status = 'pending'
    `, [provider_id]);

    // 3. Total Volume Moved (Delivered)
    const volumeRes = await pool.query(`
      SELECT COALESCE(SUM(hb.quantity_mt), 0) as total_volume
      FROM logistics_tickets lt
      JOIN harvest_batches hb ON lt.batch_id = hb.batch_id
      WHERE lt.logistics_provider_id = $1 AND lt.status = 'delivered'
    `, [provider_id]);

    // 4. Successful Deliveries (Completion rate)
    const allRes = await pool.query(`
      SELECT COUNT(*) as count 
      FROM logistics_tickets 
      WHERE logistics_provider_id = $1 AND status != 'pending'
    `, [provider_id]);
    
    const deliveredRes = await pool.query(`
      SELECT COUNT(*) as count 
      FROM logistics_tickets 
      WHERE logistics_provider_id = $1 AND status = 'delivered'
    `, [provider_id]);

    const totalProcessed = parseInt(allRes.rows[0].count);
    const delivered = parseInt(deliveredRes.rows[0].count);
    const success_rate = totalProcessed > 0 ? Math.round((delivered / totalProcessed) * 100) : 0;

    res.status(200).json({
      success: true,
      data: {
        active_transit: parseInt(activeRes.rows[0].count),
        pending_dispatches: parseInt(pendingRes.rows[0].count),
        total_volume_moved: parseFloat(volumeRes.rows[0].total_volume),
        success_rate: success_rate
      }
    });
  } catch (error) {
    console.error("Error fetching logistics stats:", error);
    res.status(500).json({ success: false, error: "Server Error" });
  }
};

// Get Incoming Tickets
export const getIncomingLogisticsTickets = async (req, res) => {
  const provider_id = req.user.id;
  try {
    const query = `
      SELECT 
        lt.ticket_id, lt.ticket_number, lt.destination, lt.logistics_fee, lt.status, lt.created_at,
        hb.crop, hb.quantity_mt, hb.batch_number, hb.location as origin,
        COALESCE(NULLIF(TRIM(CONCAT(v.fname, ' ', v.lname)), ''), v.company_name, 'Unknown Entity') as entity_name, v.role as entity_role
      FROM logistics_tickets lt
      JOIN harvest_batches hb ON lt.batch_id = hb.batch_id
      JOIN vendors v ON hb.vendor_id = v.id
      WHERE lt.logistics_provider_id = $1
      ORDER BY lt.created_at DESC
    `;
    const result = await pool.query(query, [provider_id]);
    res.status(200).json({ success: true, data: result.rows });
  } catch (error) {
    console.error("Error fetching incoming logistics tickets:", error);
    res.status(500).json({ success: false, error: "Server Error" });
  }
};

// Accept Logistics Ticket (Deduct Fee & Dispatch)
export const acceptLogisticsTicket = async (req, res) => {
  const provider_id = req.user.id;
  const { ticket_id } = req.params;
  
  try {
    const checkRes = await pool.query(`
      SELECT lt.*, hb.vendor_id 
      FROM logistics_tickets lt
      JOIN harvest_batches hb ON lt.batch_id = hb.batch_id
      WHERE lt.ticket_id = $1 AND lt.logistics_provider_id = $2
    `, [ticket_id, provider_id]);

    if (checkRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: "Ticket not found or unauthorized" });
    }

    const ticket = checkRes.rows[0];
    const vendor_id = ticket.vendor_id;
    const fee = ticket.logistics_fee;

    // Check requester wallet (support liquid balance + locked program financing)
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
       // Top up balance to cover logistics fee
       await pool.query('UPDATE wallets SET balance = balance + $1 WHERE owner_id = $2', [fee, vendor_id]);
    }

    await pool.query('BEGIN');

    // Deduct from requester
    await pool.query('UPDATE wallets SET balance = balance - $1 WHERE owner_id = $2', [fee, vendor_id]);

    // Credit to logistics provider
    await pool.query('UPDATE wallets SET balance = balance + $1 WHERE owner_id = $2', [fee, provider_id]);

    // Update commodity_operations_wallets (log the logistics expense)
    await pool.query(`
      UPDATE commodity_operations_wallets 
      SET allocated_logistics = allocated_logistics + $1, updated_at = NOW()
      WHERE batch_id = $2
    `, [fee, ticket.batch_id]);

    // Update ticket status
    const updateRes = await pool.query(`
      UPDATE logistics_tickets 
      SET status = 'in_transit' 
      WHERE ticket_id = $1 
      RETURNING *
    `, [ticket_id]);

    // Update harvest batch status
    await pool.query(`
      UPDATE harvest_batches 
      SET status = 'in_transit' 
      WHERE batch_id = $1
    `, [ticket.batch_id]);

    await pool.query('COMMIT');

    res.status(200).json({ success: true, data: updateRes.rows[0] });
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error("Error accepting logistics ticket:", error);
    res.status(500).json({ success: false, error: "Server Error" });
  }
};

// Get Logistics Settings
export const getLogisticsSettings = async (req, res) => {
  const provider_id = req.user.id;
  try {
    await pool.query(`
      ALTER TABLE vendors 
      ADD COLUMN IF NOT EXISTS base_rate_per_km NUMERIC DEFAULT 120,
      ADD COLUMN IF NOT EXISTS active_vehicles INT DEFAULT 15
    `);

    const result = await pool.query(
      "SELECT base_rate_per_km, active_vehicles FROM vendors WHERE id = $1",
      [provider_id]
    );

    const data = result.rows[0] || { base_rate_per_km: 120, active_vehicles: 15 };
    res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("Error fetching logistics settings:", error);
    res.status(500).json({ success: false, error: "Server Error" });
  }
};

// Update Logistics Settings
export const updateLogisticsSettings = async (req, res) => {
  const provider_id = req.user.id;
  const { base_rate_per_km, active_vehicles } = req.body;
  
  try {
    await pool.query(`
      ALTER TABLE vendors 
      ADD COLUMN IF NOT EXISTS base_rate_per_km NUMERIC DEFAULT 120,
      ADD COLUMN IF NOT EXISTS active_vehicles INT DEFAULT 15
    `);

    const result = await pool.query(`
      UPDATE vendors 
      SET base_rate_per_km = $1, active_vehicles = $2 
      WHERE id = $3 
      RETURNING base_rate_per_km, active_vehicles
    `, [parseFloat(base_rate_per_km) || 120, parseInt(active_vehicles) || 15, provider_id]);

    res.status(200).json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error("Error updating logistics settings:", error);
    res.status(500).json({ success: false, error: "Server Error" });
  }
};
