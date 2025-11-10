import { Router, type Router as RouterType } from 'express';
import { param } from 'express-validator';
import multer from 'multer';

import {
  deleteDocument,
  getDocumentById,
  getDocuments,
  getDocumentStatus,
  uploadDocument,
} from '../../controllers/documents.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { uploadLimiter } from '../../middleware/rateLimit.middleware';
import { requirePermission, requireSubscriptionTier } from '../../middleware/rbac.middleware';
import { validate } from '../../middleware/validation.middleware';

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
  },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'text/plain',
      'text/html',
      'text/markdown',
      'text/x-markdown',
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}`));
    }
  },
});

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
  upload.single('file'),
  uploadDocument
);

router.delete(
  '/:id',
  validate([param('id').isUUID()]),
  requirePermission('knowledge:write'),
  deleteDocument
);

// Get document processing status
router.get(
  '/:id/status',
  validate([param('id').isUUID()]),
  requirePermission('knowledge:read'),
  getDocumentStatus
);

export default router;
