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
  forgotPassword,   // ← Step 1: OTP bhejo
  verifyOtp,        // ← Step 2: OTP check karo
  resetPassword,    // ← Step 3: Password badlo
} from '../controllers/auth/authController.js';
import { authenticate } from '../middleware/authMiddleware.js';

const router = express.Router();

// ── Public routes ──────────────────────────────────────────
router.post('/register',          register);
router.post('/login',             login);
router.post('/refresh-token',     refreshToken);

// Email verification (OTP)
router.post('/verify-email',      verifyEmail);    // { email, otp }
router.post('/resend-otp',        resendOtp);      // { email }

// Forgot / Reset password (3 steps)
router.post('/forgot-password',   forgotPassword); // { email }
router.post('/verify-otp',        verifyOtp);      // { email, otp }
router.post('/reset-password',    resetPassword);  // { email, otp, password, confirmPassword }

// ── Protected routes ───────────────────────────────────────
router.post('/logout',            authenticate, logout);
router.get('/me',                 authenticate, getCurrentUser);
router.put('/change-password',    authenticate, changePassword);

export default router;
