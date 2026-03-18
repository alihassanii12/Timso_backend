import ActivityModel from '../../models/activityModel.js';

export const getActivity = async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const items = await ActivityModel.getRecent(limit);
    return res.json({ success: true, data: { activity: items } });
  } catch (err) {
    console.error('getActivity error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};