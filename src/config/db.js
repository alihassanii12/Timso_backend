import pkg from "pg";
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pkg;

const isProduction = process.env.NODE_ENV === 'production';

console.log('🔥 Environment:', process.env.NODE_ENV);
console.log('🔥 DATABASE_URL exists:', !!process.env.DATABASE_URL);

let pool;

if (isProduction) {
  // Production - Neon SSL force
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is required');
  }
  
  // IMPORTANT: SSL HARDCORE FIX
  const connectionString = process.env.DATABASE_URL;
  
  // Ensure SSL parameter exists
  const sslConnectionString = connectionString.includes('sslmode=') 
    ? connectionString 
    : connectionString + '?sslmode=require';
  
  console.log('🔌 Connecting with SSL forced');
  
  pool = new Pool({
    connectionString: sslConnectionString,
    ssl: {
      rejectUnauthorized: false,  // MUST be false for Neon
      require: true,               // Force SSL
    },
    connectionTimeoutMillis: 10000,
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

// Test connection immediately
pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Database connection error:', err.message);
    console.error('Error code:', err.code);
    console.error('Full error:', err);
  } else {
    console.log('✅ Database connected successfully!');
    release();
  }
});

export default pool;