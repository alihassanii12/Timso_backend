// src/models/userModel.js
import { query } from '../config/db.js';

class UserModel {

  // ✅ Fixed: tagged-template syntax
  static async findByEmail(email) {
    const result = await query`SELECT * FROM users WHERE email = ${email}`;
    return result.rows[0];
  }

  static async findByUsername(username) {
    const result = await query`SELECT * FROM users WHERE username = ${username}`;
    return result.rows[0];
  }

  static async findByEmailOrUsername(identifier) {
    const result = await query`
      SELECT * FROM users WHERE email = ${identifier} OR username = ${identifier}
    `;
    return result.rows[0];
  }

  static async findById(id) {
    const result = await query`
      SELECT id, email, username, full_name, email_verified, role,
             profile_picture, created_at, last_login, company_id
      FROM users WHERE id = ${id}
    `;
    return result.rows[0];
  }

  static async create(userData) {
    const {
      email, username, password, fullName,
      emailVerificationToken, emailVerificationExpires,
      role = 'user'
    } = userData;

    const result = await query`
      INSERT INTO users (
        email, username, password, full_name,
        email_verification_token, email_verification_expires,
        role, created_at, updated_at
      )
      VALUES (
        ${email}, ${username}, ${password}, ${fullName || null},
        ${emailVerificationToken}, ${emailVerificationExpires},
        ${role}, NOW(), NOW()
      )
      RETURNING id, email, username, full_name, role, created_at
    `;
    return result.rows[0];
  }

  static async updateRefreshToken(userId, refreshToken) {
    await query`
      UPDATE users SET refresh_token = ${refreshToken} WHERE id = ${userId}
    `;
  }

  static async findByRefreshToken(refreshToken) {
    const result = await query`
      SELECT * FROM users WHERE refresh_token = ${refreshToken}
    `;
    return result.rows[0];
  }

  static async handleFailedLogin(identifier, ip, userAgent) {
    const user = await this.findByEmailOrUsername(identifier);
    if (user) {
      const newAttempts = (user.failed_login_attempts || 0) + 1;
      const lockedUntil = newAttempts >= 5
        ? new Date(Date.now() + 15 * 60 * 1000)
        : null;
      
      await query`
        UPDATE users
        SET failed_login_attempts = ${newAttempts}, 
            locked_until = ${lockedUntil}, 
            last_failed_login = NOW()
        WHERE id = ${user.id}
      `;
    }
    
    await query`
      INSERT INTO login_history (user_id, ip_address, user_agent, success)
      VALUES (${user?.id || null}, ${ip}, ${userAgent}, false)
    `;
  }

  static async resetFailedAttempts(userId) {
    await query`
      UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = ${userId}
    `;
  }

  static async updateLastLogin(userId, ip, userAgent) {
    await query`
      UPDATE users SET last_login = NOW() WHERE id = ${userId}
    `;
    
    await query`
      INSERT INTO login_history (user_id, ip_address, user_agent, success)
      VALUES (${userId}, ${ip}, ${userAgent}, true)
    `;
  }

  static async getProfile(userId) {
    const result = await query`
      SELECT id, email, username, full_name, email_verified, role,
             profile_picture, created_at, last_login, company_id,
             bio, skills, experience, location, phone_number, cv_url
      FROM users WHERE id = ${userId}
    `;
    return result.rows[0];
  }

  static async updatePassword(userId, hashedPassword) {
    await query`
      UPDATE users SET password = ${hashedPassword} WHERE id = ${userId}
    `;
  }

  /* ─────────────────────────────────────────────
     EMAIL VERIFICATION — OTP based
  ───────────────────────────────────────────── */

  static async verifyEmail(userId) {
    const result = await query`
      UPDATE users
      SET email_verified = TRUE,
          email_verification_token = NULL,
          email_verification_expires = NULL
      WHERE id = ${userId}
      RETURNING id, email, username, role
    `;
    return result.rows[0];
  }

  static async updateEmailVerificationToken(userId, otp, expires) {
    const result = await query`
      UPDATE users
      SET email_verification_token = ${otp},
          email_verification_expires = ${expires}
      WHERE id = ${userId}
      RETURNING id
    `;
    return result.rows[0];
  }

  /* ─────────────────────────────────────────────
     FORGOT PASSWORD — OTP based
  ───────────────────────────────────────────── */

  static async savePasswordResetOtp(userId, otp, expires) {
    const result = await query`
      UPDATE users
      SET password_reset_token = ${otp},
          password_reset_expires = ${expires}
      WHERE id = ${userId}
      RETURNING id
    `;
    return result.rows[0];
  }

  static async clearPasswordResetOtp(userId) {
    const result = await query`
      UPDATE users
      SET password_reset_token = NULL,
          password_reset_expires = NULL
      WHERE id = ${userId}
      RETURNING id
    `;
    return result.rows[0];
  }

  /* ─────────────────────────────────────────────
     MISC
  ───────────────────────────────────────────── */

  static async isTokenBlacklisted(token) {
    const result = await query`
      SELECT * FROM blacklisted_tokens WHERE token = ${token}
    `;
    return result.rows.length > 0;
  }

  static async getAllUsers(page = 1, limit = 10) {
    const offset = (page - 1) * limit;
    const result = await query`
      SELECT id, email, username, full_name, email_verified, role,
             profile_picture, created_at, last_login, is_active
      FROM users ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}
    `;
    
    const countResult = await query`SELECT COUNT(*) FROM users`;
    
    return {
      users: result.rows,
      total: parseInt(countResult.rows[0].count),
      page,
      limit
    };
  }

  static async updateUserRole(userId, newRole) {
    const result = await query`
      UPDATE users SET role = ${newRole} 
      WHERE id = ${userId} 
      RETURNING id, email, username, role
    `;
    return result.rows[0];
  }

  static async toggleUserStatus(userId, isActive) {
    const result = await query`
      UPDATE users SET is_active = ${isActive} 
      WHERE id = ${userId} 
      RETURNING id, email, is_active
    `;
    return result.rows[0];
  }

  static async deleteUser(userId) {
    const result = await query`
      DELETE FROM users WHERE id = ${userId} RETURNING id
    `;
    return result.rows[0];
  }

  static async getUsersByRole(role) {
    const result = await query`
      SELECT id, email, username, full_name, role, profile_picture, created_at
      FROM users WHERE role = ${role} ORDER BY created_at DESC
    `;
    return result.rows;
  }
}

export default UserModel;