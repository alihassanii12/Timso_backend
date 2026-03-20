// ✅ CORRECT import
import db from '../config/db.js';  // Import the default export (the object with query method)

class AttendanceModel {

  // Aaj ki attendance upsert karo (insert ya update)
  static async upsertToday(userId, status, note = '') {
    // ✅ Use tagged template syntax with db.query
    const result = await db.query`
      INSERT INTO attendance (user_id, status, note, date, checked_in_at, updated_at)
      VALUES (${userId}, ${status}, ${note}, CURRENT_DATE, NOW(), NOW())
      ON CONFLICT (user_id, date)
      DO UPDATE SET
        status     = EXCLUDED.status,
        note       = EXCLUDED.note,
        updated_at = NOW()
      RETURNING *
    `;
    return result.rows[0];
  }

  // Ek user ki aaj ki attendance
  static async getToday(userId) {
    // ✅ Use tagged template syntax
    const result = await db.query`
      SELECT a.*, u.full_name, u.username, u.role, u.profile_picture
      FROM attendance a
      JOIN users u ON u.id = a.user_id
      WHERE a.user_id = ${userId} AND a.date = CURRENT_DATE
    `;
    return result.rows[0] || null;
  }

  // Puri team ki aaj ki attendance
  static async getTeamToday() {
    // ✅ Use tagged template syntax (no parameters needed)
    const result = await db.query`
      SELECT
        u.id,
        u.full_name,
        u.username,
        u.email,
        u.role                                    AS job_role,
        u.profile_picture,
        COALESCE(a.status, 'away')                AS status,
        COALESCE(a.note, '')                      AS note,
        TO_CHAR(a.checked_in_at, 'HH12:MI AM')   AS since,
        a.date
      FROM users u
      LEFT JOIN attendance a
        ON a.user_id = u.id AND a.date = CURRENT_DATE
      WHERE u.is_active = true
      ORDER BY
        CASE COALESCE(a.status,'away')
          WHEN 'office' THEN 1
          WHEN 'remote' THEN 2
          ELSE 3
        END,
        u.full_name
    `;
    return result.rows;
  }

  // Weekly analytics
  static async getWeeklyStats() {
    // ✅ Use tagged template syntax
    const result = await db.query`
      SELECT
        TO_CHAR(d.date, 'Dy')                              AS day,
        d.date,
        COUNT(a.id) FILTER (WHERE a.status = 'office')     AS office,
        COUNT(a.id) FILTER (WHERE a.status = 'remote')     AS remote,
        COUNT(a.id) FILTER (WHERE a.status = 'away')       AS away
      FROM generate_series(
        DATE_TRUNC('week', CURRENT_DATE),
        DATE_TRUNC('week', CURRENT_DATE) + INTERVAL '4 days',
        INTERVAL '1 day'
      ) AS d(date)
      LEFT JOIN attendance a ON a.date = d.date
      GROUP BY d.date
      ORDER BY d.date
    `;
    return result.rows;
  }

  // Summary stats
  static async getTodayStats() {
    // ✅ Use tagged template syntax
    const result = await db.query`
      SELECT
        COUNT(*)                                           AS total_active_users,
        COUNT(a.id) FILTER (WHERE a.status = 'office')    AS in_office,
        COUNT(a.id) FILTER (WHERE a.status = 'remote')    AS remote,
        COUNT(a.id) FILTER (WHERE a.status = 'away'
          OR a.id IS NULL)                                AS away
      FROM users u
      LEFT JOIN attendance a
        ON a.user_id = u.id AND a.date = CURRENT_DATE
      WHERE u.is_active = true
    `;
    return result.rows[0];
  }
}

export default AttendanceModel;