import pg from "pg";
const { Pool } = pg;
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, ".env") });

const pool = new Pool({
   connectionString: process.env.DATABASE_URL,
});

async function runSchema() {
   try {
      const sql = fs.readFileSync(path.join(__dirname, "src", "pipeline-schema.sql"), "utf8");
      await pool.query(sql);
      console.log("Pipeline schema created successfully!");
   } catch (error) {
      console.error("Schema error:", error.message);
   } finally {
      pool.end();
   }
}

runSchema();
