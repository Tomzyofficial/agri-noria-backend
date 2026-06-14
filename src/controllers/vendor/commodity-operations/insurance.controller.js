import pool from "../../../lib/connect.js";

// Get pending risk requests (batches needing insurance)
export const getRiskRequests = async (req, res) => {
  try {
    // For now, we'll fetch harvest batches that don't have an active insurance policy
    // but have requested insurance (or just all active batches for demo)
    const query = `
      SELECT 
        hb.batch_id as id,
        hb.batch_number,
        hb.crop as commodity,
        hb.quantity_mt || ' MT' as quantity,
        '₦' || (hb.quantity_mt * 100000) as value,
        hb.location,
        '30 Days' as storage_period,
        'Storage Protection (Fire, Theft, Flood)' as risk_type,
        'pending' as status
      FROM harvest_batches hb
      LEFT JOIN insurance_policies ip ON hb.batch_id = ip.batch_id
      WHERE ip.policy_id IS NULL AND hb.status != 'completed'
      ORDER BY hb.created_at DESC
    `;
    const result = await pool.query(query);
    
    // If no real batches exist yet, return an empty array
    res.status(200).json({ success: true, data: result.rows });
  } catch (error) {
    console.error("Error fetching risk requests:", error);
    res.status(500).json({ success: false, error: "Server Error" });
  }
};

// Provide a quote
export const provideQuote = async (req, res) => {
  const { batch_id, premium, terms } = req.body;
  const insurer_id = req.user.id; // From auth middleware

  try {
    // Fetch the batch to calculate its value
    const batchRes = await pool.query('SELECT quantity_mt FROM harvest_batches WHERE batch_id = $1', [batch_id]);
    const quantity = batchRes.rows[0]?.quantity_mt || 0;
    const calculatedValue = quantity * 100000; // ₦100,000 per MT

    const query = `
      INSERT INTO insurance_policies (
        batch_id, insurer_id, commodity_value, coverage_amount, premium_amount, status
      ) VALUES (
        $1, $2, $3, $4, $5, 'quoted'
      ) RETURNING *
    `;
    const result = await pool.query(query, [batch_id, insurer_id, calculatedValue, calculatedValue, premium]);

    res.status(200).json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error("Error providing quote:", error);
    res.status(500).json({ success: false, error: "Server Error" });
  }
};

export const getActivePolicies = async (req, res) => {
  const insurer_id = req.user.id;
  try {
    const query = `
      SELECT ip.*, hb.batch_number, hb.crop 
      FROM insurance_policies ip
      JOIN harvest_batches hb ON ip.batch_id = hb.batch_id
      WHERE ip.insurer_id = $1 AND ip.status = 'active'
      ORDER BY ip.created_at DESC
    `;
    const result = await pool.query(query, [insurer_id]);
    res.status(200).json({ success: true, data: result.rows });
  } catch (error) {
    console.error("Error fetching active policies:", error);
    res.status(500).json({ success: false, error: "Server Error" });
  }
};

export const simulateRequest = async (req, res) => {
  // This simulates a farmer creating a batch that needs insurance
  const vendor_id = req.user.id; // Just attach it to the current user for testing
  try {
    const batch_number = "AGN-B-" + Math.floor(1000 + Math.random() * 9000);
    const query = `
      INSERT INTO harvest_batches (
        batch_number, vendor_id, crop, quantity_mt, location, status
      ) VALUES (
        $1, $2, 'Maize', 500, 'Anambra', 'stored'
      ) RETURNING *
    `;
    const result = await pool.query(query, [batch_number, vendor_id]);
    res.status(200).json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error("Error simulating request:", error);
    res.status(500).json({ success: false, error: "Server Error" });
  }
};

// Accept quote and deduct premium from wallet
export const acceptQuote = async (req, res) => {
  const { policy_id } = req.body;
  const vendor_id = req.user.id; // Must be the farmer who owns the batch
  
  try {
    await pool.query('BEGIN');
    
    // 1. Fetch policy and verify ownership
    const policyQuery = `
      SELECT ip.*, hb.vendor_id 
      FROM insurance_policies ip
      JOIN harvest_batches hb ON ip.batch_id = hb.batch_id
      WHERE ip.policy_id = $1
    `;
    const policyRes = await pool.query(policyQuery, [policy_id]);
    
    if (policyRes.rows.length === 0) {
      await pool.query('ROLLBACK');
      return res.status(404).json({ success: false, error: "Policy not found" });
    }
    
    const policy = policyRes.rows[0];
    if (policy.vendor_id !== vendor_id) {
      await pool.query('ROLLBACK');
      return res.status(403).json({ success: false, error: "Unauthorized to accept this quote" });
    }

    // 2. Check vendor's main wallet balance
    const vendorWalletQuery = `
      SELECT balance FROM wallets WHERE owner_id = $1
    `;
    const vendorWalletRes = await pool.query(vendorWalletQuery, [vendor_id]);
    
    if (vendorWalletRes.rows.length === 0) {
      await pool.query('ROLLBACK');
      return res.status(400).json({ success: false, error: "Main wallet not found" });
    }
    
    const vendorBalance = vendorWalletRes.rows[0].balance;
    if (vendorBalance < policy.premium_amount) {
      await pool.query('ROLLBACK');
      return res.status(400).json({ success: false, error: "Insufficient balance in your wallet to accept this policy" });
    }

    // 3. Deduct from vendor's main wallet
    await pool.query(`
      UPDATE wallets SET balance = balance - $1 WHERE owner_id = $2
    `, [policy.premium_amount, vendor_id]);

    // 4. Credit to insurer's main wallet
    await pool.query(`
      UPDATE wallets SET balance = balance + $1 WHERE owner_id = $2
    `, [policy.premium_amount, policy.insurer_id]);
    
    // 5. Update commodity_operations_wallets (track allocated insurance, don't deduct balance)
    await pool.query(`
      UPDATE commodity_operations_wallets 
      SET allocated_insurance = allocated_insurance + $1,
          updated_at = NOW()
      WHERE batch_id = $2
    `, [policy.premium_amount, policy.batch_id]);
    
    // 6. Update policy status
    const updatePolicyQuery = `
      UPDATE insurance_policies 
      SET status = 'active'
      WHERE policy_id = $1
      RETURNING *
    `;
    const updatedPolicyRes = await pool.query(updatePolicyQuery, [policy_id]);
    
    await pool.query('COMMIT');
    res.status(200).json({ success: true, data: updatedPolicyRes.rows[0] });
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error("Error accepting quote:", error);
    res.status(500).json({ success: false, error: "Server Error" });
  }
};
