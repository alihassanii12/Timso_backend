import pool from '../config/db.js';

class UserModel {

  static async findByEmail(email) {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    return result.rows[0];
  }

  static async findByUsername(username) {
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    return result.rows[0];
  }

  static async findByEmailOrUsername(identifier) {
    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1 OR username = $1',
      [identifier]
    );
    return result.rows[0];
  }

  static async findById(id) {
    const result = await pool.query(
      `SELECT id, email, username, full_name, email_verified, role,
              profile_picture, created_at, last_login
       FROM users WHERE id = $1`,
      [id]
    );
    return result.rows[0];
  }

  static async create(userData) {
    const {
      email, username, password, fullName,
      emailVerificationToken, emailVerificationExpires,
      role = 'user'
    } = userData;

    const query = `
      INSERT INTO users (
        email, username, password, full_name,
        email_verification_token, email_verification_expires,
        role, created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      RETURNING id, email, username, full_name, role, created_at
    `;
    const result = await pool.query(query, [
      email, username, password, fullName || null,
      emailVerificationToken, emailVerificationExpires, role
    ]);
    return result.rows[0];
  }

  static async updateRefreshToken(userId, refreshToken) {
    await pool.query(
      'UPDATE users SET refresh_token = $1 WHERE id = $2',
      [refreshToken, userId]
    );
  }

  static async findByRefreshToken(refreshToken) {
    const result = await pool.query(
      'SELECT * FROM users WHERE refresh_token = $1',
      [refreshToken]
    );
    return result.rows[0];
  }

  static async handleFailedLogin(identifier, ip, userAgent) {
    const user = await this.findByEmailOrUsername(identifier);
    if (user) {
      const newAttempts = (user.failed_login_attempts || 0) + 1;
      const lockedUntil = newAttempts >= 5
        ? new Date(Date.now() + 15 * 60 * 1000)
        : null;
      await pool.query(
        `UPDATE users
         SET failed_login_attempts = $1, locked_until = $2, last_failed_login = NOW()
         WHERE id = $3`,
        [newAttempts, lockedUntil, user.id]
      );
    }
    await pool.query(
      `INSERT INTO login_history (user_id, ip_address, user_agent, success)
       VALUES ($1, $2, $3, $4)`,
      [user?.id || null, ip, userAgent, false]
    );
  }

  static async resetFailedAttempts(userId) {
    await pool.query(
      'UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = $1',
      [userId]
    );
  }

  static async updateLastLogin(userId, ip, userAgent) {
    await pool.query(
      'UPDATE users SET last_login = NOW() WHERE id = $1',
      [userId]
    );
    await pool.query(
      `INSERT INTO login_history (user_id, ip_address, user_agent, success)
       VALUES ($1, $2, $3, $4)`,
      [userId, ip, userAgent, true]
    );
  }

  static async getProfile(userId) {
    const result = await pool.query(
      `SELECT id, email, username, full_name, email_verified, role,
              profile_picture, created_at, last_login
       FROM users WHERE id = $1`,
      [userId]
    );
    return result.rows[0];
  }

  static async updatePassword(userId, hashedPassword) {
    await pool.query(
      'UPDATE users SET password = $1 WHERE id = $2',
      [hashedPassword, userId]
    );
  }

  /* ─────────────────────────────────────────────
     EMAIL VERIFICATION — OTP based
  ───────────────────────────────────────────── */

  // Register ke baad OTP verify karo — userId se
  static async verifyEmail(userId) {
    const result = await pool.query(
      `UPDATE users
       SET email_verified = TRUE,
           email_verification_token = NULL,
           email_verification_expires = NULL
       WHERE id = $1
       RETURNING id, email, username, role`,
      [userId]
    );
    return result.rows[0];
  }

  // Resend OTP — naya token aur expiry save karo
  static async updateEmailVerificationToken(userId, otp, expires) {
    const result = await pool.query(
      `UPDATE users
       SET email_verification_token = $1,
           email_verification_expires = $2
       WHERE id = $3
       RETURNING id`,
      [otp, expires, userId]
    );
    return result.rows[0];
  }

  /* ─────────────────────────────────────────────
     FORGOT PASSWORD — OTP based
  ───────────────────────────────────────────── */

  // Step 1: OTP generate karke DB mein save karo
  static async savePasswordResetOtp(userId, otp, expires) {
    const result = await pool.query(
      `UPDATE users
       SET password_reset_token = $1,
           password_reset_expires = $2
       WHERE id = $3
       RETURNING id`,
      [otp, expires, userId]
    );
    return result.rows[0];
  }

  // Step 3: Password reset ke baad OTP clear karo
  static async clearPasswordResetOtp(userId) {
    const result = await pool.query(
      `UPDATE users
       SET password_reset_token = NULL,
           password_reset_expires = NULL
       WHERE id = $1
       RETURNING id`,
      [userId]
    );
    return result.rows[0];
  }

  /* ─────────────────────────────────────────────
     MISC
  ───────────────────────────────────────────── */

  static async isTokenBlacklisted(token) {
    const result = await pool.query(
      'SELECT * FROM blacklisted_tokens WHERE token = $1',
      [token]
    );
    return result.rows.length > 0;
  }

  static async getAllUsers(page = 1, limit = 10) {
    const offset = (page - 1) * limit;
    const result = await pool.query(
      `SELECT id, email, username, full_name, email_verified, role,
              profile_picture, created_at, last_login, is_active
       FROM users ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    const countResult = await pool.query('SELECT COUNT(*) FROM users');
    return {
      users: result.rows,
      total: parseInt(countResult.rows[0].count),
      page,
      limit
    };
  }

  static async updateUserRole(userId, newRole) {
    const result = await pool.query(
      'UPDATE users SET role = $1 WHERE id = $2 RETURNING id, email, username, role',
      [newRole, userId]
    );
    return result.rows[0];
  }

  static async toggleUserStatus(userId, isActive) {
    const result = await pool.query(
      'UPDATE users SET is_active = $1 WHERE id = $2 RETURNING id, email, is_active',
      [isActive, userId]
    );
    return result.rows[0];
  }

  static async deleteUser(userId) {
    const result = await pool.query(
      'DELETE FROM users WHERE id = $1 RETURNING id',
      [userId]
    );
    return result.rows[0];
  }

  static async getUsersByRole(role) {
    const result = await pool.query(
      `SELECT id, email, username, full_name, role, profile_picture, created_at
       FROM users WHERE role = $1 ORDER BY created_at DESC`,
      [role]
    );
    return result.rows;
  }
}

export default UserModel;