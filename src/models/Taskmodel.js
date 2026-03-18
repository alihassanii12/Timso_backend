import pool from '../config/db.js';

class TaskModel {

  // Admin: task banao
  static async create({ title, description, assignedTo, assignedBy, priority = 'medium', dueDate = null }) {
    const q = `
      INSERT INTO tasks (title, description, assigned_to, assigned_by, priority, due_date, status, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, 'todo', NOW())
      RETURNING *
    `;
    const r = await pool.query(q, [title, description || null, assignedTo, assignedBy, priority, dueDate || null]);
    return r.rows[0];
  }

  // Saari tasks — admin ke liye (assigned_by = me ya saari)
  static async getAll(filters = {}) {
    const { assignedTo, assignedBy, status, priority } = filters;
    const conditions = [];
    const values = [];
    let i = 1;

    if (assignedTo)  { conditions.push(`t.assigned_to = $${i++}`);  values.push(assignedTo); }
    if (assignedBy)  { conditions.push(`t.assigned_by = $${i++}`);  values.push(assignedBy); }
    if (status)      { conditions.push(`t.status = $${i++}`);        values.push(status); }
    if (priority)    { conditions.push(`t.priority = $${i++}`);      values.push(priority); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const q = `
      SELECT
        t.*,
        u1.full_name       AS assigned_to_name,
        u1.username        AS assigned_to_username,
        u1.email           AS assigned_to_email,
        u1.profile_picture AS assigned_to_picture,
        u2.full_name       AS assigned_by_name,
        u2.profile_picture AS assigned_by_picture
      FROM tasks t
      JOIN users u1 ON u1.id = t.assigned_to
      JOIN users u2 ON u2.id = t.assigned_by
      ${where}
      ORDER BY
        CASE t.priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END,
        CASE t.status   WHEN 'todo' THEN 0 WHEN 'in_progress' THEN 1 ELSE 2 END,
        t.due_date ASC NULLS LAST,
        t.created_at DESC
    `;
    const r = await pool.query(q, values);
    return r.rows;
  }

  // User ki apni tasks
  static async getMyTasks(userId) {
    return this.getAll({ assignedTo: userId });
  }

  // Single task
  static async getById(id) {
    const q = `
      SELECT t.*,
        u1.full_name AS assigned_to_name, u1.username AS assigned_to_username,
        u1.profile_picture AS assigned_to_picture,
        u2.full_name AS assigned_by_name
      FROM tasks t
      JOIN users u1 ON u1.id = t.assigned_to
      JOIN users u2 ON u2.id = t.assigned_by
      WHERE t.id = $1
    `;
    const r = await pool.query(q, [id]);
    return r.rows[0];
  }

  // Status update — user ya admin
  static async updateStatus(id, status) {
    const q = `UPDATE tasks SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`;
    const r = await pool.query(q, [status, id]);
    return r.rows[0];
  }

  // Full update — admin
  static async update(id, { title, description, priority, dueDate, status, assignedTo }) {
    const fields = [];
    const values = [];
    let i = 1;
    if (title       !== undefined) { fields.push(`title = $${i++}`);       values.push(title); }
    if (description !== undefined) { fields.push(`description = $${i++}`); values.push(description); }
    if (priority    !== undefined) { fields.push(`priority = $${i++}`);    values.push(priority); }
    if (dueDate     !== undefined) { fields.push(`due_date = $${i++}`);    values.push(dueDate || null); }
    if (status      !== undefined) { fields.push(`status = $${i++}`);      values.push(status); }
    if (assignedTo  !== undefined) { fields.push(`assigned_to = $${i++}`); values.push(assignedTo); }
    fields.push(`updated_at = NOW()`);
    values.push(id);
    const q = `UPDATE tasks SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`;
    const r = await pool.query(q, values);
    return r.rows[0];
  }

  // Delete — admin only
  static async delete(id) {
    const r = await pool.query('DELETE FROM tasks WHERE id = $1 RETURNING id', [id]);
    return r.rows[0];
  }

  // Stats for dashboard
  static async getStats(userId = null) {
    const where = userId ? `WHERE assigned_to = ${parseInt(userId)}` : '';
    const q = `
      SELECT
        COUNT(*)                                          AS total,
        COUNT(*) FILTER (WHERE status = 'todo')          AS todo,
        COUNT(*) FILTER (WHERE status = 'in_progress')   AS in_progress,
        COUNT(*) FILTER (WHERE status = 'done')          AS done,
        COUNT(*) FILTER (WHERE priority = 'high'
          AND status != 'done')                          AS high_priority_open,
        COUNT(*) FILTER (WHERE due_date < CURRENT_DATE
          AND status != 'done')                          AS overdue
      FROM tasks ${where}
    `;
    const r = await pool.query(q);
    return r.rows[0];
  }

  // All active users for dropdown
  static async getUsersForAssign() {
    const q = `
      SELECT id, full_name, username, email, role
      FROM users
      WHERE is_active = true
      ORDER BY full_name
    `;
    const r = await pool.query(q);
    return r.rows;
  }
}

export default TaskModel;