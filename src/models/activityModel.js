// ✅ CORRECT import - use db instead of pool
import db from '../config/db.js';

class ActivityModel {

  // Naya activity log entry
  static async log(userId, action, icon = '📋') {
    // ✅ Use tagged template syntax with db.query
    const result = await db.query`
      INSERT INTO activity_log (user_id, action, icon, created_at)
      VALUES (${userId}, ${action}, ${icon}, NOW())
      RETURNING *
    `;
    return result.rows[0];
  }

  // Recent activity — dashboard ke liye (last 20)
  static async getRecent(limit = 20) {
    // ✅ Use tagged template syntax with parameter
    const result = await db.query`
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
      LIMIT ${limit}
    `;
    return result.rows;
  }

  // Ek user ki activity
  static async getByUser(userId, limit = 10) {
    // ✅ Use tagged template syntax with multiple parameters
    const result = await db.query`
      SELECT * FROM activity_log
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;
    return result.rows;
  }
}

export default ActivityModel;