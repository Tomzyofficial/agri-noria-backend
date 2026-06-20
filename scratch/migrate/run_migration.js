import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from '../../src/lib/connect.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
    try {
        const sqlPath = path.join(__dirname, 'vendors_onboarding_migration.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');
        
        console.log("Running migration...");
        await pool.query(sql);
        console.log("Migration completed successfully!");
        
    } catch (err) {
        console.error("Migration failed:", err);
    } finally {
        process.exit(0);
    }
}

runMigration();
