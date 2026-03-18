import express from 'express';
import { authenticate } from '../middleware/authMiddleware.js';
import { getActivity } from '../controllers/dashboard/Activitycontroller.js';
import {
  getNotifications,
  markRead,
  markAllRead,
} from '../controllers/dashboard/Notificationcontroller.js';

// ── Activity ──────────────────────────────────
export const activityRouter = express.Router();
activityRouter.use(authenticate);
// GET /api/activity
activityRouter.get('/', getActivity);

// ── Notifications ─────────────────────────────
export const notificationRouter = express.Router();
notificationRouter.use(authenticate);
// GET  /api/notifications
notificationRouter.get('/', getNotifications);
// PATCH /api/notifications/read-all
notificationRouter.patch('/read-all', markAllRead);
// PATCH /api/notifications/:id/read
notificationRouter.patch('/:id/read', markRead);
