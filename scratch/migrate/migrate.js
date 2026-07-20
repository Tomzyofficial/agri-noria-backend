import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    console.log("Starting migrations...");

    // Task 1: Ecosystem Cluster Chats & Trainings
    await client.query(`
      CREATE TABLE IF NOT EXISTS cluster_chats (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        cluster_id UUID REFERENCES clusters(id) ON DELETE CASCADE,
        sender_id UUID REFERENCES vendors(id) ON DELETE SET NULL,
        message TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT now()
      );
    `);
    console.log("Created cluster_chats table.");

    await client.query(`
      CREATE TABLE IF NOT EXISTS cluster_trainings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        cluster_id UUID REFERENCES clusters(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        video_url TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT now()
      );
    `);
    console.log("Created cluster_trainings table.");

    // Task 4: Image Columns for Farm Supervisions
    await client.query(`
      ALTER TABLE farm_supervisions
      ADD COLUMN IF NOT EXISTS clearing_image TEXT,
      ADD COLUMN IF NOT EXISTS irrigation_image TEXT,
      ADD COLUMN IF NOT EXISTS ridging_image TEXT,
      ADD COLUMN IF NOT EXISTS weeding_image TEXT,
      ADD COLUMN IF NOT EXISTS harvesting_image TEXT;
    `);
    console.log("Added image columns to farm_supervisions.");

    await client.query("COMMIT");
    console.log("Migrations applied successfully!");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Migration failed:", error);
  } finally {
    client.release();
    pool.end();
  }
}

migrate();
