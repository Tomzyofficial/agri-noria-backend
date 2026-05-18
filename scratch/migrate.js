import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from '../src/lib/connect.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function migrate() {
    const schemaFiles = [
        'db-creation.sql',
        'pipeline-schema.sql',
        'aggregator-schema.sql',
        'stages-12-15-schema.sql',
        'migrate-finance-system.sql',
        'scratch/migration_input_v2.sql',
        'db-creation-ads.sql',
        'db-creation-email-verification.sql',
        'db-creation-training.sql',
        'scratch/migrate_input_workflow.sql'
    ];

    try {
        console.log('Starting Database Migration...');

        for (const file of schemaFiles) {
            console.log(`Processing: ${file}...`);
            const sqlPath = path.join(__dirname, '../src', file);

            if (!fs.existsSync(sqlPath)) {
                console.warn(`Warning: ${file} not found, skipping.`);
                continue;
            }

            const sql = fs.readFileSync(sqlPath, 'utf8');

            await pool.query(sql);
            console.log(`${file} applied successfully!`);
        }

        console.log(' Database migration complete! Your local environment is ready.');
        process.exit(0);
    } catch (error) {
        console.error(' Migration failed:', error.message);
        console.error('Stack trace:', error.stack);
        process.exit(1);
    }
}

migrate();
