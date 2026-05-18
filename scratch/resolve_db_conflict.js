import pool from '../src/lib/connect.js';

async function migrate() {
    try {
        console.log('Renaming conflicting tables...');
        // Safely rename old tables if they exist
        await pool.query(`
            DO $$ 
            BEGIN 
                IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'sales') THEN
                    ALTER TABLE sales RENAME TO sales_old;
                    RAISE NOTICE 'Renamed sales to sales_old';
                END IF;
                
                IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'sales_settlements') THEN
                    ALTER TABLE sales_settlements RENAME TO sales_settlements_old;
                    RAISE NOTICE 'Renamed sales_settlements to sales_settlements_old';
                END IF;
            END $$;
        `);
        
        console.log('✅ Conflict resolved. Ready for fresh sync.');
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

migrate();
