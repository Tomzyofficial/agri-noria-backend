const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres:success1050@localhost:5432/AgriConnect' });

(async () => {
   try {
      // List all tables
      const tables = await pool.query(
         "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name"
      );
      console.log("=== ALL TABLES ===");
      tables.rows.forEach(r => console.log(r.table_name));

      // For each table, get columns
      console.log("\n=== TABLE COLUMNS ===");
      for (const t of tables.rows) {
         const cols = await pool.query(
            "SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name = $1 ORDER BY ordinal_position",
            [t.table_name]
         );
         console.log(`\n--- ${t.table_name} ---`);
         cols.rows.forEach(c => {
            console.log(`  ${c.column_name} | ${c.data_type} | nullable: ${c.is_nullable} | default: ${c.column_default || 'none'}`);
         });
      }

      // List constraints
      console.log("\n=== FOREIGN KEYS ===");
      const fks = await pool.query(`
         SELECT tc.table_name, kcu.column_name, ccu.table_name AS foreign_table_name, ccu.column_name AS foreign_column_name
         FROM information_schema.table_constraints AS tc
         JOIN information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name
         JOIN information_schema.constraint_column_usage AS ccu ON ccu.constraint_name = tc.constraint_name
         WHERE tc.constraint_type = 'FOREIGN KEY'
         ORDER BY tc.table_name
      `);
      fks.rows.forEach(fk => {
         console.log(`  ${fk.table_name}.${fk.column_name} -> ${fk.foreign_table_name}.${fk.foreign_column_name}`);
      });

      // List indexes
      console.log("\n=== INDEXES ===");
      const idxs = await pool.query(`
         SELECT tablename, indexname, indexdef FROM pg_indexes WHERE schemaname = 'public' ORDER BY tablename, indexname
      `);
      idxs.rows.forEach(idx => {
         console.log(`  ${idx.indexname}: ${idx.indexdef}`);
      });

      process.exit(0);
   } catch (err) {
      console.error(err);
      process.exit(1);
   }
})();
