import express from 'express';
import { authenticate, adminOnly } from '../middleware/authMiddleware.js';
import {
  getTasks,
  createTask,
  updateTaskStatus,
  updateTask,
  deleteTask,
  getUsersForAssign,
} from '../controllers/dashboard/taskController.js';

const router = express.Router();
router.use(authenticate);

// GET  /api/tasks/users  — admin: users dropdown
router.get('/users', adminOnly, getUsersForAssign);

// GET  /api/tasks        — admin: all | user: own
router.get('/', getTasks);

// POST /api/tasks        — admin only
router.post('/', adminOnly, createTask);

// PATCH /api/tasks/:id/status  — user: apna status update
router.patch('/:id/status', updateTaskStatus);

// PATCH /api/tasks/:id   — admin only: full edit
router.patch('/:id', adminOnly, updateTask);

// DELETE /api/tasks/:id  — admin only
router.delete('/:id', adminOnly, deleteTask);

export default router;
