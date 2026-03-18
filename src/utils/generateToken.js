import { generateAccessToken, generateRefreshToken } from './tokenUtils.js';

export const generateToken = (user) => {
  return generateAccessToken(user);
};

export const generateTokens = (user) => {
  const accessToken = generateAccessToken(user);
  const refreshTokens = generateRefreshToken(user);
  
  return {
    accessToken,
    refreshToken: refreshTokens.refreshToken,
    jwtRefreshToken: refreshTokens.jwtRefreshToken
  };
};