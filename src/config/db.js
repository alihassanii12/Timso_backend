import pkg from "pg";
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pkg;

const isProduction = process.env.NODE_ENV === 'production';

console.log('🔥 Environment:', process.env.NODE_ENV);
console.log('🔥 DATABASE_URL exists:', !!process.env.DATABASE_URL);

let pool;

if (isProduction) {
  // Production - Neon with proper SSL
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is required');
  }
  
  // IMPORTANT: SSL configuration sahi karo
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false,  // Neon ke liye required
      sslmode: 'require'           // SSL force karo
    },
    connectionTimeoutMillis: 10000,
  });
  
  console.log('✅ SSL enabled for database connection');
  
} else {
  // Development - Local (SSL一般不 required)
  pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'auth_db',
    password: process.env.DB_PASSWORD || 'postgres123',
    port: process.env.DB_PORT || 5432,
  });
}

// Test connection
pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Database connection error:', err.message);
    console.error('Error code:', err.code);
  } else {
    console.log('✅ Database connected successfully!');
    release();
  }
});

export default pool;