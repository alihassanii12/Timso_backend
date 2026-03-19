import pkg from "pg";
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pkg;

const isProduction = process.env.NODE_ENV === 'production';

console.log('🔥 Environment:', process.env.NODE_ENV);
console.log('🔥 DATABASE_URL exists:', !!process.env.DATABASE_URL);

let pool;

if (isProduction) {
  // Production - Sirf DATABASE_URL use karo
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is required');
  }
  
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false,
      require: true
    },
    connectionTimeoutMillis: 10000,
  });
  
} else {
  // Development - Local PostgreSQL
  pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'auth_db',
    password: process.env.DB_PASSWORD || 'postgres123',
    port: process.env.DB_PORT || 5432,
  });
}

export default pool;