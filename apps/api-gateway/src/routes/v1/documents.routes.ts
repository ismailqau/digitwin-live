import { Router, type Router as RouterType } from 'express';
import { body, param, query } from 'express-validator';
import multer from 'multer';

import {
  bulkDeleteDocuments,
  bulkReindexDocuments,
  deleteDocument,
  getDocumentById,
  getDocumentChunks,
  getDocumentContent,
  getDocuments,
  getDocumentStatistics,
  getDocumentStatus,
  getStorageUsage,
  reindexDocument,
  searchDocuments,
  updateDocument,
  updateDocumentStatus,
  uploadDocument,
  batchUploadDocuments,
} from '../../controllers/documents.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import {
  batchUploadLimiter,
  uploadLimiter,
  searchLimiter,
} from '../../middleware/rateLimit.middleware';
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

// Document search and filtering
router.get(
  '/search',
  searchLimiter,
  validate([
    query('q').optional().isString(),
    query('status').optional().isIn(['pending', 'processing', 'completed', 'failed']),
    query('fileType').optional().isString(),
    query('dateFrom').optional().isISO8601(),
    query('dateTo').optional().isISO8601(),
    query('sortBy')
      .optional()
      .isIn(['uploadedAt', 'processedAt', 'filename', 'sizeBytes', 'relevance']),
    query('order').optional().isIn(['asc', 'desc']),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
  ]),
  requirePermission('knowledge:read'),
  searchDocuments
);

// Document statistics
router.get('/stats', requirePermission('knowledge:read'), getDocumentStatistics);

router.get('/stats/usage', requirePermission('knowledge:read'), getStorageUsage);

// Bulk operations
router.post(
  '/bulk-delete',
  validate([body('documentIds').isArray({ min: 1 }), body('documentIds.*').isUUID()]),
  requirePermission('knowledge:write'),
  bulkDeleteDocuments
);

router.post(
  '/bulk-reindex',
  validate([body('documentIds').isArray({ min: 1 }), body('documentIds.*').isUUID()]),
  requirePermission('knowledge:write'),
  bulkReindexDocuments
);

// Batch upload
router.post(
  '/batch',
  batchUploadLimiter,
  requirePermission('knowledge:write'),
  requireSubscriptionTier('pro'),
  upload.array('files', 10),
  batchUploadDocuments
);

// List documents with pagination and filtering
router.get(
  '/',
  validate([
    query('q').optional().isString(),
    query('status').optional().isIn(['pending', 'processing', 'completed', 'failed']),
    query('fileType').optional().isString(),
    query('dateFrom').optional().isISO8601(),
    query('dateTo').optional().isISO8601(),
    query('sortBy').optional().isIn(['uploadedAt', 'processedAt', 'filename', 'sizeBytes']),
    query('order').optional().isIn(['asc', 'desc']),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
  ]),
  requirePermission('knowledge:read'),
  getDocuments
);

// Upload document
router.post(
  '/',
  uploadLimiter,
  requirePermission('knowledge:write'),
  requireSubscriptionTier('pro'),
  upload.single('file'),
  uploadDocument
);

// Get document by ID
router.get(
  '/:id',
  validate([param('id').isUUID()]),
  requirePermission('knowledge:read'),
  getDocumentById
);

// Get document content
router.get(
  '/:id/content',
  validate([param('id').isUUID()]),
  requirePermission('knowledge:read'),
  getDocumentContent
);

// Get document chunks (for debugging)
router.get(
  '/:id/chunks',
  validate([param('id').isUUID()]),
  requirePermission('knowledge:read'),
  getDocumentChunks
);

// Update document metadata
router.put(
  '/:id',
  validate([
    param('id').isUUID(),
    body('title').optional().isString().isLength({ min: 1, max: 255 }),
    body('tags').optional().isArray(),
    body('tags.*').isString(),
    body('sourceUrl')
      .optional()
      .custom((value) => {
        if (value === '' || !value) return true;
        return /^https?:\/\/.+/.test(value);
      }),
  ]),
  requirePermission('knowledge:write'),
  updateDocument
);

// Update document status
router.patch(
  '/:id/status',
  validate([
    param('id').isUUID(),
    body('status').isIn(['pending', 'processing', 'completed', 'failed']),
  ]),
  requirePermission('knowledge:write'),
  updateDocumentStatus
);

// Delete document
router.delete(
  '/:id',
  validate([param('id').isUUID()]),
  requirePermission('knowledge:write'),
  deleteDocument
);

// Reindex document
router.post(
  '/:id/reindex',
  validate([param('id').isUUID()]),
  requirePermission('knowledge:write'),
  reindexDocument
);

// Get document processing status
router.get(
  '/:id/processing-status',
  validate([param('id').isUUID()]),
  requirePermission('knowledge:read'),
  getDocumentStatus
);

export default router;
