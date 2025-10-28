import { Router, type Router as RouterType } from 'express';
import { param } from 'express-validator';
import {
  getDocuments,
  getDocumentById,
  uploadDocument,
  deleteDocument
} from '../../controllers/documents.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validation.middleware';
import { uploadLimiter } from '../../middleware/rateLimit.middleware';

const router: RouterType = Router();

// All document routes require authentication
router.use(authMiddleware);

router.get('/', getDocuments);

router.get(
  '/:id',
  validate([param('id').isUUID()]),
  getDocumentById
);

router.post('/', uploadLimiter, uploadDocument);

router.delete(
  '/:id',
  validate([param('id').isUUID()]),
  deleteDocument
);

export default router;
