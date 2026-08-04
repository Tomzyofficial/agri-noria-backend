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

export default programsController;
