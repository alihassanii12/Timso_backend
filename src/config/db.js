// config/database.js
import { neon } from '@neondatabase/serverless';

// Environment variables Vercel ne automatically set kar diye hain
const connectionString = process.env.timso_db_POSTGRES_URL;

console.log('🔥 Environment:', process.env.NODE_ENV);
console.log('🔥 Neon DB connected:', !!connectionString);

// Neon serverless driver
const sql = neon(connectionString);

// Query helper
export async function query(text, params) {
  try {
    // Neon automatically handles SSL and connection pooling
    const result = await sql(text, ...params);
    return { rows: result };
  } catch (error) {
    console.error('❌ Database error:', error);
    throw error;
  }
}

// Test connection on startup
(async () => {
  try {
    const result = await sql`SELECT NOW() as time`;
    console.log('✅ Database connected:', result[0]?.time);
  } catch (error) {
    console.error('❌ Database connection failed:', error);
  }
})();

export default { query };