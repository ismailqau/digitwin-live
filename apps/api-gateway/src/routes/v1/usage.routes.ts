import { PrismaClient } from '@prisma/client';
import { Router, Request, Response, type IRouter } from 'express';

import { getRateLimitService } from '../../services/rateLimit.service';

// Extend Express Request to include user info
interface AuthenticatedUser {
  userId: string;
  email: string;
  subscriptionTier: 'free' | 'pro' | 'enterprise';
  permissions: string[];
  roles: string[];
}

interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

const router: IRouter = Router();
const prisma = new PrismaClient();
const rateLimitService = getRateLimitService(prisma);

/**
 * GET /api/v1/usage/rate-limits
 * Get current rate limit status for the authenticated user
 */
router.get('/rate-limits', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      });
    }

    const stats = await rateLimitService.getUserRateLimitStats(req.user.userId);

    return res.json({
      data: stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching rate limit stats:', error);
    return res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch rate limit statistics',
      },
    });
  }
});

/**
 * GET /api/v1/usage/conversation-time
 * Get conversation time usage for the current day
 */
router.get('/conversation-time', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
    });

    if (!user) {
      return res.status(404).json({
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found',
        },
      });
    }

    const tierConfig = {
      free: 60,
      pro: Number.MAX_SAFE_INTEGER,
      enterprise: Number.MAX_SAFE_INTEGER,
    };

    const dailyLimit = tierConfig[user.subscriptionTier as 'free' | 'pro' | 'enterprise'];
    const minutesUsed = user.conversationMinutesUsed;
    const minutesRemaining = Math.max(0, dailyLimit - minutesUsed);

    // Get today's midnight
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return res.json({
      data: {
        subscriptionTier: user.subscriptionTier,
        minutesUsed,
        minutesLimit: dailyLimit,
        minutesRemaining,
        percentageUsed:
          dailyLimit === Number.MAX_SAFE_INTEGER ? 0 : (minutesUsed / dailyLimit) * 100,
        resetAt: tomorrow.toISOString(),
        isUnlimited: dailyLimit === Number.MAX_SAFE_INTEGER,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching conversation time usage:', error);
    return res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch conversation time usage',
      },
    });
  }
});

/**
 * GET /api/v1/usage/summary
 * Get comprehensive usage summary for the user
 */
router.get('/summary', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
    });

    if (!user) {
      return res.status(404).json({
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found',
        },
      });
    }

    const stats = await rateLimitService.getUserRateLimitStats(req.user.userId);

    // Get conversation sessions count
    const conversationCount = await prisma.conversationSession.count({
      where: { userId: req.user.userId },
    });

    // Get documents count
    const documentCount = await prisma.knowledgeDocument.count({
      where: { userId: req.user.userId, deletedAt: null },
    });

    // Get voice models count
    const voiceModelCount = await prisma.voiceModel.count({
      where: { userId: req.user.userId, deletedAt: null },
    });

    // Get face models count
    const faceModelCount = await prisma.faceModel.count({
      where: { userId: req.user.userId, deletedAt: null },
    });

    return res.json({
      data: {
        subscription: {
          tier: user.subscriptionTier,
          conversationMinutesUsed: user.conversationMinutesUsed,
          conversationMinutesLimit: stats.conversationMinutesLimit,
          conversationMinutesRemaining: stats.conversationMinutesRemaining,
          apiRequestsPerHourLimit: stats.apiRequestsPerHourLimit,
          uploadRequestsPerMinuteLimit: stats.uploadRequestsPerMinuteLimit,
          searchRequestsPerMinuteLimit: stats.searchRequestsPerMinuteLimit,
        },
        usage: {
          conversationSessions: conversationCount,
          documents: documentCount,
          voiceModels: voiceModelCount,
          faceModels: faceModelCount,
        },
        resetAt: stats.resetAt.toISOString(),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching usage summary:', error);
    return res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch usage summary',
      },
    });
  }
});

export default router;
