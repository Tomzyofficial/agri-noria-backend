import { Pool } from "pg";
import dotenv from "dotenv";
dotenv.config();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
   throw new Error("Missing database connection string. Set DATABASE_URL in .env");
}



const pool = new Pool({
   connectionString,
   ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

// Test the database connection
const testConnection = async () => {
   try {
      const client = await pool.connect();
      console.log("Successfully connected to PostgreSQL database");
      client.release();
   } catch (error) {
      console.error("Error connecting to PostgreSQL database:", error);
      throw error;
   }
};

// Call test connection on startup
testConnection().catch(console.error);

// Handle process termination
process.on("SIGINT", async () => {
   await pool.end();
   console.log("Database connection pool closed");
   process.exit(0);
});

export default pool;
