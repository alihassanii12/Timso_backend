import express from 'express';
import { authenticate, adminOnly } from '../middleware/authMiddleware.js';
import UserModel from '../models/userModel.js';

const router = express.Router();

// All admin routes require authentication and admin role
router.use(authenticate, adminOnly);

// Get all users
router.get('/users', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    
    const result = await UserModel.getAllUsers(page, limit);
    
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get users by role
router.get('/users/role/:role', async (req, res) => {
  try {
    const { role } = req.params;
    const users = await UserModel.getUsersByRole(role);
    
    res.json({
      success: true,
      users
    });
  } catch (error) {
    console.error('Get users by role error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Update user role
router.patch('/users/:userId/role', async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;

    if (!['user', 'admin', 'moderator'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role. Allowed roles: user, admin, moderator'
      });
    }

    const updatedUser = await UserModel.updateUserRole(userId, role);

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      message: `User role updated to ${role}`,
      user: updatedUser
    });
  } catch (error) {
    console.error('Update user role error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Toggle user active status
router.patch('/users/:userId/status', async (req, res) => {
  try {
    const { userId } = req.params;
    const { isActive } = req.body;

    // Don't allow admin to deactivate themselves
    if (userId === req.user.id && !isActive) {
      return res.status(400).json({
        success: false,
        message: 'You cannot deactivate your own account'
      });
    }

    const updatedUser = await UserModel.toggleUserStatus(userId, isActive);

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      message: `User ${isActive ? 'activated' : 'deactivated'} successfully`,
      user: updatedUser
    });
  } catch (error) {
    console.error('Toggle user status error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Delete user
router.delete('/users/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    // Don't allow admin to delete themselves
    if (userId === req.user.id) {
      return res.status(400).json({
        success: false,
        message: 'You cannot delete your own account'
      });
    }

    const deletedUser = await UserModel.deleteUser(userId);

    if (!deletedUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get admin dashboard stats
router.get('/dashboard/stats', async (req, res) => {
  try {
    const totalUsers = await UserModel.getAllUsers(1, 1);
    const adminUsers = await UserModel.getUsersByRole('admin');
    const activeUsers = await UserModel.getAllUsers(1, 1000); // Get all active users

    res.json({
      success: true,
      stats: {
        totalUsers: totalUsers.total,
        adminCount: adminUsers.length,
        activeUsers: activeUsers.users.filter(u => u.is_active).length,
        inactiveUsers: activeUsers.users.filter(u => !u.is_active).length
      }
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

export default router;