// config/database.js - Update karo
import pkg from "pg";
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pkg;

const isProduction = process.env.NODE_ENV === 'production';

console.log('Environment:', process.env.NODE_ENV);
console.log('DATABASE_URL exists:', !!process.env.DATABASE_URL);

let pool;

if (isProduction) {
  // Production - Neon with proper SSL
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is required');
  }
  
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false, // Neon ke liye required
      sslmode: 'require'
    },
    // Connection timeout kam karo
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
  });
} else {
  // Development - Local
  pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'auth_db',
    password: process.env.DB_PASSWORD || 'postgres123',
    port: process.env.DB_PORT || 5432,
  });
}

// Error handling
pool.on('error', (err) => {
  console.error('Unexpected database error:', err);
});

export default pool;