import bcrypt from "bcryptjs";
import pg from "pg";
const { Pool } = pg;
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, ".env") });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function seedSuperAdmin() {
  try {
    const email = "success@gmail.com";
    const pword = "1234567";
    const fname = "Super";
    const lname = "Admin";
    const account_type = "Super Admin";
    const phone = "0000000000";

    // Alter the table to accept any string for account_type
    await pool.query(
      `ALTER TABLE vendors ALTER COLUMN account_type TYPE VARCHAR(255) USING account_type::VARCHAR;`
    );

    const hashedPassword = await bcrypt.hash(pword, 10);

    const result = await pool.query(
      `INSERT INTO vendors (fname, lname, email, phone, account_type, pword, terms_of_service, is_verified) 
       VALUES ($1, $2, $3, $4, $5, $6, true, true)
       ON CONFLICT (email) DO NOTHING
       RETURNING id;`,
      [fname, lname, email, phone, account_type, hashedPassword]
    );

    if (result.rows.length > 0) {
      console.log("Super Admin created successfully:", result.rows[0].id);
    } else {
      console.log("Super Admin already exists or could not be created.");
    }
  } catch (error) {
    console.error("Error seeding Super Admin:", error);
  } finally {
    pool.end();
  }
}

seedSuperAdmin();
