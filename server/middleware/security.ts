/**
 * Advanced Security Middleware
 * Production-ready security hardening with CSP, CORS, rate limiting, and more
 */

import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import helmet from 'helmet';
import cors from 'cors';
import crypto from 'crypto';

// Extend session data to include CSRF token
declare module 'express-session' {
  interface SessionData {
    csrfToken?: string;
  }
}

// Rate limiter response interface
interface RateLimiterResponse {
  remainingPoints?: number;
  msBeforeNext?: number;
  totalHits?: number;
}

// Create memory-based rate limiter for production-grade limits
const rateLimiter = new RateLimiterMemory({
  keyPrefix: 'rl_global',
  points: 100, // Number of requests
  duration: 60, // Per 60 seconds
  blockDuration: 60, // Block for 60 seconds if limit exceeded
});

// Voice-specific rate limiter (more restrictive due to cost)
const voiceRateLimiter = new RateLimiterMemory({
  keyPrefix: 'rl_voice',
  points: 20, // 20 voice requests
  duration: 60, // Per minute
  blockDuration: 300, // Block for 5 minutes if exceeded
});

// STT/TTS cost-aware rate limiter
const sttTtsRateLimiter = new RateLimiterMemory({
  keyPrefix: 'rl_stt_tts',
  points: 50, // 50 STT/TTS requests
  duration: 60, // Per minute
  blockDuration: 120, // Block for 2 minutes
});

/**
 * Content Security Policy configuration
 */
export function setupCSP() {
  return helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "blob:", "https:"],
        scriptSrc: ["'self'", ...(process.env.NODE_ENV === 'development' ? ["'unsafe-inline'", "'unsafe-eval'"] : [])],
        connectSrc: ["'self'", "https://api.openai.com"],
        mediaSrc: ["'self'", "blob:"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        frameAncestors: ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true,
    },
    noSniff: true,
    frameguard: { action: 'deny' },
    xssFilter: true,
  });
}

/**
 * CORS configuration for production
 */
export function setupCORS() {
  // Allow all origins in development, restrict in production
  if (process.env.NODE_ENV === 'development') {
    return cors({
      origin: true,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'x-csrf-token'],
      exposedHeaders: ['x-csrf-token'],
    });
  }

  const allowedOrigins = [
    'https://*.replit.app',
    'https://*.repl.co',
    process.env.FRONTEND_URL,
  ].filter(Boolean);

  return cors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      // Allow requests with no origin (mobile apps, etc.)
      if (!origin) return callback(null, true);
      
      // Check against allowed origins
      const isAllowed = allowedOrigins.some((allowed: string | undefined) => {
        if (allowed && allowed.includes('*')) {
          const pattern = allowed.replace('*', '.*');
          return new RegExp(pattern).test(origin);
        }
        return allowed === origin;
      });
      
      callback(isAllowed ? null : new Error('Not allowed by CORS'), isAllowed);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-csrf-token'],
    exposedHeaders: ['x-csrf-token'],
  });
}

/**
 * Global rate limiting middleware
 */
export async function globalRateLimit(req: Request, res: Response, next: NextFunction) {
  try {
    const key = req.ip || 'unknown';
    await rateLimiter.consume(key);
    next();
  } catch (rateLimiterRes) {
    const response = rateLimiterRes as RateLimiterResponse;
    const remainingPoints = response?.remainingPoints || 0;
    const msBeforeNext = response?.msBeforeNext || 60000;
    
    res.set('Retry-After', Math.round(msBeforeNext / 1000).toString());
    res.set('X-RateLimit-Limit', '100');
    res.set('X-RateLimit-Remaining', remainingPoints.toString());
    res.status(429).json({ 
      message: 'Too many requests, please try again later.',
      retryAfter: Math.round(msBeforeNext / 1000)
    });
  }
}

/**
 * Voice-specific rate limiting (more restrictive)
 */
export async function voiceRateLimit(req: Request, res: Response, next: NextFunction) {
  try {
    const key = `voice_${req.ip}_${req.user?.id || 'anonymous'}`;
    await voiceRateLimiter.consume(key);
    next();
  } catch (rateLimiterRes) {
    const response = rateLimiterRes as RateLimiterResponse;
    const remainingPoints = response?.remainingPoints || 0;
    const msBeforeNext = response?.msBeforeNext || 300000;
    
    res.set('Retry-After', Math.round(msBeforeNext / 1000).toString());
    res.set('X-RateLimit-Limit', '20');
    res.set('X-RateLimit-Remaining', remainingPoints.toString());
    res.status(429).json({ 
      message: 'Voice rate limit exceeded. Please wait before making more voice requests.',
      retryAfter: Math.round(msBeforeNext / 1000)
    });
  }
}

/**
 * STT/TTS rate limiting for cost control
 */
export async function sttTtsRateLimit(req: Request, res: Response, next: NextFunction) {
  try {
    const key = `stt_tts_${req.ip}_${req.user?.id || 'anonymous'}`;
    await sttTtsRateLimiter.consume(key);
    next();
  } catch (rateLimiterRes) {
    const response = rateLimiterRes as RateLimiterResponse;
    const remainingPoints = response?.remainingPoints || 0;
    const msBeforeNext = response?.msBeforeNext || 120000;
    
    res.set('Retry-After', Math.round(msBeforeNext / 1000).toString());
    res.set('X-RateLimit-Limit', '50');
    res.set('X-RateLimit-Remaining', remainingPoints.toString());
    res.status(429).json({ 
      message: 'STT/TTS rate limit exceeded for cost protection. Please wait.',
      retryAfter: Math.round(msBeforeNext / 1000)
    });
  }
}

/**
 * CSRF protection middleware
 */
export function csrfProtection(req: Request, res: Response, next: NextFunction) {
  // Skip CSRF for GET requests and API routes that use bearer tokens
  if (req.method === 'GET' || req.headers.authorization) {
    return next();
  }
  
  const token = req.headers['x-csrf-token'] as string;
  const sessionToken = req.session?.csrfToken;
  
  if (!token || !sessionToken || token !== sessionToken) {
    return res.status(403).json({ message: 'Invalid CSRF token' });
  }
  
  next();
}

/**
 * Generate and set CSRF token
 */
export function generateCSRFToken(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  }
  
  res.set('x-csrf-token', req.session.csrfToken);
  next();
}

/**
 * Secure session configuration
 */
export function getSecureSessionConfig() {
  return {
    name: 'sessionId',
    secret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production', // HTTPS only in production
      httpOnly: true, // Prevent XSS
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite: 'lax' as const, // CSRF protection
    },
  };
}

/**
 * Security headers middleware
 */
export function securityHeaders(req: Request, res: Response, next: NextFunction) {
  // Remove server header to prevent fingerprinting
  res.removeHeader('X-Powered-By');
  
  // Additional security headers
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(self), geolocation=()',
  });
  
  next();
}

/**
 * Request sanitization middleware
 */
export function sanitizeRequest(req: Request, res: Response, next: NextFunction) {
  // Basic input sanitization
  if (req.body) {
    sanitizeObject(req.body);
  }
  
  if (req.query) {
    sanitizeObject(req.query);
  }
  
  next();
}

function sanitizeObject(obj: any) {
  for (const key in obj) {
    if (typeof obj[key] === 'string') {
      // Remove potentially dangerous characters
      obj[key] = obj[key].replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
      obj[key] = obj[key].replace(/javascript:/gi, '');
      obj[key] = obj[key].replace(/on\w+\s*=/gi, '');
    } else if (typeof obj[key] === 'object' && obj[key] !== null) {
      sanitizeObject(obj[key]);
    }
  }
}