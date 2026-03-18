import express        from "express";
import cors           from "cors";
import helmet         from "helmet";
import morgan         from "morgan";
import cookieParser   from "cookie-parser";
import path           from "path";
import { fileURLToPath } from "url";
import fs             from "fs"; // Add this for directory check

import authRoutes         from "./routes/authRoutes.js";
import adminRoutes        from "./routes/adminRoutes.js";
import AttendanceRoutes   from "./routes/AttendanceRoutes.js";
import daySwapRoutes      from "./routes/daySwapRoutes.js";      // ✅ small d
import TeamRoutes         from "./routes/TeamRoutes.js";
import taskRoutes         from "./routes/TaskRoutes.js";         // ✅ Capital T
import AvatarRoutes       from "./routes/AvatarRoutes.js";       // ✅ Capital A
import { activityRouter, notificationRouter } from "./routes/MiscRoutes.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

// ✅ Vercel environment detection
const isVercel = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';

// ✅ Create uploads directory if it doesn't exist (for local development)
if (!isVercel) {
  const uploadsDir = path.join(__dirname, '..', 'uploads', 'avatars');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
    console.log(`📁 Created local uploads directory: ${uploadsDir}`);
  }
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(helmet({ 
  crossOriginResourcePolicy: { policy: "cross-origin" } 
}));
app.use(cors({ 
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000', 
  credentials: true 
}));
app.use(morgan('dev'));
app.use(cookieParser());

// ✅ Serve uploaded avatars - conditional for Vercel
if (!isVercel) {
  // Local development: serve from uploads folder
  app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));
  console.log('📁 Serving static files from /uploads (local)');
} else {
  // Vercel: log that files are served via API
  console.log('🌐 Vercel mode: Avatar files served via /api/avatar/file endpoint');
}

// Routes
app.use("/api/auth",          authRoutes);
app.use("/api/admin",         adminRoutes);
app.use("/api/attendance",    AttendanceRoutes);
app.use("/api/swaps",         daySwapRoutes);
app.use("/api/team",          TeamRoutes);
app.use("/api/tasks",         taskRoutes);
app.use("/api/avatar",        AvatarRoutes);  // This will handle both upload and serve
app.use("/api/activity",      activityRouter);
app.use("/api/notifications", notificationRouter);

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    environment: isVercel ? 'vercel' : 'local',
    timestamp: new Date().toISOString()
  });
});

// Root route
app.get('/', (req, res) => {
  res.json({ 
    message: 'Timso Backend API', 
    version: '1.0.0',
    environment: isVercel ? 'production' : 'development'
  });
});

// 404 handler
app.use((req, res) => { 
  res.status(404).json({ success: false, message: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('❌ Error:', err.stack);
  res.status(500).json({ 
    success: false, 
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

export default app;