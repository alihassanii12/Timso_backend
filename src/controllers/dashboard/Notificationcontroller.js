import db from '../../config/db.js';

export const getNotifications = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const result = await db.raw(
      `SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );
    const countR = await db.raw(
      'SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = false',
      [userId]
    );
    return res.json({
      success: true,
      data: { notifications: result.rows, unread_count: parseInt(countR.rows[0].count) },
    });
  } catch (err) {
    console.error('getNotifications error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const markRead = async (req, res) => {
  try {
    const result = await db.raw(
      `UPDATE notifications SET is_read = true, read_at = NOW()
       WHERE id = $1 AND user_id = $2 RETURNING *`,
      [req.params.id, req.user.id]
    );
    if (!result.rows[0])
      return res.status(404).json({ success: false, message: 'Notification not found' });
    return res.json({ success: true, data: { notification: result.rows[0] } });
  } catch (err) {
    console.error('markRead error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const markAllRead = async (req, res) => {
  try {
    await db.raw(
      `UPDATE notifications SET is_read = true, read_at = NOW()
       WHERE user_id = $1 AND is_read = false`,
      [req.user.id]
    );
    return res.json({ success: true, message: 'All notifications marked as read' });
  } catch (err) {
    console.error('markAllRead error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};