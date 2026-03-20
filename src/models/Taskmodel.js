// ✅ CORRECT import - use db from config
import db from '../config/db.js';

class TaskModel {

  // Admin: task banao
  static async create({ title, description, assignedTo, assignedBy, priority = 'medium', dueDate = null }) {
    try {
      const result = await db.query`
        INSERT INTO tasks (title, description, assigned_to, assigned_by, priority, due_date, status, created_at)
        VALUES (${title}, ${description || null}, ${assignedTo}, ${assignedBy}, ${priority}, ${dueDate || null}, 'todo', NOW())
        RETURNING *
      `;
      return result.rows[0];
    } catch (error) {
      console.error('Error in TaskModel.create:', error);
      throw error;
    }
  }

  // Saari tasks — admin ke liye (using raw for dynamic conditions)
  static async getAll(filters = {}) {
    try {
      const { assignedTo, assignedBy, status, priority } = filters;
      const conditions = [];
      const values = [];
      let i = 1;

      if (assignedTo) { 
        conditions.push(`t.assigned_to = $${i++}`); 
        values.push(assignedTo); 
      }
      if (assignedBy) { 
        conditions.push(`t.assigned_by = $${i++}`); 
        values.push(assignedBy); 
      }
      if (status) { 
        conditions.push(`t.status = $${i++}`); 
        values.push(status); 
      }
      if (priority) { 
        conditions.push(`t.priority = $${i++}`); 
        values.push(priority); 
      }

      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

      const query = `
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
      
      // ✅ Use raw for dynamic query with $1, $2 placeholders
      const result = await db.raw(query, values);
      return result.rows;
    } catch (error) {
      console.error('Error in TaskModel.getAll:', error);
      throw error;
    }
  }

  // User ki apni tasks
  static async getMyTasks(userId) {
    try {
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
    } catch (error) {
      console.error('Error in TaskModel.getMyTasks:', error);
      throw error;
    }
  }

  // Single task
  static async getById(id) {
    try {
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
    } catch (error) {
      console.error('Error in TaskModel.getById:', error);
      throw error;
    }
  }

  // Status update
  static async updateStatus(id, status) {
    try {
      const result = await db.query`
        UPDATE tasks 
        SET status = ${status}, updated_at = NOW() 
        WHERE id = ${id} 
        RETURNING *
      `;
      return result.rows[0];
    } catch (error) {
      console.error('Error in TaskModel.updateStatus:', error);
      throw error;
    }
  }

  // Full update — admin (using raw for dynamic updates)
  static async update(id, { title, description, priority, dueDate, status, assignedTo }) {
    try {
      const updates = [];
      const values = [];
      let i = 1;

      if (title !== undefined) { 
        updates.push(`title = $${i++}`); 
        values.push(title); 
      }
      if (description !== undefined) { 
        updates.push(`description = $${i++}`); 
        values.push(description); 
      }
      if (priority !== undefined) { 
        updates.push(`priority = $${i++}`); 
        values.push(priority); 
      }
      if (dueDate !== undefined) { 
        updates.push(`due_date = $${i++}`); 
        values.push(dueDate || null); 
      }
      if (status !== undefined) { 
        updates.push(`status = $${i++}`); 
        values.push(status); 
      }
      if (assignedTo !== undefined) { 
        updates.push(`assigned_to = $${i++}`); 
        values.push(assignedTo); 
      }
      
      if (updates.length === 0) {
        return null; // Nothing to update
      }
      
      updates.push(`updated_at = NOW()`);
      values.push(id);
      
      const query = `UPDATE tasks SET ${updates.join(', ')} WHERE id = $${values.length} RETURNING *`;
      
      // ✅ Use raw for dynamic update query
      const result = await db.raw(query, values);
      return result.rows[0];
    } catch (error) {
      console.error('Error in TaskModel.update:', error);
      throw error;
    }
  }

  // Delete
  static async delete(id) {
    try {
      const result = await db.query`
        DELETE FROM tasks 
        WHERE id = ${id} 
        RETURNING id
      `;
      return result.rows[0];
    } catch (error) {
      console.error('Error in TaskModel.delete:', error);
      throw error;
    }
  }

  // Stats for dashboard
  static async getStats(userId = null) {
    try {
      let result;
      if (userId) {
        result = await db.query`
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
        result = await db.query`
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
      return result.rows[0];
    } catch (error) {
      console.error('Error in TaskModel.getStats:', error);
      throw error;
    }
  }

  // All active users for dropdown
  static async getUsersForAssign() {
    try {
      const result = await db.query`
        SELECT id, full_name, username, email, role
        FROM users
        WHERE is_active = true
        ORDER BY full_name
      `;
      return result.rows;
    } catch (error) {
      console.error('Error in TaskModel.getUsersForAssign:', error);
      throw error;
    }
  }
}

export default TaskModel;