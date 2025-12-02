import { PrismaClient } from '@prisma/client';
import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';

import { getRateLimitService } from '../services/rateLimit.service';

// Extend Express Request to include user info
interface AuthenticatedUser {
  userId: string;
  email: string;
  subscriptionTier: 'free' | 'pro' | 'enterprise';
  permissions: string[];
  roles: string[];
}

// Custom Request type with user property
interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

// Initialize Prisma client
const prisma = new PrismaClient();
const rateLimitService = getRateLimitService(prisma);

/**
 * User-based rate limiting middleware
 * Checks rate limits based on subscription tier
 */
export const userRateLimitMiddleware = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Skip rate limiting for unauthenticated requests (they'll be handled by IP-based limiter)
    if (!req.user) {
      return next();
    }

    const endpoint = req.path;
    const result = await rateLimitService.checkRateLimit(
      req.user.userId,
      endpoint,
      req.user.subscriptionTier
    );

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', result.remaining);
    res.setHeader('X-RateLimit-Remaining', result.remaining);
    res.setHeader('X-RateLimit-Reset', result.resetAt.toISOString());

    if (!result.allowed) {
      res.setHeader('Retry-After', result.retryAfter || 60);

      res.status(429).json({
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'You have exceeded your rate limit',
          details: {
            retryAfter: result.retryAfter,
            resetAt: result.resetAt.toISOString(),
            subscriptionTier: req.user.subscriptionTier,
            upgradeUrl: 'https://example.com/upgrade',
          },
        },
      });
      return;
    }

    next();
  } catch (error) {
    console.error('Rate limit check error:', error);
    // On error, allow the request to proceed
    next();
  }
};

/**
 * Conversation time limit middleware
 * Checks if user has exceeded their daily conversation time limit
 */
export const conversationTimeLimitMiddleware = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      return next();
    }

    // Only check for conversation endpoints
    if (!req.path.includes('/conversations')) {
      return next();
    }

    // Get estimated conversation duration from request (default to 10 minutes)
    const estimatedMinutes = (req.body?.estimatedDurationMinutes as number) || 10;

    const result = await rateLimitService.checkConversationTimeLimit(
      req.user.userId,
      req.user.subscriptionTier,
      estimatedMinutes
    );

    if (!result.allowed) {
      res.setHeader('Retry-After', result.retryAfter || 3600);

      res.status(429).json({
        error: {
          code: 'CONVERSATION_TIME_LIMIT_EXCEEDED',
          message: 'You have exceeded your daily conversation time limit',
          details: {
            minutesUsed: result.remaining,
            minutesLimit: result.remaining,
            retryAfter: result.retryAfter,
            resetAt: result.resetAt.toISOString(),
            subscriptionTier: req.user.subscriptionTier,
            upgradeUrl: 'https://example.com/upgrade',
          },
        },
      });
      return;
    }

    // Store the estimated minutes in the request for later use
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (req as any).estimatedConversationMinutes = estimatedMinutes;

    next();
  } catch (error) {
    console.error('Conversation time limit check error:', error);
    next();
  }
};

// General API rate limiter (IP-based fallback)
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests from this IP, please try again later',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req: AuthenticatedRequest) => {
    // Skip IP-based limiting if user is authenticated (use user-based limiting instead)
    return !!req.user;
  },
});

// Strict rate limiter for auth endpoints
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5, // Limit each IP to 5 requests per windowMs
  message: {
    error: {
      code: 'AUTH_RATE_LIMIT_EXCEEDED',
      message: 'Too many authentication attempts, please try again later',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Upload rate limiter
export const uploadLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // Limit each IP to 10 uploads per minute
  message: {
    error: {
      code: 'UPLOAD_RATE_LIMIT_EXCEEDED',
      message: 'Too many uploads, please try again later',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req: AuthenticatedRequest) => {
    // Skip IP-based limiting if user is authenticated
    return !!req.user;
  },
});

// Batch upload rate limiter
export const batchUploadLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 2, // Limit each IP to 2 batch uploads per minute
  message: {
    error: {
      code: 'BATCH_UPLOAD_RATE_LIMIT_EXCEEDED',
      message: 'Too many batch uploads, please try again later',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req: AuthenticatedRequest) => {
    // Skip IP-based limiting if user is authenticated
    return !!req.user;
  },
});

// Search rate limiter
export const searchLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // Limit each IP to 30 searches per minute
  message: {
    error: {
      code: 'SEARCH_RATE_LIMIT_EXCEEDED',
      message: 'Too many search requests, please try again later',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req: AuthenticatedRequest) => {
    // Skip IP-based limiting if user is authenticated
    return !!req.user;
  },
});
