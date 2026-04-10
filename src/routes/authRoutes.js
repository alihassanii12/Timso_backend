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
router.put('/profile',            authenticate, async (req, res) => {
  try {
    const { fullName, username, phoneNumber, bio, skills, experience, location, cvUrl } = req.body;
    const { raw } = await import('../config/db.js');
    const result = await raw(
      `UPDATE users SET
        full_name=COALESCE($1,full_name),
        username=COALESCE($2,username),
        phone_number=COALESCE($3,phone_number),
        bio=COALESCE($4,bio),
        skills=COALESCE($5,skills),
        experience=COALESCE($6,experience),
        location=COALESCE($7,location),
        cv_url=COALESCE($8,cv_url),
        updated_at=NOW()
       WHERE id=$9
       RETURNING id, email, username, full_name, role, company_id, profile_picture, bio, skills, experience, location, phone_number, cv_url`,
      [fullName||null, username||null, phoneNumber||null, bio||null, skills||null, experience||null, location||null, cvUrl||null, req.user.id]
    );
    res.json({ success: true, user: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Get any user's public profile (for admin to view applicant details)
router.get('/profile/:userId', authenticate, async (req, res) => {
  try {
    const { raw } = await import('../config/db.js');
    const result = await raw(
      `SELECT id, full_name, email, username, profile_picture, bio, skills, experience, location, phone_number, cv_url, role, created_at
       FROM users WHERE id = $1`,
      [req.params.userId]
    );
    if (!result.rows[0]) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, user: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;