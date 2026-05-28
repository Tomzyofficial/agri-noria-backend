import pg from "pg";
import dotenv from "dotenv";
dotenv.config();

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query(`ALTER TABLE vendors ADD COLUMN IF NOT EXISTS workspace CHARACTER VARYING`);
    console.log("✅ Added 'workspace' column");

    await client.query(`ALTER TABLE vendors ADD COLUMN IF NOT EXISTS role CHARACTER VARYING`);
    console.log("✅ Added 'role' column");

    await client.query(`ALTER TABLE vendors ALTER COLUMN account_type DROP NOT NULL`);
    console.log("✅ Made 'account_type' nullable");

    console.log("\n🎉 Migration completed successfully!");
  } catch (err) {
    console.error("❌ Migration failed:", err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
