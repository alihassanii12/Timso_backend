// config/db.js
import { neon } from '@neondatabase/serverless';

const connectionString = process.env.timso_db_POSTGRES_URL;

if (!connectionString) {
  throw new Error('❌ Database connection string not found!');
}

const sql = neon(connectionString);

const db = {
  // Tagged template method
  query: async (strings, ...values) => {
    try {
      const result = await sql(strings, ...values);
      return { rows: result };
    } catch (error) {
      console.error('❌ Database error in query:', error);
      throw error;
    }
  },
  
  // ✅ IMPORTANT: Raw method for traditional $1, $2 placeholders
  raw: async (text, params) => {
    try {
      // Neon's sql function accepts template strings or raw strings with params
      const result = await sql(text, ...params);
      return { rows: result };
    } catch (error) {
      console.error('❌ Database error in raw query:', error);
      console.error('Query:', text);
      console.error('Params:', params);
      throw error;
    }
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