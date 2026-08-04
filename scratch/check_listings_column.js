import pool from '../src/lib/connect.js';

async function run() {
    try {
        await pool.query('ALTER TABLE listings ADD COLUMN IF NOT EXISTS product_image TEXT');
        console.log('ALTER TABLE listings ADD COLUMN IF NOT EXISTS product_image TEXT succeeded');
        process.exit(0);
    } catch(e) {
        console.error(e);
        process.exit(1);
    }
}
run();
