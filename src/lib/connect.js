import { Pool } from "pg";
import dotenv from "dotenv";
dotenv.config();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "Missing database connection string. Set DATABASE_URL in .env",
  );
}

const isRemoteDb =
  connectionString.includes("sslmode=require") ||
  connectionString.includes("neon.tech") ||
  connectionString.includes("supabase.co") ||
  connectionString.includes("railway.app") ||
  process.env.NODE_ENV === "production";

const pool = new Pool({
  connectionString,
  ssl: isRemoteDb
    ? { rejectUnauthorized: false }
    : false,
  max: 10,
  min: 0,
  idleTimeoutMillis: 15000,
  connectionTimeoutMillis: 10000,
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
});

// Catch errors on idle clients so they are removed cleanly without crashing
pool.on("error", (err) => {
  console.warn("PostgreSQL idle client warning (handled):", err.message);
});

// Test the database connection
const testConnection = async () => {
  try {
    const client = await pool.connect();
    console.log("Successfully connected to PostgreSQL database");
    client.release();
  } catch (error) {
    console.error("Error connecting to PostgreSQL database:", error.message);
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
