// config/database.js
import { neon } from '@neondatabase/serverless';

// Environment variables Vercel ne automatically set kar diye hain
const connectionString = process.env.timso_db_POSTGRES_URL;

console.log('🔥 Environment:', process.env.NODE_ENV);
console.log('🔥 Neon DB connected:', !!connectionString);

if (!connectionString) {
  throw new Error('❌ Database connection string not found! Check Vercel environment variables.');
}

// Neon serverless driver
const sql = neon(connectionString);

// ✅ CORRECT: Tagged-template function for Neon
export async function query(strings, ...values) {
  try {
    // Neon tagged-template syntax
    const result = await sql(strings, ...values);
    return { rows: result };
  } catch (error) {
    console.error('❌ Database error:', error);
    throw error;
  }
}

// ✅ For raw SQL with parameters (if absolutely needed)
export async function queryRaw(text, params) {
  try {
    // Convert to tagged template
    const result = await sql(text, ...params);
    return { rows: result };
  } catch (error) {
    console.error('❌ Raw query error:', error);
    throw error;
  }
}

// Test connection on startup
(async () => {
  try {
    const result = await sql`SELECT NOW() as time`;
    console.log('✅ Database connected:', result[0]?.time);
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
  }
})();

export default { query, queryRaw };