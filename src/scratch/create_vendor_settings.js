import pool from '../lib/connect.js';

const createTable = async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS vendor_settings (
                vendor_id UUID PRIMARY KEY REFERENCES vendors(id) ON DELETE CASCADE,
                preferences JSONB DEFAULT '{}'::jsonb,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
            );
        `);
        console.log("Table created");
    } catch (err) {
        console.error(err);
    }
    process.exit(0);
};

createTable();
