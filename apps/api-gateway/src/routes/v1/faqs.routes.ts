import { Router, type Router as RouterType } from 'express';
import { body, param, query } from 'express-validator';

import {
  createFAQ,
  deleteFAQ,
  getFAQById,
  getFAQs,
  reorderFAQs,
  updateFAQ,
} from '../../controllers/faqs.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/rbac.middleware';
import { validate } from '../../middleware/validation.middleware';

const router: RouterType = Router();

// All FAQ routes require authentication
router.use(authMiddleware);

// List FAQs
router.get(
  '/',
  validate([
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
  ]),
  requirePermission('knowledge:read'),
  getFAQs
);

// Create FAQ
router.post(
  '/',
  validate([
    body('question').isString().isLength({ min: 1, max: 500 }),
    body('answer').isString().isLength({ min: 1, max: 2000 }),
    body('priority').optional().isInt({ min: 0, max: 100 }),
    body('tags').optional().isArray(),
    body('tags.*').isString(),
  ]),
  requirePermission('knowledge:write'),
  createFAQ
);

// Reorder FAQs
router.put(
  '/reorder',
  validate([body('faqIds').isArray({ min: 1 }), body('faqIds.*').isUUID()]),
  requirePermission('knowledge:write'),
  reorderFAQs
);

// Get FAQ by ID
router.get(
  '/:id',
  validate([param('id').isUUID()]),
  requirePermission('knowledge:read'),
  getFAQById
);

// Update FAQ
router.put(
  '/:id',
  validate([
    param('id').isUUID(),
    body('question').optional().isString().isLength({ min: 1, max: 500 }),
    body('answer').optional().isString().isLength({ min: 1, max: 2000 }),
    body('priority').optional().isInt({ min: 0, max: 100 }),
    body('tags').optional().isArray(),
    body('tags.*').isString(),
  ]),
  requirePermission('knowledge:write'),
  updateFAQ
);

// Delete FAQ
router.delete(
  '/:id',
  validate([param('id').isUUID()]),
  requirePermission('knowledge:write'),
  deleteFAQ
);

export default router;
