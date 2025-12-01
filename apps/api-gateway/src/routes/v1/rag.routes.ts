import { Router } from 'express';
import { body } from 'express-validator';

import { RAGController } from '../../controllers/rag.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validation.middleware';

export function createRAGRoutes(ragController: RAGController): Router {
  const router = Router();

  /**
   * @swagger
   * /api/v1/rag/search:
   *   post:
   *     summary: Search for relevant documents using semantic similarity
   *     tags: [RAG]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - query
   *             properties:
   *               query:
   *                 type: string
   *               knowledgeBaseId:
   *                 type: string
   *               maxResults:
   *                 type: number
   *                 default: 10
   *               similarityThreshold:
   *                 type: number
   *                 default: 0.7
   *     responses:
   *       200:
   *         description: Search results
   *       401:
   *         description: Unauthorized
   */
  router.post(
    '/search',
    authMiddleware,
    validate([
      body('query').isString().notEmpty().withMessage('Query is required'),
      body('knowledgeBaseId').optional().isString(),
      body('maxResults').optional().isInt({ min: 1, max: 100 }),
      body('similarityThreshold').optional().isFloat({ min: 0, max: 1 }),
    ]),
    ragController.search.bind(ragController)
  );

  /**
   * @swagger
   * /api/v1/rag/stats:
   *   get:
   *     summary: Get RAG service statistics
   *     tags: [RAG]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Service statistics
   */
  router.get('/stats', authMiddleware, ragController.getStats.bind(ragController));

  return router;
}
