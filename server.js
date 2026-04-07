// server.js - yeh complete code copy-paste karo
import dotenv from "dotenv";
import http from "http";
import app from "./src/app.js";
import { initSocket } from "./src/utils/socket.js";
import { initializeDatabase } from "./src/utils/initDB.js";

dotenv.config();

const PORT = process.env.PORT || 5000;
const isVercel = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';

console.log('🚀 Starting server...');
console.log('📦 Environment:', isVercel ? 'Vercel' : 'Local');
console.log('🔧 NODE_ENV:', process.env.NODE_ENV);
console.log('🗄️ DATABASE_URL exists:', !!process.env.DATABASE_URL);

if (!isVercel) {
  const server = http.createServer(app);
  initSocket(server);
  
  initializeDatabase().then(() => {
    server.listen(PORT, () => {
      console.log(`=================================`);
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📍 http://localhost:${PORT}`);
      console.log(`=================================`);
    });
  }).catch(err => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  });
} else {
  console.log('🌐 Running in Vercel serverless mode');
}

// ✅ YEH LINE ZAROORI HAI
export default app;