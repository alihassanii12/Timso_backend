import express from 'express';
import { authenticate } from '../middleware/authMiddleware.js';
import { addClient, removeClient } from '../utils/sse.js';

const router = express.Router();

// GET /api/sse — user subscribes to real-time events
router.get('/', authenticate, (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Nginx buffering disable
  res.flushHeaders();

  const userId = req.user.id;
  const companyId = req.user.company_id || null;

  // Send initial ping
  res.write(`event: connected\ndata: ${JSON.stringify({ userId, time: new Date().toISOString() })}\n\n`);

  addClient(userId, companyId, res);

  // Heartbeat every 25s to keep connection alive
  const heartbeat = setInterval(() => {
    try { res.write(': heartbeat\n\n'); } catch { clearInterval(heartbeat); }
  }, 25000);

  req.on('close', () => {
    clearInterval(heartbeat);
    removeClient(userId, res);
  });
});

export default router;
