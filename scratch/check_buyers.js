import pool from '../src/lib/connect.js';

async function checkBuyers() {
    try {
        const result = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'buyers'
        `);
        console.log('Buyers Table Columns:', result.rows);
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

checkBuyers();
