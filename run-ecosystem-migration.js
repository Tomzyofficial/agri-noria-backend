import pg from "pg";
import dotenv from "dotenv";
dotenv.config();

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS cluster_chats (
         id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
         cluster_id UUID REFERENCES clusters(id) ON DELETE CASCADE,
         sender_id UUID REFERENCES vendors(id) ON DELETE SET NULL,
         sender_type VARCHAR(50) DEFAULT 'farmer', -- farmer, supervisor
         message TEXT NOT NULL,
         created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);
    console.log("✅ Added cluster_chats table");

    await client.query(`
      CREATE TABLE IF NOT EXISTS cluster_trainings (
         id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
         cluster_id UUID REFERENCES clusters(id) ON DELETE CASCADE,
         supervisor_id UUID REFERENCES vendors(id) ON DELETE SET NULL,
         title VARCHAR(255) NOT NULL,
         description TEXT,
         scheduled_time TIMESTAMP WITH TIME ZONE,
         agora_channel VARCHAR(255),
         status VARCHAR(50) DEFAULT 'scheduled', -- scheduled, live, completed, cancelled
         video_url TEXT, -- if recorded
         created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);
    console.log("✅ Added cluster_trainings table");

    await client.query(`ALTER TABLE input_requests ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50) DEFAULT 'pending';`);
    console.log("✅ Added 'payment_status' column to input_requests");

    console.log("\n🎉 Ecosystem Migration completed successfully!");
  } catch (err) {
    console.error("❌ Migration failed:", err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
