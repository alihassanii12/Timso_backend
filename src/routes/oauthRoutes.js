import express from 'express';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as GitHubStrategy } from 'passport-github2';
import { raw } from '../config/db.js';
import { generateAccessToken, generateRefreshToken } from '../utils/tokenUtils.js';

const router = express.Router();

const FRONTEND = process.env.FRONTEND_URL || 'https://timeso.vercel.app';
const API_BASE = process.env.API_BASE_URL || 'https://timso-backend-n5w1.vercel.app';

// ── Helper: find or create OAuth user ──────────────────────────────────────
async function findOrCreateOAuthUser({ provider, providerId, email, name, avatar }) {
  // 1. Check if user exists by provider id
  let result = await raw(
    `SELECT * FROM users WHERE oauth_provider = $1 AND oauth_provider_id = $2`,
    [provider, providerId]
  );
  if (result.rows[0]) return { user: result.rows[0], isNew: false };

  // 2. Check by email
  if (email) {
    result = await raw(`SELECT * FROM users WHERE email = $1`, [email]);
    if (result.rows[0]) {
      // Link provider to existing account
      await raw(
        `UPDATE users SET oauth_provider=$1, oauth_provider_id=$2, profile_picture=COALESCE(profile_picture,$3), updated_at=NOW() WHERE id=$4`,
        [provider, providerId, avatar || null, result.rows[0].id]
      );
      const updated = await raw(`SELECT * FROM users WHERE id=$1`, [result.rows[0].id]);
      return { user: updated.rows[0], isNew: false };
    }
  }

  // 3. Create new user (no role yet — frontend will ask)
  const username = (email ? email.split('@')[0] : name?.replace(/\s+/g, '').toLowerCase() || 'user') + '_' + Math.random().toString(36).slice(2, 6);
  const newUser = await raw(
    `INSERT INTO users (email, username, full_name, profile_picture, oauth_provider, oauth_provider_id, email_verified, role, is_active, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, true, 'pending', true, NOW(), NOW())
     RETURNING *`,
    [email || null, username, name || username, avatar || null, provider, providerId]
  );
  return { user: newUser.rows[0], isNew: true };
}

// ── Google Strategy ─────────────────────────────────────────────────────────
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: `${API_BASE}/api/oauth/google/callback`,
  }, async (accessToken, refreshToken, profile, done) => {
    try {
      const email = profile.emails?.[0]?.value;
      const avatar = profile.photos?.[0]?.value;
      const { user, isNew } = await findOrCreateOAuthUser({
        provider: 'google', providerId: profile.id,
        email, name: profile.displayName, avatar
      });
      done(null, { user, isNew });
    } catch (err) { done(err); }
  }));
}

// ── GitHub Strategy ─────────────────────────────────────────────────────────
if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
  passport.use(new GitHubStrategy({
    clientID: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    callbackURL: `${API_BASE}/api/oauth/github/callback`,
    scope: ['user:email'],
  }, async (accessToken, refreshToken, profile, done) => {
    try {
      const email = profile.emails?.[0]?.value;
      const avatar = profile.photos?.[0]?.value;
      const { user, isNew } = await findOrCreateOAuthUser({
        provider: 'github', providerId: String(profile.id),
        email, name: profile.displayName || profile.username, avatar
      });
      done(null, { user, isNew });
    } catch (err) { done(err); }
  }));
}

passport.serializeUser((data, done) => done(null, data));
passport.deserializeUser((data, done) => done(null, data));

