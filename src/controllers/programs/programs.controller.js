import { createProgram, getAllPrograms, getProgramById, getProgramsByCreator, updateProgram } from "../../db/programs/programs.db.js";
import { verifyVendorToken } from "../../sessions/vendor.auth.session.js";
import pool from "../../lib/connect.js";

const programsController = {};

// Create program (Institution only)
programsController.create = async (req, res) => {
   try {
      const payload = await verifyVendorToken(req);
      if (!payload) {
         return res.status(401).json({ success: false, error: "Unauthorized" });
      }

      const { name, region, commodity } = req.body;
      if (!name || !region || !commodity) {
         return res.status(400).json({ success: false, error: "Name, region, and commodity are required" });
      }

      const program = await createProgram({
         ...req.body,
         created_by: payload.id,
      });

      return res.status(201).json({ success: true, data: program });
   } catch (error) {
      console.error("Error creating program:", error);
      return res.status(500).json({ success: false, error: "Failed to create program" });
   }
};

// Get all programs
programsController.getAll = async (req, res) => {
   try {
      const payload = await verifyVendorToken(req);
      if (!payload) {
         return res.status(401).json({ success: false, error: "Unauthorized" });
      }

      const programs = await getAllPrograms();
      return res.status(200).json({ success: true, data: programs });
   } catch (error) {
      console.error("Error fetching programs:", error);
      return res.status(500).json({ success: false, error: "Failed to fetch programs" });
   }
};

// Get my programs (for institution users)
programsController.getMyPrograms = async (req, res) => {
   try {
      const payload = await verifyVendorToken(req);
      if (!payload) {
         return res.status(401).json({ success: false, error: "Unauthorized" });
      }

      const programs = await getProgramsByCreator(payload.id);
      return res.status(200).json({ success: true, data: programs });
   } catch (error) {
      console.error("Error fetching my programs:", error);
      return res.status(500).json({ success: false, error: "Failed to fetch programs" });
   }
};

// Update program (Creator only)
programsController.update = async (req, res) => {
   try {
      const payload = await verifyVendorToken(req);
      if (!payload) {
         return res.status(401).json({ success: false, error: "Unauthorized" });
      }

      const { id } = req.params;
      const existing = await getProgramById(id);

      if (!existing) {
         return res.status(404).json({ success: false, error: "Program not found" });
      }

      if (existing.created_by !== payload.id) {
         return res.status(403).json({ success: false, error: "Forbidden: Only the creator can modify this program" });
      }

      const updated = await updateProgram(id, req.body);
      return res.status(200).json({ success: true, data: updated });
   } catch (error) {
      console.error("Error updating program:", error);
      return res.status(500).json({ success: false, error: "Failed to update program" });
   }
};

// Fund Program (deducts from Institution entity wallet and credits program wallet)
programsController.fundProgram = async (req, res) => {
   const client = await pool.connect();
   try {
      const payload = await verifyVendorToken(req);
      if (!payload) return res.status(401).json({ success: false, error: "Unauthorized" });

      const { id } = req.params;
      const amount = parseFloat(req.body.amount);
      if (isNaN(amount) || amount <= 0) {
         return res.status(400).json({ success: false, error: "Please provide a valid funding amount greater than 0" });
      }

      const program = await getProgramById(id);
      if (!program) return res.status(404).json({ success: false, error: "Program not found" });

      await client.query("BEGIN");

      // Check user specific institutional/entity wallet balance (matching role or any wallet owned by user)
      const walletType = payload.role?.toLowerCase() || 'institution';
      let { rows: wRows } = await client.query(
         "SELECT * FROM wallets WHERE owner_id = $1 AND (owner_type = $2 OR owner_type = 'institution') ORDER BY balance DESC LIMIT 1 FOR UPDATE",
         [payload.id, walletType]
      );
      if (wRows.length === 0) {
         const resAny = await client.query(
            "SELECT * FROM wallets WHERE owner_id = $1 ORDER BY balance DESC LIMIT 1 FOR UPDATE",
            [payload.id]
         );
         wRows = resAny.rows;
      }
      const userWallet = wRows[0];
      if (!userWallet || parseFloat(userWallet.balance) < amount) {
         await client.query("ROLLBACK");
         return res.status(400).json({ 
            success: false, 
            error: `Insufficient wallet balance (${userWallet ? '₦' + parseFloat(userWallet.balance).toLocaleString() : '₦0.00'})! Please top up your entity wallet via the Wallet tab.` 
         });
      }

      // Deduct from institution wallet
      await client.query(
         "UPDATE wallets SET balance = balance - $1, updated_at = now() WHERE id = $2",
         [amount, userWallet.id]
      );

      await client.query(
         `INSERT INTO wallet_transactions (wallet_id, type, amount, description, reference_id, reference_type, status)
          VALUES ($1, 'debit', $2, $3, $4, 'program_funding', 'completed')`,
         [userWallet.id, amount, `Funding allocated to programme: ${program.name}`, id]
      );

      // Credit program wallet
      const { rows: pwRows } = await client.query(
         `INSERT INTO program_wallets (program_id, institution_id, balance, updated_at)
          VALUES ($1, $2, $3, now())
          ON CONFLICT (program_id, institution_id) 
          DO UPDATE SET balance = program_wallets.balance + $3, updated_at = now()
          RETURNING *`,
         [id, payload.id, amount]
      );

      await client.query("COMMIT");
      return res.status(200).json({ success: true, data: pwRows[0], message: "Programme successfully funded!" });
   } catch (error) {
      await client.query("ROLLBACK");
      console.error("Error funding program:", error);
      return res.status(500).json({ success: false, error: "Failed to process program funding" });
   } finally {
      client.release();
   }
};

