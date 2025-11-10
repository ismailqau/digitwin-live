import { Router, type Router as RouterType } from 'express';
import { body, query } from 'express-validator';

import {
  getKnowledgeSources,
  previewSearchResults,
  updateSourcePriorities,
} from '../../controllers/knowledge.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/rbac.middleware';
import { validate } from '../../middleware/validation.middleware';

const router: RouterType = Router();

// All knowledge routes require authentication
router.use(authMiddleware);

// Get knowledge sources with priorities
router.get('/sources', requirePermission('knowledge:read'), getKnowledgeSources);

// Update knowledge source priorities
router.put(
  '/sources/priority',
  validate([
    body('documents').isInt({ min: 1, max: 10 }),
    body('faqs').isInt({ min: 1, max: 10 }),
    body('conversations').isInt({ min: 1, max: 10 }),
  ]),
  requirePermission('knowledge:write'),
  updateSourcePriorities
);

// Preview search results with current priorities
router.get(
  '/sources/preview',
  validate([query('q').isString().isLength({ min: 1 })]),
  requirePermission('knowledge:read'),
  previewSearchResults
);

export default router;
