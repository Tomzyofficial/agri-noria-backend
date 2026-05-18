import pg from "pg";
const { Pool } = pg;
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../../../", ".env") });

const pool = new Pool({
   connectionString: process.env.DATABASE_URL,
});

export const aggregatorDb = {
   // Profile
   getProfileByVendorId: async (vendorId) => {
      const result = await pool.query("SELECT * FROM aggregator_profiles WHERE vendor_id = $1", [vendorId]);
      return result.rows[0];
   },
   createProfile: async (vendorId, companyName, registrationDetails, logoUrl) => {
      const result = await pool.query(
         "INSERT INTO aggregator_profiles (vendor_id, company_name, registration_details, company_logo_url) VALUES ($1, $2, $3, $4) RETURNING *",
         [vendorId, companyName, registrationDetails, logoUrl]
      );
      // Sync onboarding_status to vendors table
      await pool.query("UPDATE vendors SET onboarding_status = 'completed' WHERE id = $1", [vendorId]);
      
      // Ensure wallet exists for aggregator
      await pool.query(
         "INSERT INTO wallets (owner_id, owner_type) VALUES ($1, 'aggregator') ON CONFLICT DO NOTHING",
         [vendorId]
      );
      
      return result.rows[0];
   },

   // Buyers
   createBuyer: async (aggregatorId, buyerData) => {
      const { buyer_name, buyer_email, buyer_phone, company_name, address } = buyerData;
      const result = await pool.query(
         "INSERT INTO aggregator_buyers (aggregator_id, buyer_name, buyer_email, buyer_phone, company_name, address) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
         [aggregatorId, buyer_name, buyer_email, buyer_phone, company_name, address]
      );
      return result.rows[0];
   },
   getBuyersByAggregator: async (aggregatorId) => {
      const result = await pool.query("SELECT * FROM aggregator_buyers WHERE aggregator_id = $1", [aggregatorId]);
      return result.rows;
   },

   // Agreements
   createAgreement: async (agreementData) => {
      const {
         aggregator_id,
         buyer_id,
         product_details,
         financing_amount,
         is_pre_harvest,
         secure_token,
         terms_and_conditions
      } = agreementData;
      const result = await pool.query(
         "INSERT INTO buyer_agreements (aggregator_id, buyer_id, product_details, financing_amount, is_pre_harvest, secure_token, terms_and_conditions) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *",
         [aggregator_id, buyer_id, product_details, financing_amount, is_pre_harvest, secure_token, terms_and_conditions]
      );
      return result.rows[0];
   },
   getAgreementByToken: async (token) => {
      const res = await pool.query(
         "SELECT ag.*, p.company_name as aggregator_company, v.fname as aggregator_fname, v.lname as aggregator_lname, v.email as aggregator_email, b.buyer_name, b.buyer_email FROM buyer_agreements ag JOIN aggregator_profiles p ON ag.aggregator_id = p.vendor_id JOIN vendors v ON v.id = p.vendor_id JOIN aggregator_buyers b ON b.id = ag.buyer_id WHERE ag.secure_token = $1 OR ag.payment_token = $1",
         [token]
      );
      return res.rows[0];
   },

   getAgreementById: async (id) => {
      const res = await pool.query(
         "SELECT * FROM buyer_agreements WHERE id = $1",
         [id]
      );
      return res.rows[0];
   },
   updateAgreementStatus: async (id, status, extraFields = {}) => {
      let query = "UPDATE buyer_agreements SET status = $1";
      const values = [status];
      let counter = 2;

      for (const [key, value] of Object.entries(extraFields)) {
         query += `, ${key} = $${counter}`;
         values.push(value);
         counter++;
      }

      query += ` WHERE id = $${counter} RETURNING *`;
      values.push(id);

      const result = await pool.query(query, values);
      return result.rows[0];
   },
   getAgreementsByAggregator: async (aggregatorId) => {
      const result = await pool.query(
         "SELECT ba.*, ab.buyer_name FROM buyer_agreements ba JOIN aggregator_buyers ab ON ba.buyer_id = ab.id WHERE ba.aggregator_id = $1",
         [aggregatorId]
      );
      return result.rows;
   },

   // Wallet & Escrow
   getAggregatorWallet: async (aggregatorId) => {
      const result = await pool.query("SELECT * FROM wallets WHERE owner_id = $1 AND owner_type = 'aggregator'", [aggregatorId]);
      return result.rows[0];
   },
   createEscrowPayment: async (agreementId, amount) => {
      const result = await pool.query(
         "INSERT INTO escrow_payments (agreement_id, amount) VALUES ($1, $2) RETURNING *",
         [agreementId, amount]
      );
      return result.rows[0];
   },

   // Finance Wallet Operations
   getFinanceWallet: async (financeUserId) => {
      const result = await pool.query("SELECT * FROM finance_wallets WHERE finance_user_id = $1", [financeUserId]);
      return result.rows[0];
   },
   createFinanceWallet: async (financeUserId) => {
      const result = await pool.query(
         "INSERT INTO finance_wallets (finance_user_id) VALUES ($1) ON CONFLICT (finance_user_id) DO UPDATE SET updated_at = NOW() RETURNING *",
         [financeUserId]
      );
      return result.rows[0];
   },
   receiveEscrowToFinance: async (financeWalletId, agreementId, amount) => {
      const client = await pool.connect();
      try {
         await client.query("BEGIN");
         
         // Update finance wallet balance and held_in_escrow
         await client.query(
            "UPDATE finance_wallets SET balance = balance + $1, held_in_escrow = held_in_escrow + $1 WHERE id = $2",
            [amount, financeWalletId]
         );
         
         // Record transaction
         await client.query(
            "INSERT INTO finance_wallet_transactions (finance_wallet_id, type, amount, description, agreement_id, status) VALUES ($1, $2, $3, $4, $5, $6)",
            [financeWalletId, 'received_escrow', amount, `Escrow received for Agreement ${agreementId.substring(0, 8)}`, agreementId, 'completed']
         );
         
         // Update escrow payment status
         await client.query(
            "UPDATE escrow_payments SET status = 'received_by_finance' WHERE agreement_id = $1",
            [agreementId]
         );
         
         await client.query("COMMIT");
      } catch (error) {
         await client.query("ROLLBACK");
         throw error;
      } finally {
         client.release();
      }
   },
   releaseEscrowFromFinance: async (financeWalletId, financeUserId, agreementId, targetWalletId, targetAmount) => {
      const client = await pool.connect();
      try {
         await client.query("BEGIN");
         
         // Verify escrow payment exists and is held
         const escrowRes = await client.query(
            "SELECT * FROM escrow_payments WHERE agreement_id = $1 AND status IN ('held', 'received_by_finance')",
            [agreementId]
         );
         
         if (escrowRes.rows.length === 0) {
            throw new Error("Escrow payment not found or already released");
         }
         
         const escrow = escrowRes.rows[0];
         
         // Release from finance wallet
         await client.query(
            "UPDATE finance_wallets SET held_in_escrow = held_in_escrow - $1, distributed = distributed + $1, balance = balance - $1 WHERE id = $2",
            [targetAmount, financeWalletId]
         );
         
         // Credit target wallet (aggregator or cluster)
         await client.query(
            "UPDATE wallets SET balance = balance + $1 WHERE id = $2",
            [targetAmount, targetWalletId]
         );
         
         // Record finance transaction
         await client.query(
            "INSERT INTO finance_wallet_transactions (finance_wallet_id, type, amount, description, agreement_id, related_wallet_id, status) VALUES ($1, $2, $3, $4, $5, $6, $7)",
            [financeWalletId, 'released_to_aggregator', targetAmount, `Released to wallet for Agreement ${agreementId.substring(0, 8)}`, agreementId, targetWalletId, 'completed']
         );
         
         // Record wallet transaction
         await client.query(
            "INSERT INTO wallet_transactions (wallet_id, type, amount, description, reference_id, reference_type, status) VALUES ($1, $2, $3, $4, $5, $6, $7)",
            [targetWalletId, 'credit', targetAmount, `Received from finance (Escrow Release)`, agreementId, 'escrow_release', 'completed']
         );
         
         // Update escrow payment
         await client.query(
            "UPDATE escrow_payments SET status = 'released', released_by_finance_id = $1, released_at = NOW() WHERE id = $2",
            [financeUserId, escrow.id]
         );
         
         // Update agreement status
         await client.query(
            "UPDATE buyer_agreements SET payment_status = 'released' WHERE id = $1",
            [agreementId]
         );
         
         await client.query("COMMIT");
         return true;
      } catch (error) {
         await client.query("ROLLBACK");
         throw error;
      } finally {
         client.release();
      }
   },
   getAllFinanceWallets: async () => {
      const result = await pool.query(
         "SELECT fw.*, v.fname, v.lname, v.email FROM finance_wallets fw JOIN vendors v ON fw.finance_user_id = v.id ORDER BY fw.updated_at DESC"
      );
      return result.rows;
   },
   
   // Marketplace Data
   getMarketplaceData: async () => {
      const result = await pool.query("SELECT * FROM marketplace_prices ORDER BY commodity ASC");
      return result.rows;
   },

   // Settings / Update Profile
   updateProfile: async (vendorId, updateData) => {
      const { company_name, registration_details, company_logo_url } = updateData;
      const result = await pool.query(
         "UPDATE aggregator_profiles SET company_name = $1, registration_details = $2, company_logo_url = $3, updated_at = NOW() WHERE vendor_id = $4 RETURNING *",
         [company_name, registration_details, company_logo_url, vendorId]
      );
      return result.rows[0];
   }
};
