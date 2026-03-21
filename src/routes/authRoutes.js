import express from 'express';
import {
  register,
  login,
  logout,
  refreshToken,
  getCurrentUser,
  changePassword,
  verifyEmail,
  resendOtp,
  forgotPassword,
  verifyOtp,
  resetPassword,
} from '../controllers/auth/authController.js';
import { authenticate } from '../middleware/authMiddleware.js';

const router = express.Router();

// ── Public routes ──────────────────────────────────────────
router.post('/register',          register);
router.post('/login',             login);
router.post('/refresh-token',     refreshToken);
router.post('/logout',            logout );        // ✅ authenticate hataya — expired token pe bhi kaam kare

// Email verification (OTP)
router.post('/verify-email',      verifyEmail);
router.post('/resend-otp',        resendOtp);

// Forgot / Reset password (3 steps)
router.post('/forgot-password',   forgotPassword);
router.post('/verify-otp',        verifyOtp);
router.post('/reset-password',    resetPassword);

// ── Protected routes ───────────────────────────────────────
router.get('/me',                 authenticate, getCurrentUser);
router.put('/change-password',    authenticate, changePassword);

export default router;