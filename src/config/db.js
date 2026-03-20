// config/db.js
import { neon } from '@neondatabase/serverless';

const connectionString = process.env.timso_db_POSTGRES_URL;

console.log('🔥 Environment:', process.env.NODE_ENV);
console.log('🔥 Neon DB connected:', !!connectionString);

if (!connectionString) {
  throw new Error('❌ Database connection string not found!');
}

// Create the SQL tagged template function
const sql = neon(connectionString);

// ✅ Export a function that can be used as a tagged template
export async function query(strings, ...values) {
  try {
    const result = await sql(strings, ...values);
    return { rows: result };
  } catch (error) {
    console.error('❌ Database error:', error);
    throw error;
  }
}

// Alternative: Export a wrapper that can be called as tagged template
const db = {
  query: async (strings, ...values) => {
    try {
      const result = await sql(strings, ...values);
      return { rows: result };
    } catch (error) {
      console.error('❌ Database error:', error);
      throw error;
    }
  },
  // For raw SQL queries if absolutely needed
  raw: async (text, params) => {
    // For Neon, we need to use the tagged template approach
    // This is a workaround for when you really need traditional params
    const result = await sql(text, ...params);
    return { rows: result };
  }
};

// Test connection
(async () => {
  try {
    const result = await sql`SELECT NOW() as time`;
    console.log('✅ Database connected:', result[0]?.time);
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
  }
})();

export default db;