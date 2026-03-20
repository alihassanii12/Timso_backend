// config/db.js
import { neon } from '@neondatabase/serverless';

const connectionString = process.env.timso_db_POSTGRES_URL;

if (!connectionString) {
  throw new Error('❌ Database connection string not found!');
}

const sql = neon(connectionString);

// ✅ Tagged template export — userModel query`...` syntax use karta hai
export const query = (strings, ...values) => {
  return sql(strings, ...values).then(result => ({ rows: result }));
};

// ✅ raw — $1 $2 wali queries ke liye
export const raw = async (text, params = []) => {
  const result = await sql.query(text, params);
  return { rows: result.rows ?? result };
};

export { sql };

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