import express from 'express';
import { authenticate } from '../middleware/authMiddleware.js';
import { addClient, removeClient, sendToCompany } from '../utils/sse.js';
import AttendanceModel from '../models/AttendanceModel.js';

const router = express.Router();

// GET /api/sse — user subscribes to real-time events
router.get('/', authenticate, async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const userId = req.user.id;
  const companyId = req.user.company_id || null;

  // Send initial ping
  res.write(`event: connected\ndata: ${JSON.stringify({ userId, time: new Date().toISOString() })}\n\n`);

  addClient(userId, companyId, res);

  // Auto-set attendance to 'remote' on connect (tab opened)
  try {
    const existing = await AttendanceModel.getToday(userId);
    // Only auto-set if currently 'away' or no record
    if (!existing || existing.status === 'away') {
      await AttendanceModel.upsertToday(userId, 'remote', 'Online');
      if (companyId) {
        sendToCompany(companyId, 'attendance_updated', {
          userId, status: 'remote',
          userName: req.user.full_name || req.user.username
        });
      }
    }
  } catch {}

  // Heartbeat every 25s
  const heartbeat = setInterval(() => {
    try { res.write(': heartbeat\n\n'); } catch { clearInterval(heartbeat); }
  }, 25000);

  req.on('close', async () => {
    clearInterval(heartbeat);
    removeClient(userId, res);

    // Auto-set attendance to 'away' on disconnect (tab closed)
    try {
      await AttendanceModel.upsertToday(userId, 'away', '');
      if (companyId) {
        sendToCompany(companyId, 'attendance_updated', {
          userId, status: 'away',
          userName: req.user.full_name || req.user.username
        });
      }
    } catch {}
  });
});

export default router;
