// server.js - yeh complete code copy-paste karo
import dotenv from "dotenv";
import app from "./src/app.js";

dotenv.config();

const PORT = process.env.PORT || 5000;
const isVercel = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';

console.log('🚀 Starting server...');
console.log('📦 Environment:', isVercel ? 'Vercel' : 'Local');
console.log('🔧 NODE_ENV:', process.env.NODE_ENV);
console.log('🗄️ DATABASE_URL exists:', !!process.env.DATABASE_URL);

if (!isVercel) {
  app.listen(PORT, () => {
    console.log(`=================================`);
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📍 http://localhost:${PORT}`);
    console.log(`=================================`);
  });
} else {
  console.log('🌐 Running in Vercel serverless mode');
}

// ✅ YEH LINE ZAROORI HAI
export default app;