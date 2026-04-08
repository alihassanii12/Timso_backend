import AttendanceModel from '../../models/AttendanceModel.js';
import ActivityModel   from '../../models/activityModel.js';

const STATUS_ICONS  = { office: '🏢', remote: '🏠', away: '🌴' };
const STATUS_LABELS = { office: 'In Office', remote: 'Remote', away: 'Away' };

export const updateAttendance = async (req, res) => {
  try {
    const { status, note = '' } = req.body;
    const userId = req.user.id;
    if (!['office', 'remote', 'away'].includes(status))
      return res.status(400).json({ success: false, message: "status must be 'office', 'remote', or 'away'" });
    const record = await AttendanceModel.upsertToday(userId, status, note);
    const label  = STATUS_LABELS[status];
    const icon   = STATUS_ICONS[status];
    const detail = note ? ` — ${note}` : '';
    await ActivityModel.log(userId, `updated status to ${label}${detail}`, icon);
    return res.json({ success: true, message: 'Attendance updated', data: { attendance: record } });
  } catch (err) {
    console.error('updateAttendance error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const getMyAttendance = async (req, res) => {
  try {
    const record = await AttendanceModel.getToday(req.user.id);
    return res.json({
      success: true,
      data: {
        attendance: record || {
          status: 'away', note: '', since: null,
          date: new Date().toISOString().split('T')[0],
        },
      },
    });
  } catch (err) {
    console.error('getMyAttendance error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const getTeamAttendance = async (req, res) => {
  try {
    const companyId = req.user.company_id || null;
    const team  = await AttendanceModel.getTeamToday(companyId);
    const stats = await AttendanceModel.getTodayStats(companyId);
    return res.json({ success: true, data: { team, stats } });
  } catch (err) {
    console.error('getTeamAttendance error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const getAnalytics = async (req, res) => {
  try {
    const [weekly, todayStats] = await Promise.all([
      AttendanceModel.getWeeklyStats(),
      AttendanceModel.getTodayStats(),
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
      },
    });
  } catch (err) {
    console.error('getAnalytics error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};