import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function checkTrainings() {
   try {
      const trainings = await pool.query("SELECT id, title FROM trainings");
      console.log("Total Trainings:", trainings.rows.length);
      console.log("Trainings:", trainings.rows);
   } catch (err) {
      console.error(err);
   } finally {
      await pool.end();
   }
}

checkTrainings();