// ── Issue tokens and redirect ────────────────────────────────────────────────
async function issueTokensAndRedirect(req, res, data) {
  const { user, isNew } = data;

  const refreshTok = generateRefreshToken();
  await raw(`UPDATE users SET refresh_token=$1 WHERE id=$2`, [refreshTok, user.id]);

  const accessTok = generateAccessToken(user);

  // Set cookies
  const cookieOpts = { httpOnly: false, secure: true, sameSite: 'none', maxAge: 15 * 60 * 1000, path: '/' };
  const refreshOpts = { httpOnly: true, secure: true, sameSite: 'none', maxAge: 7 * 24 * 60 * 60 * 1000, path: '/' };
  res.cookie('accessToken', accessTok, cookieOpts);
  res.cookie('refreshToken', refreshTok, refreshOpts);

  // Redirect based on state
  if (user.role === 'pending' || isNew) {
    // New user — needs to pick role
    return res.redirect(`${FRONTEND}/oauth-complete?token=${encodeURIComponent(accessTok)}&new=1`);
  }
  if (user.role === 'admin') {
    return res.redirect(`${FRONTEND}/oauth-complete?token=${encodeURIComponent(accessTok)}&role=admin`);
  }
  if (user.company_id) {
    return res.redirect(`${FRONTEND}/oauth-complete?token=${encodeURIComponent(accessTok)}&role=user&has_company=1`);
  }
  return res.redirect(`${FRONTEND}/oauth-complete?token=${encodeURIComponent(accessTok)}&role=user`);
}

// ── Google routes ────────────────────────────────────────────────────────────
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'], session: false }));
router.get('/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: `${FRONTEND}/login?error=oauth` }),
  (req, res) => issueTokensAndRedirect(req, res, req.user)
);

// ── GitHub routes ────────────────────────────────────────────────────────────
router.get('/github', passport.authenticate('github', { scope: ['user:email'], session: false }));
router.get('/github/callback',
  passport.authenticate('github', { session: false, failureRedirect: `${FRONTEND}/login?error=oauth` }),
  (req, res) => issueTokensAndRedirect(req, res, req.user)
);

// ── Set role after OAuth (for new users) ────────────────────────────────────
router.post('/set-role', async (req, res) => {
  try {
    const { token, role, companyName, companyDescription } = req.body;
    if (!token || !role) return res.status(400).json({ success: false, message: 'token and role required' });

    // Verify token
    const { default: jwt } = await import('jsonwebtoken');
    let decoded;
    try { decoded = jwt.verify(token, process.env.JWT_SECRET); }
    catch { return res.status(401).json({ success: false, message: 'Invalid token' }); }

    const userRes = await raw(`SELECT * FROM users WHERE id=$1`, [decoded.id]);
    const user = userRes.rows[0];
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    if (!['admin', 'user'].includes(role)) return res.status(400).json({ success: false, message: 'Invalid role' });

    // Update role
    await raw(`UPDATE users SET role=$1, updated_at=NOW() WHERE id=$2`, [role, user.id]);

    // If admin, create company
    if (role === 'admin' && companyName) {
      const { default: CompanyModel } = await import('../models/companyModel.js');
      await CompanyModel.create({ name: companyName, adminId: user.id, description: companyDescription || '' });
    }

    const updatedRes = await raw(`SELECT * FROM users WHERE id=$1`, [user.id]);
    const updated = updatedRes.rows[0];
    const newAccessTok = generateAccessToken(updated);
    const newRefreshTok = generateRefreshToken();
    await raw(`UPDATE users SET refresh_token=$1 WHERE id=$2`, [newRefreshTok, user.id]);

    const cookieOpts = { httpOnly: false, secure: true, sameSite: 'none', maxAge: 15 * 60 * 1000, path: '/' };
    const refreshOpts = { httpOnly: true, secure: true, sameSite: 'none', maxAge: 7 * 24 * 60 * 60 * 1000, path: '/' };
    res.cookie('accessToken', newAccessTok, cookieOpts);
    res.cookie('refreshToken', newRefreshTok, refreshOpts);

    res.json({
      success: true,
      accessToken: newAccessTok,
      user: { id: updated.id, email: updated.email, username: updated.username, full_name: updated.full_name, role: updated.role, company_id: updated.company_id, profile_picture: updated.profile_picture }
    });
  } catch (err) {
    console.error('set-role error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
