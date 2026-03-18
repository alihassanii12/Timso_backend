import pool from '../config/db.js';

class ActivityModel {

  // Naya activity log entry
  static async log(userId, action, icon = '📋') {
    const query = `
      INSERT INTO activity_log (user_id, action, icon, created_at)
      VALUES ($1, $2, $3, NOW())
      RETURNING *
    `;
    const result = await pool.query(query, [userId, action, icon]);
    return result.rows[0];
  }

  // Recent activity — dashboard ke liye (last 20)
  static async getRecent(limit = 20) {
    const query = `
      SELECT
        al.id,
        al.action,
        al.icon,
        al.created_at,
        u.id              AS user_id,
        u.full_name       AS name,
        u.username,
        u.profile_picture
      FROM activity_log al
      LEFT JOIN users u ON u.id = al.user_id
      ORDER BY al.created_at DESC
      LIMIT $1
    `;
    const result = await pool.query(query, [limit]);
    return result.rows;
  }

  // Ek user ki activity
  static async getByUser(userId, limit = 10) {
    const query = `
      SELECT * FROM activity_log
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `;
    const result = await pool.query(query, [userId, limit]);
    return result.rows;
  }
}

export default ActivityModel;