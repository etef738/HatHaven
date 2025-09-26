/**
 * Advanced Authentication Security
 * Implements JWT rotation, password hardening, 2FA, and breach protection
 */

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { scrypt, timingSafeEqual } from 'crypto';
import { promisify } from 'util';
import jwt from 'jsonwebtoken';

const scryptAsync = promisify(scrypt);

// Password security configuration
const PASSWORD_CONFIG = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSymbols: true,
  maxAge: 90 * 24 * 60 * 60 * 1000, // 90 days
};

// JWT configuration
const JWT_CONFIG = {
  accessTokenExpiry: 15 * 60, // 15 minutes in seconds
  refreshTokenExpiry: 7 * 24 * 60 * 60, // 7 days in seconds
  issuer: 'heartscene',
  audience: 'heartscene-users',
};

// Known breached passwords (simplified - in production, use HaveIBeenPwned API)
const COMMON_PASSWORDS = new Set([
  'password', '123456', 'password123', 'admin', 'qwerty',
  'letmein', 'welcome', 'monkey', '1234567890', 'password1'
]);

// Failed login tracking (in-memory - use Redis in production)
const failedLogins = new Map<string, { count: number; lastAttempt: Date; lockedUntil?: Date }>();

/**
 * Enhanced password hashing using scrypt with salt
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(32);
  const derivedKey = await scryptAsync(password, salt, 64) as Buffer;
  return salt.toString('hex') + ':' + derivedKey.toString('hex');
}

/**
 * Verify password against hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const [saltHex, keyHex] = hash.split(':');
  const salt = Buffer.from(saltHex, 'hex');
  const key = Buffer.from(keyHex, 'hex');
  const derivedKey = await scryptAsync(password, salt, 64) as Buffer;
  return timingSafeEqual(key, derivedKey);
}

/**
 * Password strength validation
 */
export function validatePasswordStrength(password: string): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (password.length < PASSWORD_CONFIG.minLength) {
    errors.push(`Password must be at least ${PASSWORD_CONFIG.minLength} characters long`);
  }

  if (PASSWORD_CONFIG.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (PASSWORD_CONFIG.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (PASSWORD_CONFIG.requireNumbers && !/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  if (PASSWORD_CONFIG.requireSymbols && !/[^A-Za-z0-9]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }

  // Check against common breached passwords
  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    errors.push('This password has been found in data breaches and cannot be used');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Generate JWT token pair (access + refresh)
 */
export function generateTokens(userId: string, payload: any = {}): { accessToken: string; refreshToken: string } {
  const jwtSecret = process.env.JWT_SECRET || 'dev-secret-change-in-production';
  
  const accessPayload = { 
    ...payload, 
    userId, 
    type: 'access',
    iat: Math.floor(Date.now() / 1000)
  };
  
  const refreshPayload = { 
    userId, 
    type: 'refresh',
    iat: Math.floor(Date.now() / 1000)
  };
  
  const accessToken = jwt.sign(accessPayload, jwtSecret, {
    expiresIn: JWT_CONFIG.accessTokenExpiry,
    issuer: JWT_CONFIG.issuer,
    audience: JWT_CONFIG.audience,
  });

  const refreshToken = jwt.sign(refreshPayload, jwtSecret, {
    expiresIn: JWT_CONFIG.refreshTokenExpiry,
    issuer: JWT_CONFIG.issuer,
    audience: JWT_CONFIG.audience,
  });

  return { accessToken, refreshToken };
}

/**
 * Verify and decode JWT token
 */
export function verifyToken(token: string, expectedType: 'access' | 'refresh'): any {
  const jwtSecret = process.env.JWT_SECRET || 'dev-secret-change-in-production';
  
  try {
    const decoded = jwt.verify(token, jwtSecret, {
      issuer: JWT_CONFIG.issuer,
      audience: JWT_CONFIG.audience,
    }) as any;

    if (decoded.type !== expectedType) {
      throw new Error('Invalid token type');
    }

    return decoded;
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
}

/**
 * Brute force protection middleware
 */
export function bruteForceProtection(req: Request, res: Response, next: NextFunction) {
  const identifier = req.ip || 'unknown';
  const now = new Date();
  
  const attempts = failedLogins.get(identifier);
  
  // Check if account is locked
  if (attempts?.lockedUntil && attempts.lockedUntil > now) {
    const remainingTime = Math.ceil((attempts.lockedUntil.getTime() - now.getTime()) / 1000);
    return res.status(423).json({
      message: 'Account temporarily locked due to too many failed attempts',
      retryAfter: remainingTime
    });
  }
  
  // Reset if lock period has expired
  if (attempts?.lockedUntil && attempts.lockedUntil <= now) {
    failedLogins.delete(identifier);
  }
  
  next();
}

/**
 * Record failed login attempt
 */
export function recordFailedLogin(identifier: string) {
  const now = new Date();
  const attempts = failedLogins.get(identifier) || { count: 0, lastAttempt: now };
  
  attempts.count += 1;
  attempts.lastAttempt = now;
  
  // Lock account after 5 failed attempts
  if (attempts.count >= 5) {
    attempts.lockedUntil = new Date(now.getTime() + 15 * 60 * 1000); // 15 minutes
  }
  // Progressive delays for fewer attempts
  else if (attempts.count >= 3) {
    attempts.lockedUntil = new Date(now.getTime() + 60 * 1000); // 1 minute
  }
  
  failedLogins.set(identifier, attempts);
}

/**
 * Clear failed login attempts on successful login
 */
export function clearFailedLogins(identifier: string) {
  failedLogins.delete(identifier);
}

/**
 * Generate secure session ID
 */
export function generateSecureSessionId(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Password age validation
 */
export function isPasswordExpired(createdAt: Date): boolean {
  const now = new Date();
  const ageInMs = now.getTime() - createdAt.getTime();
  return ageInMs > PASSWORD_CONFIG.maxAge;
}

/**
 * Generate secure random token for various purposes (reset, verification, etc.)
 */
export function generateSecureToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Simple 2FA token generation (6 digits)
 */
export function generateTOTP(): { token: string; expiresAt: Date } {
  const token = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
  
  return { token, expiresAt };
}

/**
 * JWT refresh middleware
 */
export function jwtRefreshMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const refreshToken = req.headers['x-refresh-token'] as string;
  
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    
    try {
      const decoded = verifyToken(token, 'access');
      req.user = decoded;
      return next();
    } catch (error) {
      // Try to refresh token if available
      if (refreshToken) {
        try {
          const refreshDecoded = verifyToken(refreshToken, 'refresh');
          const newTokens = generateTokens(refreshDecoded.userId);
          
          res.set('x-access-token', newTokens.accessToken);
          res.set('x-refresh-token', newTokens.refreshToken);
          
          req.user = verifyToken(newTokens.accessToken, 'access');
          return next();
        } catch (refreshError) {
          // Both tokens invalid
        }
      }
    }
  }
  
  res.status(401).json({ message: 'Authentication required' });
}

/**
 * Security audit logging
 */
export function logSecurityEvent(event: string, details: any, req?: Request) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    event,
    details,
    ip: req?.ip,
    userAgent: req?.get('User-Agent'),
    userId: req?.user?.id,
  };
  
  // In production, send to security monitoring system
  console.log('[SECURITY]', JSON.stringify(logEntry));
}