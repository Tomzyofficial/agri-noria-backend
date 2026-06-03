import pool from "../lib/connect.js";

async function migrate() {
   try {
      await pool.query(`
         ALTER TABLE farm_supervisions ADD COLUMN IF NOT EXISTS cluster_id UUID REFERENCES clusters(id);
      `);
      console.log("Added cluster_id column to farm_supervisions");

      // Create unique index for cluster-level supervision
      await pool.query(`
         CREATE UNIQUE INDEX IF NOT EXISTS farm_supervisions_cluster_unique 
         ON farm_supervisions(cluster_id) WHERE cluster_id IS NOT NULL;
      `);
      console.log("Created unique index on cluster_id");

      console.log("Migration complete!");
   } catch (err) {
      console.error("Migration error:", err);
   } finally {
      process.exit(0);
   }
}

migrate();