// Get depletion and low balance alerts
programsController.getNotifications = async (req, res) => {
   try {
      const payload = await verifyVendorToken(req);
      if (!payload) return res.status(401).json({ success: false, error: "Unauthorized" });

      const { rows } = await pool.query(
         "SELECT * FROM program_notifications WHERE recipient_id = $1 AND is_read = false ORDER BY created_at DESC",
         [payload.id]
      );
      return res.status(200).json({ success: true, data: rows });
   } catch (error) {
      console.error("Error fetching program notifications:", error);
      return res.status(500).json({ success: false, error: "Failed to fetch notifications" });
   }
};

// Dismiss depletion alert or mark notification as read
programsController.dismissNotification = async (req, res) => {
   try {
      const payload = await verifyVendorToken(req);
      if (!payload) return res.status(401).json({ success: false, error: "Unauthorized" });

      const { id } = req.body || {};
      if (id) {
         await pool.query(
            "UPDATE program_notifications SET is_read = true WHERE id = $1 AND recipient_id = $2",
            [id, payload.id]
         );
      } else {
         await pool.query(
            "UPDATE program_notifications SET is_read = true WHERE recipient_id = $1",
            [payload.id]
         );
      }
      return res.status(200).json({ success: true, message: "Notification dismissed successfully" });
   } catch (error) {
      console.error("Error dismissing notification:", error);
      return res.status(500).json({ success: false, error: "Failed to dismiss notification" });
   }
};

// Get Input Packages for Program
programsController.getInputPackages = async (req, res) => {
   try {
      const payload = await verifyVendorToken(req);
      if (!payload) return res.status(401).json({ success: false, error: "Unauthorized" });

      const { id } = req.params;
      await pool.query(`
         CREATE TABLE IF NOT EXISTS input_packages (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            program_id UUID REFERENCES programs(id) ON DELETE CASCADE,
            name VARCHAR(255) NOT NULL,
            seeds BOOLEAN DEFAULT false,
            fertilizer BOOLEAN DEFAULT false,
            herbicides BOOLEAN DEFAULT false,
            total_value DECIMAL(15,2) NOT NULL DEFAULT 0,
            items JSONB DEFAULT '[]'::jsonb,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
         );
         ALTER TABLE input_packages ADD COLUMN IF NOT EXISTS items JSONB DEFAULT '[]'::jsonb;
      `);

      const { rows } = await pool.query(
         "SELECT * FROM input_packages WHERE program_id = $1 ORDER BY created_at DESC",
         [id]
      );
      return res.status(200).json({ success: true, data: rows });
   } catch (error) {
      console.error("Error fetching input packages:", error);
      return res.status(500).json({ success: false, error: "Failed to fetch input packages" });
   }
};

// Create Input Package for Program
programsController.createInputPackage = async (req, res) => {
   try {
      const payload = await verifyVendorToken(req);
      if (!payload) return res.status(401).json({ success: false, error: "Unauthorized" });

      const { id } = req.params;
      const { name, seeds = false, fertilizer = false, herbicides = false, total_value = 0, items = [] } = req.body;
      if (!name) {
         return res.status(400).json({ success: false, error: "Package name is required" });
      }

      await pool.query(`
         CREATE TABLE IF NOT EXISTS input_packages (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            program_id UUID REFERENCES programs(id) ON DELETE CASCADE,
            name VARCHAR(255) NOT NULL,
            seeds BOOLEAN DEFAULT false,
            fertilizer BOOLEAN DEFAULT false,
            herbicides BOOLEAN DEFAULT false,
            total_value DECIMAL(15,2) NOT NULL DEFAULT 0,
            items JSONB DEFAULT '[]'::jsonb,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
         );
         ALTER TABLE input_packages ADD COLUMN IF NOT EXISTS items JSONB DEFAULT '[]'::jsonb;
      `);

      const { rows } = await pool.query(`
         INSERT INTO input_packages (program_id, name, seeds, fertilizer, herbicides, total_value, items)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *
      `, [id, name, seeds, fertilizer, herbicides, parseFloat(total_value) || 0, JSON.stringify(items)]);

      return res.status(201).json({ success: true, data: rows[0], message: "Input package defined successfully" });
   } catch (error) {
      console.error("Error creating input package:", error);
      return res.status(500).json({ success: false, error: "Failed to create input package" });
   }
};

