import TaskModel from '../../models/Taskmodel.js';
import pool      from '../../config/db.js';

const tryLog = async (userId, action) => {
  try { await pool.query(`INSERT INTO activity_log (user_id, action, icon, created_at) VALUES ($1, $2, '📋', NOW())`, [userId, action]); } catch {}
};

// GET /api/tasks/users — admin: dropdown ke liye users list
export const getUsersForAssign = async (req, res) => {
  try {
    const users = await TaskModel.getUsersForAssign();
    return res.json({ success: true, data: { users } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/tasks — admin: saari tasks | user: apni tasks
export const getTasks = async (req, res) => {
  try {
    const isAdmin = req.user.role === 'admin';
    const { status, priority, assignedTo } = req.query;
    const filters = {};
    if (status)   filters.status = status;
    if (priority) filters.priority = priority;
    if (isAdmin && assignedTo) filters.assignedTo = assignedTo;
    if (!isAdmin) filters.assignedTo = req.user.id;

    const tasks = await TaskModel.getAll(filters);
    const stats = await TaskModel.getStats(isAdmin ? null : req.user.id);
    return res.json({ success: true, data: { tasks, stats } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/tasks — admin only: task banao
export const createTask = async (req, res) => {
  try {
    const { title, description, assigned_to, priority = 'medium', due_date } = req.body;
    if (!title)       return res.status(400).json({ success: false, message: 'Title required' });
    if (!assigned_to) return res.status(400).json({ success: false, message: 'assigned_to required' });

    const task = await TaskModel.create({
      title, description, priority, dueDate: due_date,
      assignedTo: assigned_to, assignedBy: req.user.id,
    });

    // Notify assigned user
    try {
      await pool.query(
        `INSERT INTO notifications (user_id, type, title, message, data)
         VALUES ($1, 'task_assigned', 'New Task Assigned', $2, $3::jsonb)`,
        [assigned_to, `You have been assigned: ${title}`, JSON.stringify({ task_id: task.id })]
      );
    } catch {}

    await tryLog(req.user.id, `assigned task "${title}" to user #${assigned_to}`);
    return res.status(201).json({ success: true, message: 'Task created', data: { task } });
  } catch (err) {
    console.error('createTask error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// PATCH /api/tasks/:id/status — user: apna status update kare
export const updateTaskStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!['todo','in_progress','done'].includes(status))
      return res.status(400).json({ success: false, message: 'Invalid status' });

    const task = await TaskModel.getById(req.params.id);
    if (!task) return res.status(404).json({ success: false, message: 'Task not found' });

    // Sirf assigned user ya admin update kar sakta hai
    if (req.user.role !== 'admin' && String(task.assigned_to) !== String(req.user.id))
      return res.status(403).json({ success: false, message: 'Not your task' });

    const updated = await TaskModel.updateStatus(req.params.id, status);
    await tryLog(req.user.id, `updated task "${task.title}" to ${status}`);
    return res.json({ success: true, message: 'Status updated', data: { task: updated } });
  } catch (err) {
    console.error('updateTaskStatus error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// PATCH /api/tasks/:id — admin only: full update
export const updateTask = async (req, res) => {
  try {
    const { title, description, priority, due_date, status, assigned_to } = req.body;
    const updated = await TaskModel.update(req.params.id, {
      title, description, priority, dueDate: due_date, status, assignedTo: assigned_to,
    });
    if (!updated) return res.status(404).json({ success: false, message: 'Task not found' });
    return res.json({ success: true, message: 'Task updated', data: { task: updated } });
  } catch (err) {
    console.error('updateTask error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE /api/tasks/:id — admin only
export const deleteTask = async (req, res) => {
  try {
    const deleted = await TaskModel.delete(req.params.id);
    if (!deleted) return res.status(404).json({ success: false, message: 'Task not found' });
    return res.json({ success: true, message: 'Task deleted' });
  } catch (err) {
    console.error('deleteTask error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};