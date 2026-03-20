// ✅ CORRECT import - use db instead of pool
import db from '../config/db.js';

class TaskModel {

  // Admin: task banao
  static async create({ title, description, assignedTo, assignedBy, priority = 'medium', dueDate = null }) {
    // ✅ Use tagged template syntax
    const result = await db.query`
      INSERT INTO tasks (title, description, assigned_to, assigned_by, priority, due_date, status, created_at)
      VALUES (${title}, ${description || null}, ${assignedTo}, ${assignedBy}, ${priority}, ${dueDate || null}, 'todo', NOW())
      RETURNING *
    `;
    return result.rows[0];
  }

  // Saari tasks — admin ke liye (assigned_by = me ya saari)
  static async getAll(filters = {}) {
    const { assignedTo, assignedBy, status, priority } = filters;
    
    // ✅ Build conditions using tagged template fragments
    let conditions = [];
    let query = `
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
    `;
    
    // Build WHERE clause with tagged template fragments
    if (assignedTo) {
      conditions.push(db.query`t.assigned_to = ${assignedTo}`);
    }
    if (assignedBy) {
      conditions.push(db.query`t.assigned_by = ${assignedBy}`);
    }
    if (status) {
      conditions.push(db.query`t.status = ${status}`);
    }
    if (priority) {
      conditions.push(db.query`t.priority = ${priority}`);
    }
    
    // Combine conditions
    if (conditions.length > 0) {
      query += ` WHERE `;
      for (let i = 0; i < conditions.length; i++) {
        if (i > 0) query += ` AND `;
        // Extract the SQL string from the tagged template result
        const condition = await conditions[i];
        query += condition.strings[0];
      }
    }
    
    query += `
      ORDER BY
        CASE t.priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END,
        CASE t.status   WHEN 'todo' THEN 0 WHEN 'in_progress' THEN 1 ELSE 2 END,
        t.due_date ASC NULLS LAST,
        t.created_at DESC
    `;
    
    // Execute the built query
    const result = await db.query(query);
    return result.rows;
  }

  // User ki apni tasks
  static async getMyTasks(userId) {
    // ✅ Simple query with parameter
    const result = await db.query`
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
      WHERE t.assigned_to = ${userId}
      ORDER BY
        CASE t.priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END,
        CASE t.status   WHEN 'todo' THEN 0 WHEN 'in_progress' THEN 1 ELSE 2 END,
        t.due_date ASC NULLS LAST,
        t.created_at DESC
    `;
    return result.rows;
  }

  // Single task
  static async getById(id) {
    // ✅ Use tagged template syntax
    const result = await db.query`
      SELECT t.*,
        u1.full_name AS assigned_to_name, u1.username AS assigned_to_username,
        u1.profile_picture AS assigned_to_picture,
        u2.full_name AS assigned_by_name
      FROM tasks t
      JOIN users u1 ON u1.id = t.assigned_to
      JOIN users u2 ON u2.id = t.assigned_by
      WHERE t.id = ${id}
    `;
    return result.rows[0];
  }

  // Status update — user ya admin
  static async updateStatus(id, status) {
    // ✅ Use tagged template syntax
    const result = await db.query`
      UPDATE tasks 
      SET status = ${status}, updated_at = NOW() 
      WHERE id = ${id} 
      RETURNING *
    `;
    return result.rows[0];
  }

  // Full update — admin
  static async update(id, { title, description, priority, dueDate, status, assignedTo }) {
    // ✅ Build dynamic update query with tagged template fragments
    const updates = [];
    const values = [];
    
    if (title !== undefined) {
      updates.push(db.query`title = ${title}`);
      values.push(title);
    }
    if (description !== undefined) {
      updates.push(db.query`description = ${description}`);
      values.push(description);
    }
    if (priority !== undefined) {
      updates.push(db.query`priority = ${priority}`);
      values.push(priority);
    }
    if (dueDate !== undefined) {
      updates.push(db.query`due_date = ${dueDate || null}`);
      values.push(dueDate);
    }
    if (status !== undefined) {
      updates.push(db.query`status = ${status}`);
      values.push(status);
    }
    if (assignedTo !== undefined) {
      updates.push(db.query`assigned_to = ${assignedTo}`);
      values.push(assignedTo);
    }
    
    updates.push(db.query`updated_at = NOW()`);
    
    // Build the query string
    let query = `UPDATE tasks SET `;
    for (let i = 0; i < updates.length; i++) {
      if (i > 0) query += `, `;
      const update = await updates[i];
      query += update.strings[0];
    }
    query += ` WHERE id = ${id} RETURNING *`;
    
    const result = await db.query(query);
    return result.rows[0];
  }

  // Delete — admin only
  static async delete(id) {
    // ✅ Use tagged template syntax
    const result = await db.query`
      DELETE FROM tasks 
      WHERE id = ${id} 
      RETURNING id
    `;
    return result.rows[0];
  }

  // Stats for dashboard
  static async getStats(userId = null) {
    // ✅ Build query dynamically with proper parameter handling
    let query;
    if (userId) {
      query = db.query`
        SELECT
          COUNT(*)                                          AS total,
          COUNT(*) FILTER (WHERE status = 'todo')          AS todo,
          COUNT(*) FILTER (WHERE status = 'in_progress')   AS in_progress,
          COUNT(*) FILTER (WHERE status = 'done')          AS done,
          COUNT(*) FILTER (WHERE priority = 'high'
            AND status != 'done')                          AS high_priority_open,
          COUNT(*) FILTER (WHERE due_date < CURRENT_DATE
            AND status != 'done')                          AS overdue
        FROM tasks
        WHERE assigned_to = ${parseInt(userId)}
      `;
    } else {
      query = db.query`
        SELECT
          COUNT(*)                                          AS total,
          COUNT(*) FILTER (WHERE status = 'todo')          AS todo,
          COUNT(*) FILTER (WHERE status = 'in_progress')   AS in_progress,
          COUNT(*) FILTER (WHERE status = 'done')          AS done,
          COUNT(*) FILTER (WHERE priority = 'high'
            AND status != 'done')                          AS high_priority_open,
          COUNT(*) FILTER (WHERE due_date < CURRENT_DATE
            AND status != 'done')                          AS overdue
        FROM tasks
      `;
    }
    
    const result = await query;
    return result.rows[0];
  }

  // All active users for dropdown
  static async getUsersForAssign() {
    // ✅ Simple query with no parameters
    const result = await db.query`
      SELECT id, full_name, username, email, role
      FROM users
      WHERE is_active = true
      ORDER BY full_name
    `;
    return result.rows;
  }
}

export default TaskModel;