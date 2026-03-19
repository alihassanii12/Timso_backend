import bcrypt from "bcryptjs";
import validator from 'validator';
import crypto from 'crypto';
import pool from '../../config/db.js';
import UserModel from "../../models/userModel.js";
import { 
  generateAccessToken, 
  generateRefreshToken,
  verifyAccessToken 
} from "../../utils/tokenUtils.js";
import { sendVerificationEmail, sendPasswordResetEmail } from "../../utils/emailService.js";

/* ─────────────────────────────────────────────
   Helper: 6-digit OTP generate karo
───────────────────────────────────────────── */
const generateOTP = () => {
  // crypto se secure random 6-digit number
  return crypto.randomInt(100000, 999999).toString();
};

/* ─────────────────────────────────────────────
   REGISTER
───────────────────────────────────────────── */
export const register = async (req, res) => {
  try {
    // Frontend 'fullname' (lowercase n) bhejta hai — dono accept karo
    const { email, username, password, fullname, fullName: fullNameAlt, role } = req.body;
    const fullName = fullname || fullNameAlt || '';

    if (!email || !username || !password) {
      return res.status(400).json({ 
        success: false,
        message: "Email, username and password are required" 
      });
    }

    if (!validator.isEmail(email)) {
      return res.status(400).json({ 
        success: false,
        message: "Invalid email format" 
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    if (username.length < 3 || username.length > 20) {
      return res.status(400).json({ 
        success: false,
        message: "Username must be between 3 and 20 characters" 
      });
    }

    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return res.status(400).json({ 
        success: false,
        message: "Username can only contain letters, numbers, and underscores" 
      });
    }

    if (password.length < 6) {
      return res.status(400).json({ 
        success: false,
        message: "Password must be at least 6 characters" 
      });
    }

    const existingUserByEmail = await UserModel.findByEmail(normalizedEmail);
    if (existingUserByEmail) {
      return res.status(400).json({ 
        success: false,
        message: "Email already registered" 
      });
    }

    const existingUserByUsername = await UserModel.findByUsername(username);
    if (existingUserByUsername) {
      return res.status(400).json({ 
        success: false,
        message: "Username already taken" 
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    // ── OTP generate karo ──
    const otp = generateOTP();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    const validRoles = ['admin', 'user'];
    const userRole = validRoles.includes(role) ? role : 'user';

    const newUser = await UserModel.create({
      email: normalizedEmail,
      username,
      password: hashedPassword,
      fullName,
      role: userRole,
      emailVerificationToken: otp,
      emailVerificationExpires: otpExpires,
    });

    // ── OTP email bhejo — fail hone pe register nahi rokna ──
    try {
      await sendVerificationEmail(normalizedEmail, otp, fullName || username);
    } catch (emailError) {
      console.error("Email send failed (non-fatal):", emailError.message);
    }

    const accessToken = generateAccessToken(newUser);
    const refreshToken = generateRefreshToken();
    await UserModel.updateRefreshToken(newUser.id, refreshToken);

    const isProduction = process.env.NODE_ENV === 'production';

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/api/auth/refresh-token'
    });

    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000,
      path: '/'
    });

    res.status(201).json({
      success: true,
      message: "Registered successfully. OTP sent to your email.",
      data: {
        token: accessToken,   // frontend data.data.token dhundta hai
      },
      user: {
        id:            newUser.id,
        email:         newUser.email,
        username:      newUser.username,
        fullName:      newUser.full_name || fullName,
        role:          newUser.role || userRole,
        emailVerified: false,
      },
      accessToken,
      requiresOtp: true,
    });

  } catch (error) {
    console.error("Registration error:", error.message, error.stack);
    res.status(500).json({ 
      success: false,
      message: "Internal server error during registration",
      ...(process.env.NODE_ENV !== 'production' && { debug: error.message })
    });
  }
};


export const login = async (req, res) => {
  try {
    const { identifier, email, password } = req.body;
    const loginIdentifier = identifier || email;

    if (!loginIdentifier || !password) {
      return res.status(400).json({ 
        success: false,
        message: "Email/Username and password are required" 
      });
    }

    const user = await UserModel.findByEmailOrUsername(loginIdentifier);

    if (!user) {
      await UserModel.handleFailedLogin(loginIdentifier, req.ip, req.get('user-agent'));
      return res.status(401).json({ 
        success: false,
        message: "Invalid credentials" 
      });
    }

    if (user.locked_until && user.locked_until > new Date()) {
      const minutesLeft = Math.ceil((user.locked_until - new Date()) / (60 * 1000));
      return res.status(403).json({
        success: false,
        message: `Account is locked. Please try again after ${minutesLeft} minutes.`
      });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      await UserModel.handleFailedLogin(loginIdentifier, req.ip, req.get('user-agent'));
      return res.status(401).json({ 
        success: false,
        message: "Invalid credentials" 
      });
    }

    await UserModel.resetFailedAttempts(user.id);
    await UserModel.updateLastLogin(user.id, req.ip, req.get('user-agent'));

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken();
    await UserModel.updateRefreshToken(user.id, refreshToken);

    const isProduction = process.env.NODE_ENV === 'production';

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/api/auth/refresh-token'
    });

    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000,
      path: '/'
    });

    res.json({
      success: true,
      message: "Login successful",
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        fullName: user.full_name,
        emailVerified: user.email_verified,
        role: user.role
      },
      accessToken,
      // Agar email verify nahi to frontend ko pata chale
      requiresOtp: !user.email_verified,
    });

  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ 
      success: false,
      message: "Internal server error during login"
    });
  }
};

