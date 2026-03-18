import dotenv from "dotenv";
import app from "./src/app.js";

dotenv.config();

const PORT = process.env.PORT || 5000;

// ✅ Vercel environment detection
const isVercel = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';

// ✅ Server startup - SIRF local development mein
if (!isVercel) {
  try {
    app.listen(PORT, () => {
      console.log(`=================================`);
      console.log(`🚀 Server running locally on port ${PORT}`);
      console.log(`📍 http://localhost:${PORT}`);
      console.log(`📍 http://127.0.0.1:${PORT}`);
      console.log(`📝 Mode: ${process.env.NODE_ENV || 'development'}`);
      console.log(`=================================`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
} else {
  // ✅ Vercel mode - sirf info log
  console.log(`=================================`);
  console.log(`🌐 Vercel Serverless Mode Active`);
  console.log(`📝 Environment: ${process.env.NODE_ENV}`);
  console.log(`=================================`);
}

// ✅ IMPORTANT: Vercel ke liye app export
export default app;