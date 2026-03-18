import jwt from 'jsonwebtoken';
import crypto from 'crypto';

// Validate environment variables
const validateEnvVariables = () => {
  if (!process.env.JWT_SECRET) {
    console.error('❌ JWT_SECRET is not defined in environment variables');
    throw new Error('JWT_SECRET is not configured');
  }
  if (!process.env.REFRESH_TOKEN_SECRET) {
    console.error('❌ REFRESH_TOKEN_SECRET is not defined in environment variables');
    throw new Error('REFRESH_TOKEN_SECRET is not configured');
  }
};

// Generate access token with user role
export const generateAccessToken = (user) => {
  try {
    validateEnvVariables();

    console.log('Generating access token for user:', { id: user.id, email: user.email });

    const token = jwt.sign(
      { 
        id: user.id, 
        email: user.email,
        username: user.username,
        role: user.role || 'user'
      },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    console.log('✅ Access token generated successfully');
    return token;

  } catch (error) {
    console.error('❌ Error generating access token:', error.message);
    throw error;
  }
};

// Generate refresh token (random string, not JWT)
export const generateRefreshToken = () => {
  try {
    const token = crypto.randomBytes(40).toString('hex');
    console.log('✅ Refresh token generated successfully');
    return token;
  } catch (error) {
    console.error('❌ Error generating refresh token:', error.message);
    throw error;
  }
};

// Generate email verification token
export const generateEmailVerificationToken = () => {
  try {
    const token = crypto.randomBytes(32).toString('hex');
    console.log('✅ Email verification token generated successfully');
    return token;
  } catch (error) {
    console.error('❌ Error generating email verification token:', error.message);
    throw error;
  }
};

// Generate password reset token
export const generatePasswordResetToken = () => {
  try {
    const token = crypto.randomBytes(32).toString('hex');
    console.log('✅ Password reset token generated successfully');
    return token;
  } catch (error) {
    console.error('❌ Error generating password reset token:', error.message);
    throw error;
  }
};

// Verify access token
export const verifyAccessToken = (token) => {
  try {
    validateEnvVariables();

    console.log('Verifying access token...');
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    console.log('✅ Access token verified successfully for user:', decoded.email);
    return decoded;

  } catch (error) {
    console.error('❌ Error verifying access token:', error.message);
    
    if (error.name === 'TokenExpiredError') {
      throw new Error('Token expired');
    }
    if (error.name === 'JsonWebTokenError') {
      throw new Error('Invalid token');
    }
    throw error;
  }
};

// Verify refresh token (if using JWT for refresh tokens)
export const verifyRefreshToken = (token) => {
  try {
    validateEnvVariables();

    console.log('Verifying refresh token...');
    
    const decoded = jwt.verify(token, process.env.REFRESH_TOKEN_SECRET);
    
    console.log('✅ Refresh token verified successfully');
    return decoded;

  } catch (error) {
    console.error('❌ Error verifying refresh token:', error.message);
    
    if (error.name === 'TokenExpiredError') {
      throw new Error('Refresh token expired');
    }
    if (error.name === 'JsonWebTokenError') {
      throw new Error('Invalid refresh token');
    }
    throw error;
  }
};

// Generate tokens with custom expiration
export const generateCustomToken = (payload, expiresIn) => {
  try {
    validateEnvVariables();

    console.log('Generating custom token with expiration:', expiresIn);
    
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn });
    
    console.log('✅ Custom token generated successfully');
    return token;

  } catch (error) {
    console.error('❌ Error generating custom token:', error.message);
    throw error;
  }
};

// Decode token without verification (for debugging)
export const decodeToken = (token) => {
  try {
    const decoded = jwt.decode(token);
    console.log('✅ Token decoded successfully');
    return decoded;
  } catch (error) {
    console.error('❌ Error decoding token:', error.message);
    return null;
  }
};

// Generate both access and refresh tokens together
export const generateAuthTokens = (user) => {
  try {
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken();

    console.log('✅ Auth tokens generated successfully for user:', user.email);

    return {
      accessToken,
      refreshToken
    };
  } catch (error) {
    console.error('❌ Error generating auth tokens:', error.message);
    throw error;
  }
};