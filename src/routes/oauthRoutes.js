import express from 'express';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as GitHubStrategy } from 'passport-github2';
import { raw } from '../config/db.js';
import { generateAccessToken, generateRefreshToken } from '../utils/tokenUtils.js';

const router = express.Router();

// ✅ Environment variables with fallbacks
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://timso.vercel.app';
const API_BASE_URL = process.env.API_BASE_URL || 'https://timso-backend-n5w1.vercel.app';

console.log('🔧 OAuth Config:');
console.log('   FRONTEND_URL:', FRONTEND_URL);
console.log('   API_BASE_URL:', API_BASE_URL);

// ─────────────────────────────────────────────
// Helper: Find or Create OAuth User
// ─────────────────────────────────────────────
async function findOrCreateOAuthUser({ provider, providerId, email, name, avatar }) {
  // 1. Check by provider id
  let result = await raw(
    `SELECT * FROM users WHERE oauth_provider = $1 AND oauth_provider_id = $2`,
    [provider, providerId]
  );
  if (result.rows[0]) {
    console.log('✅ User found by provider id');
    return { user: result.rows[0], isNew: false };
  }

  // 2. Check by email
  if (email) {
    result = await raw(`SELECT * FROM users WHERE email = $1`, [email]);
    if (result.rows[0]) {
      console.log('✅ User found by email, linking provider');
      await raw(
        `UPDATE users SET oauth_provider=$1, oauth_provider_id=$2, profile_picture=COALESCE(profile_picture,$3), updated_at=NOW() WHERE id=$4`,
        [provider, providerId, avatar || null, result.rows[0].id]
      );
      const updated = await raw(`SELECT * FROM users WHERE id=$1`, [result.rows[0].id]);
      return { user: updated.rows[0], isNew: false };
    }
  }

  // 3. Create new user
  const username = (email ? email.split('@')[0] : name?.replace(/\s+/g, '').toLowerCase() || 'user') 
    + '_' + Math.random().toString(36).slice(2, 6);
  
  const newUser = await raw(
    `INSERT INTO users (email, username, full_name, profile_picture, oauth_provider, oauth_provider_id, email_verified, role, is_active, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, true, 'pending', true, NOW(), NOW())
     RETURNING *`,
    [email || null, username, name || username, avatar || null, provider, providerId]
  );
  console.log('✅ New user created via OAuth');
  return { user: newUser.rows[0], isNew: true };
}

// ─────────────────────────────────────────────
// Cookie Options
// ─────────────────────────────────────────────
const getAccessTokenCookieOptions = () => ({
  httpOnly: false,
  secure: true,
  sameSite: 'none',
  maxAge: 15 * 60 * 1000, // 15 minutes
  path: '/'
});

const getRefreshTokenCookieOptions = () => ({
  httpOnly: true,
  secure: true,
  sameSite: 'none',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  path: '/'
});

// ─────────────────────────────────────────────
// Issue Tokens and Redirect (FIXED VERSION)
// ─────────────────────────────────────────────
async function issueTokensAndRedirect(req, res, data) {
  const { user, isNew } = data;

  console.log('========== ISSUE TOKENS & REDIRECT ==========');
  console.log('User ID:', user.id);
  console.log('User role:', user.role);
  console.log('isNew:', isNew);
  console.log('company_id:', user.company_id);

  // Generate tokens
  const refreshToken = generateRefreshToken();
  await raw(`UPDATE users SET refresh_token=$1 WHERE id=$2`, [refreshToken, user.id]);
  
  const accessToken = generateAccessToken(user);

  // Set cookies
  res.cookie('accessToken', accessToken, getAccessTokenCookieOptions());
  res.cookie('refreshToken', refreshToken, getRefreshTokenCookieOptions());

  // Build redirect URL based on user state
  let redirectUrl;
  
  // New user OR role is still pending → needs role selection
  if (isNew || user.role === 'pending' || !user.role) {
    redirectUrl = `${FRONTEND_URL}/oauth-complete?token=${encodeURIComponent(accessToken)}&new=1`;
  } else if (user.role === 'admin') {
    // Existing admin — check if company is set up
    if (!user.company_id) {
      // Admin but no company yet → go to company setup
      redirectUrl = `${FRONTEND_URL}/oauth-complete?token=${encodeURIComponent(accessToken)}&new=1&preset=admin`;
    } else {
      redirectUrl = `${FRONTEND_URL}/oauth-complete?token=${encodeURIComponent(accessToken)}&role=admin`;
    }
  } else if (user.company_id) {
    redirectUrl = `${FRONTEND_URL}/oauth-complete?token=${encodeURIComponent(accessToken)}&role=user&has_company=1`;
  } else {
    redirectUrl = `${FRONTEND_URL}/oauth-complete?token=${encodeURIComponent(accessToken)}&role=user`;
  }

  console.log('🔀 Redirecting to:', redirectUrl);
  console.log('==============================================');
  
  // ✅ Force redirect with 302
  return res.status(302).setHeader('Location', redirectUrl).end();
}

// ─────────────────────────────────────────────
// Google Strategy
// ─────────────────────────────────────────────
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  console.log('✅ Google OAuth configured');
  
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: `${API_BASE_URL}/api/oauth/google/callback`,
    passReqToCallback: true,
  }, async (req, accessToken, refreshToken, profile, done) => {
    try {
      console.log('🔵 Google callback received for:', profile.displayName);
      const email = profile.emails?.[0]?.value;
      const avatar = profile.photos?.[0]?.value;
      const { user, isNew } = await findOrCreateOAuthUser({
        provider: 'google',
        providerId: profile.id,
        email: email,
        name: profile.displayName,
        avatar: avatar
      });
      done(null, { user, isNew });
    } catch (err) {
      console.error('Google OAuth error:', err);
      done(err);
    }
  }));
} else {
  console.log('❌ Google OAuth NOT configured - missing environment variables');
}

