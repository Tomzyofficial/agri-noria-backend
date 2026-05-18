import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from '../src/lib/connect.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function syncDatabase() {
    try {
        console.log('Reading SQL schema...');
        const sqlPath = path.join(__dirname, '../src/stages-12-15-schema.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log('Executing SQL schema...');
        await pool.query(sql);
        
        console.log('✅ Database sync complete! All Stage 12-15 tables created.');
        process.exit(0);
    } catch (error) {
        console.error('❌ Database sync failed:', error);
        process.exit(1);
    }
}

syncDatabase();
