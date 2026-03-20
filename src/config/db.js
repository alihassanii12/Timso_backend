// config/db.js
import { neon } from '@neondatabase/serverless';

const connectionString = process.env.timso_db_POSTGRES_URL;

if (!connectionString) {
  throw new Error('❌ Database connection string not found!');
}

const sql = neon(connectionString);

// ✅ Named export — userModel.js aur sab models import { query } karte hain
export const query = async (text, params = []) => {
  try {
    const result = await sql.query(text, params);
    return { rows: result.rows ?? result };
  } catch (error) {
    console.error('❌ Database error:', error);
    throw error;
  }
};

// ✅ raw — same as query, backward compat ke liye
export const raw = query;

// ✅ tagged template — direct sql`...` use ke liye
export { sql };

// ✅ default export — jo db.query() ya db.raw() use karte hain
const db = {
  query,
  raw,
  sql,
};

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