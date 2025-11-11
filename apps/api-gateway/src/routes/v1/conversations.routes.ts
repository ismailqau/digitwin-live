import { Router, type Router as ExpressRouter } from 'express';
import { param } from 'express-validator';

import {
  getTurnSources,
  getConversationSession,
  getKnowledgeBaseAnalytics,
} from '../../controllers/conversations.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/rbac.middleware';
import { validate } from '../../middleware/validation.middleware';

const router: ExpressRouter = Router();

/**
 * @swagger
 * tags:
 *   name: Conversations
 *   description: Conversation management and source tracking
 */

// Get source information for a conversation turn
router.get(
  '/:sessionId/turns/:turnId/sources',
  authMiddleware,
  requirePermission('conversation:read'),
  validate([
    param('sessionId').isUUID().withMessage('Session ID must be a valid UUID'),
    param('turnId').isUUID().withMessage('Turn ID must be a valid UUID'),
  ]),
  getTurnSources
);

// Get knowledge base analytics
router.get(
  '/analytics',
  authMiddleware,
  requirePermission('conversation:read'),
  getKnowledgeBaseAnalytics
);

// Get conversation session details
router.get(
  '/:sessionId',
  authMiddleware,
  requirePermission('conversation:read'),
  validate([param('sessionId').isUUID().withMessage('Session ID must be a valid UUID')]),
  getConversationSession
);

export default router;
