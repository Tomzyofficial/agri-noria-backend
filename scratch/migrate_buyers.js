import pool from '../src/lib/connect.js';

async function migrateBuyers() {
    try {
        await pool.query(`
            ALTER TABLE buyers 
            ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE
        `);
        console.log('Successfully added is_active column to buyers table.');
        process.exit(0);
    } catch (error) {
        console.error('Error migrating buyers table:', error);
        process.exit(1);
    }
}

migrateBuyers();
