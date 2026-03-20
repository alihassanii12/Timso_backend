// config/db.js
import { neon } from '@neondatabase/serverless';

const connectionString = process.env.timso_db_POSTGRES_URL;

if (!connectionString) {
  throw new Error('❌ Database connection string not found!');
}

const sql = neon(connectionString);

// ✅ Named export — import { query } kaam karega
// Neon v2 mein sql.query(text, params) use karo
export const query = async (text, params) => {
  try {
    // params undefined ya empty ho to bhi handle karo
    const result = await sql.query(text, params || []);
    // Neon sql.query rows array return karta hai directly
    // { rows: [...] } format mein wrap karo
    if (Array.isArray(result)) {
      return { rows: result };
    }
    if (result && result.rows) {
      return result;
    }
    return { rows: result || [] };
  } catch (error) {
    console.error('❌ Database error:', error);
    console.error('Query:', text);
    console.error('Params:', params);
    throw error;
  }
};

// ✅ raw — same as query, backward compat
export const raw = query;

// ✅ tagged template literal use ke liye
export { sql };

// ✅ default export
const db = { query, raw, sql };

// Test connection
(async () => {
  try {
    const result = await sql`SELECT NOW() as time`;
    console.log('🔥 Neon DB connected:', result[0]?.time);
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
  }
})();

export default db;