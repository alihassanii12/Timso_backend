import express        from "express";
import helmet         from "helmet";
import morgan         from "morgan";
import cookieParser   from "cookie-parser";
import path           from "path";
import { fileURLToPath } from "url";
import fs             from "fs";

import authRoutes         from "./routes/authRoutes.js";
import adminRoutes        from "./routes/adminRoutes.js";
import AttendanceRoutes   from "./routes/AttendanceRoutes.js";
import daySwapRoutes      from "./routes/daySwapRoutes.js";
import TeamRoutes         from "./routes/TeamRoutes.js";
import taskRoutes         from "./routes/TaskRoutes.js";
import AvatarRoutes       from "./routes/AvatarRoutes.js";
import companyRoutes      from "./routes/companyRoutes.js";
import jobRoutes          from "./routes/jobRoutes.js";
import sseRoutes          from "./routes/sseRoutes.js";
import { activityRouter, notificationRouter } from "./routes/MiscRoutes.js";
import corsMiddleware     from "./cors.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

const isVercel = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';

if (!isVercel) {
  const uploadsDir = path.join(__dirname, '..', 'uploads', 'avatars');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
    console.log(`Created local uploads directory: ${uploadsDir}`);
  }
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

/* ── CORS ── */
app.use(corsMiddleware);

app.use(morgan('dev'));
app.use(cookieParser());

if (!isVercel) {
  app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));
} else {
  console.log('Vercel mode: Avatar files served via /api/avatar/file endpoint');
}

app.use("/api/auth",          authRoutes);
app.use("/api/admin",         adminRoutes);
app.use("/api/attendance",    AttendanceRoutes);
app.use("/api/swaps",         daySwapRoutes);
app.use("/api/team",          TeamRoutes);
app.use("/api/tasks",         taskRoutes);
app.use("/api/avatar",        AvatarRoutes);
app.use("/api/companies",     companyRoutes);
app.use("/api/jobs",          jobRoutes);
app.use("/api/sse",           sseRoutes);
app.use("/api/activity",      activityRouter);
app.use("/api/notifications", notificationRouter);

app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    environment: isVercel ? 'vercel' : 'local',
    timestamp: new Date().toISOString()
  });
});

app.get('/', (req, res) => {
  res.json({
    message: 'Timso Backend API',
    version: '1.0.0',
    environment: isVercel ? 'production' : 'development'
  });
});

app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

app.use((err, req, res, next) => {
  console.error('Error:', err.stack);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

export default app;