// ─────────────────────────────────────────────
// GitHub Strategy
// ─────────────────────────────────────────────
if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
  console.log('✅ GitHub OAuth configured');
  
  passport.use(new GitHubStrategy({
    clientID: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    callbackURL: `${API_BASE_URL}/api/oauth/github/callback`,
    scope: ['user:email'],
    passReqToCallback: true,
  }, async (req, accessToken, refreshToken, profile, done) => {
    try {
      console.log('🟣 GitHub callback received for:', profile.displayName || profile.username);
      const email = profile.emails?.[0]?.value;
      const avatar = profile.photos?.[0]?.value;
      const { user, isNew } = await findOrCreateOAuthUser({
        provider: 'github',
        providerId: String(profile.id),
        email: email,
        name: profile.displayName || profile.username,
        avatar: avatar
      });
      done(null, { user, isNew });
    } catch (err) {
      console.error('GitHub OAuth error:', err);
      done(err);
    }
  }));
} else {
  console.log('❌ GitHub OAuth NOT configured - missing environment variables');
}

// Serialize/Deserialize
passport.serializeUser((data, done) => done(null, data));
passport.deserializeUser((data, done) => done(null, data));

// ─────────────────────────────────────────────
// Google Routes
// ─────────────────────────────────────────────
router.get('/google', (req, res, next) => {
  if (!process.env.GOOGLE_CLIENT_ID) {
    return res.redirect(`${FRONTEND_URL}/login?error=google_not_configured`);
  }
  console.log('🟢 Google OAuth initiated');
  passport.authenticate('google', { 
    scope: ['profile', 'email'], 
    session: false 
  })(req, res, next);
});

router.get('/google/callback', (req, res, next) => {
  if (!process.env.GOOGLE_CLIENT_ID) {
    return res.redirect(`${FRONTEND_URL}/login?error=oauth`);
  }
  passport.authenticate('google', { 
    session: false, 
    failureRedirect: `${FRONTEND_URL}/login?error=oauth` 
  }, (err, user) => {
    if (err || !user) {
      console.error('Google OAuth failed:', err);
      return res.redirect(`${FRONTEND_URL}/login?error=oauth`);
    }
    req.user = user;
    issueTokensAndRedirect(req, res, user);
  })(req, res, next);
});

// ─────────────────────────────────────────────
// GitHub Routes
// ─────────────────────────────────────────────
router.get('/github', (req, res, next) => {
  if (!process.env.GITHUB_CLIENT_ID) {
    return res.redirect(`${FRONTEND_URL}/login?error=github_not_configured`);
  }
  console.log('🟢 GitHub OAuth initiated');
  passport.authenticate('github', { 
    scope: ['user:email'], 
    session: false 
  })(req, res, next);
});

router.get('/github/callback', (req, res, next) => {
  if (!process.env.GITHUB_CLIENT_ID) {
    return res.redirect(`${FRONTEND_URL}/login?error=oauth`);
  }
  passport.authenticate('github', { 
    session: false, 
    failureRedirect: `${FRONTEND_URL}/login?error=oauth` 
  }, (err, user) => {
    if (err || !user) {
      console.error('GitHub OAuth failed:', err);
      return res.redirect(`${FRONTEND_URL}/login?error=oauth`);
    }
    req.user = user;
    issueTokensAndRedirect(req, res, user);
  })(req, res, next);
});

// ─────────────────────────────────────────────
// Set Role After OAuth
// ─────────────────────────────────────────────
router.post('/set-role', async (req, res) => {
  try {
    const { token, role, companyName, companyDescription } = req.body;
    
    console.log('📝 Set role request:', { role, companyName });
    
    if (!token || !role) {
      return res.status(400).json({ success: false, message: 'Token and role required' });
    }

    // Verify token
    const { default: jwt } = await import('jsonwebtoken');
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ success: false, message: 'Invalid token' });
    }

    const userRes = await raw(`SELECT * FROM users WHERE id=$1`, [decoded.id]);
    const user = userRes.rows[0];
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (!['admin', 'user'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Invalid role' });
    }

    // Update role
    await raw(`UPDATE users SET role=$1, updated_at=NOW() WHERE id=$2`, [role, user.id]);

    // If admin, create company
    if (role === 'admin' && companyName) {
      const companyResult = await raw(
        `INSERT INTO companies (name, admin_id, description, created_at, updated_at)
         VALUES ($1, $2, $3, NOW(), NOW())
         RETURNING *`,
        [companyName, user.id, companyDescription || '']
      );
      
      // Update user's company_id
      await raw(`UPDATE users SET company_id=$1 WHERE id=$2`, [companyResult.rows[0].id, user.id]);
      console.log('✅ Company created:', companyName);
    }

    const updatedRes = await raw(`SELECT * FROM users WHERE id=$1`, [user.id]);
    const updated = updatedRes.rows[0];
    
    const newAccessToken = generateAccessToken(updated);
    const newRefreshToken = generateRefreshToken();
    await raw(`UPDATE users SET refresh_token=$1 WHERE id=$2`, [newRefreshToken, user.id]);

    // Set cookies
    res.cookie('accessToken', newAccessToken, getAccessTokenCookieOptions());
    res.cookie('refreshToken', newRefreshToken, getRefreshTokenCookieOptions());

    res.json({
      success: true,
      accessToken: newAccessToken,
      user: {
        id: updated.id,
        email: updated.email,
        username: updated.username,
        full_name: updated.full_name,
        role: updated.role,
        company_id: updated.company_id,
        profile_picture: updated.profile_picture
      }
    });
    
  } catch (err) {
    console.error('Set role error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;