import dotenv from 'dotenv';
dotenv.config({ path: '../.env' });
import fs from 'fs';
import pool from './lib/connect.js';

async function run() {
    try {
        const sql = fs.readFileSync('src/db-institution-pages.sql', 'utf8');
        await pool.query(sql);
        console.log('Success');
    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}
run();
