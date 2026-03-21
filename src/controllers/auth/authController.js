// src/controllers/auth/authController.js
import bcrypt from "bcryptjs";
import validator from 'validator';
import crypto from 'crypto';
import UserModel from "../../models/userModel.js";
import { 
  generateAccessToken, 
  generateRefreshToken 
} from "../../utils/tokenUtils.js";
import { sendVerificationEmail, sendPasswordResetEmail } from "../../utils/emailService.js";

const generateOTP = () => {
  return crypto.randomInt(100000, 999999).toString();
};

/* ─────────────────────────────────────────────
   COOKIE OPTIONS — cross-origin fix
───────────────────────────────────────────── */
const getAccessTokenCookieOptions = () => ({
  httpOnly: false,   // frontend JS read kar sake localStorage fallback ke liye
  secure: true,      // SameSite=none ke liye secure zaroori hai
  sameSite: 'none',  // cross-origin (frontend alag domain) ke liye
  maxAge: 7 * 24 * 60 * 60 * 1000, // 15 minutes
  path: '/'
});

const getRefreshTokenCookieOptions = () => ({
  httpOnly: true,
  secure: true,
  sameSite: 'none',  // cross-origin ke liye
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  path: '/'          // ✅ path '/' — cross-origin mein restricted path kaam nahi karta
});

/* ─────────────────────────────────────────────
   REGISTER
───────────────────────────────────────────── */
export const register = async (req, res) => {
  try {
    const { email, username, password, fullName, role } = req.body;

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
    const otp = generateOTP();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

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

    await sendVerificationEmail(normalizedEmail, otp, fullName || username);

    const accessToken = generateAccessToken(newUser);
    const refreshToken = generateRefreshToken();
    await UserModel.updateRefreshToken(newUser.id, refreshToken);

    // ✅ cross-origin cookie options
    res.cookie('refreshToken', refreshToken, getRefreshTokenCookieOptions());
    res.cookie('accessToken', accessToken, getAccessTokenCookieOptions());

    res.status(201).json({
      success: true,
      message: "Registered successfully. OTP sent to your email.",
      user: {
        id: newUser.id,
        email: newUser.email,
        username: newUser.username,
        fullName: newUser.full_name,
        role: newUser.role,
        emailVerified: false
      },
      accessToken,
      requiresOtp: true,
    });

  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ 
      success: false,
      message: "Internal server error during registration"
    });
  }
};

/* ─────────────────────────────────────────────
   VERIFY EMAIL
───────────────────────────────────────────── */
export const verifyEmail = async (req, res) => {
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

    if (user.email_verified) {
      return res.status(400).json({
        success: false,
        message: "Email is already verified"
      });
    }

    if (user.email_verification_token !== otp) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP. Please check your email."
      });
    }

    if (!user.email_verification_expires || user.email_verification_expires < new Date()) {
      return res.status(400).json({
        success: false,
        message: "OTP has expired. Please request a new one.",
        expired: true
      });
    }

    await UserModel.verifyEmail(user.id);

    res.json({
      success: true,
      message: "Email verified successfully! You can now use your account."
    });

  } catch (error) {
    console.error("OTP verification error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};

/* ─────────────────────────────────────────────
   RESEND OTP
───────────────────────────────────────────── */
export const resendOtp = async (req, res) => {
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

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    if (user.email_verified) {
      return res.status(400).json({
        success: false,
        message: "Email is already verified"
      });
    }

    if (
      user.email_verification_expires &&
      user.email_verification_expires > new Date(Date.now() - 9 * 60 * 1000)
    ) {
      return res.status(429).json({
        success: false,
        message: "Please wait 1 minute before requesting a new OTP"
      });
    }

    const newOtp = generateOTP();
    const newExpires = new Date(Date.now() + 10 * 60 * 1000);

    await UserModel.updateEmailVerificationToken(user.id, newOtp, newExpires);
    await sendVerificationEmail(normalizedEmail, newOtp, user.full_name || user.username);

    res.json({
      success: true,
      message: "New OTP sent to your email"
    });

  } catch (error) {
    console.error("Resend OTP error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};

/* ─────────────────────────────────────────────
   LOGIN
───────────────────────────────────────────── */
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

    // ✅ cross-origin cookie options
    res.cookie('refreshToken', refreshToken, getRefreshTokenCookieOptions());
    res.cookie('accessToken', accessToken, getAccessTokenCookieOptions());

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

    // ✅ cross-origin cookie options
    res.cookie('refreshToken', newRefreshToken, getRefreshTokenCookieOptions());
    res.cookie('accessToken', newAccessToken, getAccessTokenCookieOptions());

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
    if (refreshToken && req.user) {
      await UserModel.updateRefreshToken(req.user.id, null);
    }

    res.clearCookie('accessToken', { path: '/', sameSite: 'none', secure: true });
    res.clearCookie('refreshToken', { path: '/api/auth/refresh-token', sameSite: 'none', secure: true });

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
        id: user.id,
        email: user.email,
        username: user.username,
        fullName: user.full_name,
        role: user.role,
        emailVerified: user.email_verified,
        createdAt: user.created_at,
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
   FORGOT PASSWORD
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

    if (!user) {
      return res.json({
        success: true,
        message: "If this email exists, an OTP has been sent."
      });
    }

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
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

    await UserModel.savePasswordResetOtp(user.id, otp, otpExpires);
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
   VERIFY OTP
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
   RESET PASSWORD
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

    const hashedPassword = await bcrypt.hash(password, 12);
    await UserModel.updatePassword(user.id, hashedPassword);
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