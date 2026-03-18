import express from 'express';
import { authenticate, adminOnly } from '../middleware/authMiddleware.js';
import {
  updateAttendance,
  getMyAttendance,
  getTeamAttendance,
  getAnalytics,
} from '../controllers/dashboard/Attendancecontroller.js';

const router = express.Router();
router.use(authenticate);

router.post('/',         updateAttendance);
router.get('/me',        getMyAttendance);
router.get('/team',      getTeamAttendance);
router.get('/analytics', adminOnly, getAnalytics);

export default router;
