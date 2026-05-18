import pool from '../src/lib/connect.js';

async function checkVendors() {
    try {
        const result = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'vendors'
        `);
        console.log('Vendors Table Columns:', result.rows);
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

checkVendors();
