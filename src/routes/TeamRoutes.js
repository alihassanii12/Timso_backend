import express from 'express';
import { authenticate, adminOnly } from '../middleware/authMiddleware.js';
import AttendanceModel from '../models/AttendanceModel.js';
import DaySwapModel    from '../models/daySwapModel.js';

const router = express.Router();
router.use(authenticate);

// GET /api/team â€” team board
router.get('/', async (req, res) => {
  try {
    const team = await AttendanceModel.getTeamToday();
    return res.json({ success: true, data: { members: team } });
  } catch (err) {
    console.error('GET /api/team error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// GET /api/team/stats
router.get('/stats', async (req, res) => {
  try {
    const stats = await AttendanceModel.getTodayStats();
    return res.json({ success: true, data: { stats } });
  } catch (err) {
    console.error('GET /api/team/stats error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// GET /api/team/analytics â€” admin only
router.get('/analytics', adminOnly, async (req, res) => {
  try {
    const [weekly, todayStats, swapStats] = await Promise.all([
      AttendanceModel.getWeeklyStats(),
      AttendanceModel.getTodayStats(),
      DaySwapModel.getStats(),
    ]);
    const total    = parseInt(todayStats.total_active_users) || 1;
    const inOffice = parseInt(todayStats.in_office) || 0;
    const peakDay  = weekly.reduce(
      (best, d) => parseInt(d.office) > parseInt(best.office || 0) ? d : best,
      weekly[0] || {}
    );
    const totalOffice  = weekly.reduce((s, d) => s + parseInt(d.office || 0), 0);
    const daysWithData = weekly.filter(d => parseInt(d.office) > 0).length || 1;
    return res.json({
      success: true,
      data: {
        avg_office_days:  parseFloat((totalOffice / daysWithData).toFixed(1)),
        peak_day:         peakDay?.day || 'N/A',
        utilization_rate: Math.round((inOffice / total) * 100),
        daily: weekly.map(d => ({
          day: d.day, office: parseInt(d.office)||0,
          remote: parseInt(d.remote)||0, away: parseInt(d.away)||0,
        })),
        today: {
          in_office: inOffice, remote: parseInt(todayStats.remote)||0,
          away: parseInt(todayStats.away)||0, total_users: total,
        },
        swaps: swapStats,
      },
    });
  } catch (err) {
    console.error('GET /api/team/analytics error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// PATCH /api/team/:userId/status â€” admin only
router.patch('/:userId/status', adminOnly, async (req, res) => {
  try {
    const { status, note = '' } = req.body;
    if (!['office', 'remote', 'away'].includes(status))
      return res.status(400).json({ success: false, message: 'Invalid status' });
    const record = await AttendanceModel.upsertToday(req.params.userId, status, note);
    return res.json({ success: true, data: { attendance: record } });
  } catch (err) {
    console.error('PATCH /api/team/:userId/status error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

export default router;