// Get pending and verified program enrollments for an institution's programs
programsController.getInstitutionEnrollments = async (req, res) => {
   try {
      const payload = await verifyVendorToken(req);
      if (!payload) return res.status(401).json({ success: false, error: "Unauthorized" });

      const { rows: farmers } = await pool.query(
         `SELECT fp.id as farmer_profile_id, fp.vendor_id, fp.farm_size_hectares, fp.commodity,
                 COALESCE(fp.program_enrollment_status, 'pending_verification') as enrollment_status,
                 fp.updated_at as enrolled_at,
                 v.fname, v.lname, v.email, v.phone,
                 p.id as program_id, p.name as program_name, p.commodity as program_commodity
          FROM farmer_profiles fp
          JOIN programs p ON fp.program_id = p.id
          JOIN vendors v ON fp.vendor_id = v.id
          WHERE p.created_by = $1
          ORDER BY fp.updated_at DESC`,
         [payload.id]
      );

      const { rows: clusters } = await pool.query(
         `SELECT c.id as cluster_id, c.name as cluster_name, c.region,
                 COALESCE(c.program_enrollment_status, 'pending_verification') as enrollment_status,
                 c.updated_at as enrolled_at,
                 v.fname as supervisor_fname, v.lname as supervisor_lname, v.phone as supervisor_phone,
                 p.id as program_id, p.name as program_name, p.commodity as program_commodity,
                 (SELECT COUNT(*) FROM cluster_members cm WHERE cm.cluster_id = c.id) as farmer_count
          FROM clusters c
          JOIN programs p ON c.program_id = p.id
          LEFT JOIN vendors v ON c.supervisor_id = v.id
          WHERE p.created_by = $1
          ORDER BY c.updated_at DESC`,
         [payload.id]
      );

      return res.status(200).json({
         success: true,
         data: {
            farmers,
            clusters,
         },
      });
   } catch (error) {
      console.error("Error fetching institution enrollments:", error);
      return res.status(500).json({ success: false, error: "Failed to fetch enrollments" });
   }
};

// Verify or reject a farmer or cluster's program enrollment
programsController.verifyEnrollment = async (req, res) => {
   try {
      const payload = await verifyVendorToken(req);
      if (!payload) return res.status(401).json({ success: false, error: "Unauthorized" });

      const { type, id, status } = req.body;
      if (!type || !id || !status) {
         return res.status(400).json({ success: false, error: "Type, id, and status are required" });
      }

      if (!['verified', 'rejected', 'pending_verification'].includes(status)) {
         return res.status(400).json({ success: false, error: "Invalid status value" });
      }

      if (type === 'farmer') {
         const { rows } = await pool.query(
            `UPDATE farmer_profiles fp
             SET program_enrollment_status = $1, updated_at = now()
             FROM programs p
             WHERE fp.id = $2 AND fp.program_id = p.id AND p.created_by = $3
             RETURNING fp.*`,
            [status, id, payload.id]
         );
         if (!rows[0]) {
            return res.status(404).json({ success: false, error: "Enrollment not found or unauthorized" });
         }
         return res.status(200).json({ success: true, message: `Farmer enrollment marked as ${status}`, data: rows[0] });
      } else if (type === 'cluster') {
         const { rows } = await pool.query(
            `UPDATE clusters c
             SET program_enrollment_status = $1, updated_at = now()
             FROM programs p
             WHERE c.id = $2 AND c.program_id = p.id AND p.created_by = $3
             RETURNING c.*`,
            [status, id, payload.id]
         );
         if (!rows[0]) {
            return res.status(404).json({ success: false, error: "Enrollment not found or unauthorized" });
         }
         return res.status(200).json({ success: true, message: `Cluster enrollment marked as ${status}`, data: rows[0] });
      } else {
         return res.status(400).json({ success: false, error: "Invalid type. Must be 'farmer' or 'cluster'" });
      }
   } catch (error) {
      console.error("Error verifying enrollment:", error);
      return res.status(500).json({ success: false, error: "Failed to verify enrollment" });
   }
};

export default programsController;
