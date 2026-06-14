import pg from "pg";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

async function runSQL() {
  const client = await pool.connect();
  try {
    const sqlPath = path.join(__dirname, "src", "db-commodity-operations.sql");
    const sql = fs.readFileSync(sqlPath, "utf8");
    await client.query(sql);
    console.log("✅ Commodity Operations Schema executed successfully!");
  } catch (err) {
    console.error("❌ Migration failed:", err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

runSQL();