/* ─────────────────────────────────────────────
   REFRESH TOKEN
───────────────────────────────────────────── */
export const refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.cookies;

    if (!refreshToken) {
      return res.status(401).json({ 
        success: false,
        message: "Refresh token required" 
      });
    }

    const user = await UserModel.findByRefreshToken(refreshToken);
    if (!user) {
      return res.status(403).json({ 
        success: false,
        message: "Invalid refresh token" 
      });
    }

    const newAccessToken = generateAccessToken(user);
    const newRefreshToken = generateRefreshToken();
    await UserModel.updateRefreshToken(user.id, newRefreshToken);

    const isProduction = process.env.NODE_ENV === 'production';

    res.cookie('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/api/auth/refresh-token'
    });

    res.cookie('accessToken', newAccessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000,
      path: '/'
    });

    res.json({
      success: true,
      accessToken: newAccessToken
    });

  } catch (error) {
    console.error("Refresh token error:", error);
    res.status(500).json({ 
      success: false,
      message: "Internal server error during token refresh" 
    });
  }
};

/* ─────────────────────────────────────────────
   LOGOUT
───────────────────────────────────────────── */
export const logout = async (req, res) => {
  try {
    const { refreshToken } = req.cookies;
    if (refreshToken) {
      await UserModel.updateRefreshToken(req.user.id, null);
    }

    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');

    res.json({
      success: true,
      message: "Logged out successfully"
    });

  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({ 
      success: false,
      message: "Internal server error during logout" 
    });
  }
};

/* ─────────────────────────────────────────────
   GET CURRENT USER
───────────────────────────────────────────── */
export const getCurrentUser = async (req, res) => {
  try {
    const user = await UserModel.getProfile(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    res.json({
      success: true,
      user: {
        id:              user.id,
        email:           user.email,
        username:        user.username,
        fullName:        user.full_name,
        full_name:       user.full_name,
        role:            user.role,
        emailVerified:   user.email_verified,
        createdAt:       user.created_at,
        profile_picture: user.profile_picture || null,
      }
    });

  } catch (error) {
    console.error("Get current user error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};

/* ─────────────────────────────────────────────
   CHANGE PASSWORD
───────────────────────────────────────────── */
export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Current password and new password are required"
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "New password must be at least 6 characters"
      });
    }

    const user = await UserModel.findByEmail(req.user.email);
    const isValidPassword = await bcrypt.compare(currentPassword, user.password);

    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: "Current password is incorrect"
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await UserModel.updatePassword(userId, hashedPassword);

    res.json({
      success: true,
      message: "Password changed successfully"
    });

  } catch (error) {
    console.error("Change password error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};

/* ─────────────────────────────────────────────
   FORGOT PASSWORD — Step 1
   OTP generate karo aur email pe bhejo
   POST /api/auth/forgot-password
   Body: { email }
───────────────────────────────────────────── */
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required"
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await UserModel.findByEmail(normalizedEmail);

    // Security: even if user not found, same response dو
    // (taake email enumeration attack na ho)
    if (!user) {
      return res.json({
        success: true,
        message: "If this email exists, an OTP has been sent."
      });
    }

    // Rate limiting — agar 1 minute pehle OTP bheja tha to rokو
    if (
      user.password_reset_expires &&
      user.password_reset_expires > new Date(Date.now() - 9 * 60 * 1000)
    ) {
      return res.status(429).json({
        success: false,
        message: "Please wait 1 minute before requesting a new OTP"
      });
    }

    const otp = generateOTP();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // DB mein save karo
    await UserModel.savePasswordResetOtp(user.id, otp, otpExpires);

    // Email bhejo
    await sendPasswordResetEmail(normalizedEmail, otp, user.full_name || user.username);

    res.json({
      success: true,
      message: "OTP sent to your email. Valid for 10 minutes."
    });

  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};

/* ─────────────────────────────────────────────
   VERIFY OTP — Step 2
   Sirf OTP check karo, password mat badlo abhi
   POST /api/auth/verify-otp
   Body: { email, otp }
───────────────────────────────────────────── */
export const verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: "Email and OTP are required"
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await UserModel.findByEmail(normalizedEmail);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    if (!user.password_reset_token || user.password_reset_token !== otp) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP. Please check your email."
      });
    }

    if (!user.password_reset_expires || user.password_reset_expires < new Date()) {
      return res.status(400).json({
        success: false,
        message: "OTP has expired. Please request a new one.",
        expired: true
      });
    }

    // OTP sahi hai — frontend step 3 pe ja sakta hai
    res.json({
      success: true,
      message: "OTP verified successfully"
    });

  } catch (error) {
    console.error("Verify OTP error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};

/* ─────────────────────────────────────────────
   RESET PASSWORD — Step 3
   OTP dobara verify karo aur password badlo
   POST /api/auth/reset-password
   Body: { email, otp, password, confirmPassword }
───────────────────────────────────────────── */
export const resetPassword = async (req, res) => {
  try {
    const { email, otp, password, confirmPassword } = req.body;

    if (!email || !otp || !password) {
      return res.status(400).json({
        success: false,
        message: "Email, OTP and new password are required"
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Passwords do not match"
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters"
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await UserModel.findByEmail(normalizedEmail);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // OTP dobara verify karo (tamper protection)
    if (!user.password_reset_token || user.password_reset_token !== otp) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP"
      });
    }

    if (!user.password_reset_expires || user.password_reset_expires < new Date()) {
      return res.status(400).json({
        success: false,
        message: "OTP has expired. Please start over.",
        expired: true
      });
    }

    // Password hash karo aur save karo
    const hashedPassword = await bcrypt.hash(password, 12);
    await UserModel.updatePassword(user.id, hashedPassword);

    // OTP clear karo
    await UserModel.clearPasswordResetOtp(user.id);

    res.json({
      success: true,
      message: "Password reset successfully. You can now login."
    });

  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};