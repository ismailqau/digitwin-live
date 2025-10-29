import { Router, type Router as RouterType } from 'express';
import { param } from 'express-validator';
import {
  getDocuments,
  getDocumentById,
  uploadDocument,
  deleteDocument
} from '../../controllers/documents.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requirePermission, requireSubscriptionTier } from '../../middleware/rbac.middleware';
import { validate } from '../../middleware/validation.middleware';
import { uploadLimiter } from '../../middleware/rateLimit.middleware';

const router: RouterType = Router();

// All document routes require authentication
router.use(authMiddleware);

// Read operations - available to all authenticated users
router.get('/', requirePermission('knowledge:read'), getDocuments);

router.get(
  '/:id',
  validate([param('id').isUUID()]),
  requirePermission('knowledge:read'),
  getDocumentById
);

// Write operations - require pro tier or higher
router.post(
  '/', 
  uploadLimiter, 
  requirePermission('knowledge:write'),
  requireSubscriptionTier('pro'),
  uploadDocument
);

router.delete(
  '/:id',
  validate([param('id').isUUID()]),
  requirePermission('knowledge:write'),
  deleteDocument
);

export default router;
