import express        from "express";
import cors           from "cors";
import helmet         from "helmet";
import morgan         from "morgan";
import cookieParser   from "cookie-parser";
import path           from "path";
import { fileURLToPath } from "url";

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

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:3000', credentials: true }));
app.use(morgan('dev'));
app.use(cookieParser());

// Serve uploaded avatars as static files
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

app.use("/api/auth",          authRoutes);
app.use("/api/admin",         adminRoutes);
app.use("/api/attendance",    AttendanceRoutes);
app.use("/api/swaps",         daySwapRoutes);
app.use("/api/team",          TeamRoutes);
app.use("/api/tasks",         taskRoutes);                    // ✅ This will now work
app.use("/api/avatar",        AvatarRoutes);
app.use("/api/activity",      activityRouter);
app.use("/api/notifications", notificationRouter);

app.get('/health', (req, res) => res.json({ status: 'OK' }));

app.use((req, res) => res.status(404).json({ success: false, message: 'Route not found' }));
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

export default app;