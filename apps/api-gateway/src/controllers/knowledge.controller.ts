import { PrismaClient } from '@clone/database';
import { logger } from '@clone/logger';
import { Response } from 'express';

import { AuthRequest } from '../middleware/auth.middleware';
import { KnowledgeService } from '../services/knowledge.service';

const prisma = new PrismaClient();
const knowledgeService = new KnowledgeService(prisma);

/**
 * @swagger
 * /knowledge/sources:
 *   get:
 *     summary: Get knowledge sources with priorities
 *     tags: [Knowledge]
 *     responses:
 *       200:
 *         description: Knowledge sources
 */
export const getKnowledgeSources = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'User not authenticated',
        },
      });
      return;
    }

    const sources = await knowledgeService.getKnowledgeSources(userId);

    res.json(sources);
  } catch (error) {
    logger.error('Failed to fetch knowledge sources', { error });
    res.status(500).json({
      error: {
        code: 'FETCH_SOURCES_FAILED',
        message: 'Failed to fetch knowledge sources',
      },
    });
  }
};

/**
 * @swagger
 * /knowledge/sources/priority:
 *   put:
 *     summary: Update knowledge source priorities
 *     tags: [Knowledge]
 *     responses:
 *       200:
 *         description: Priorities updated
 */
export const updateSourcePriorities = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'User not authenticated',
        },
      });
      return;
    }

    const sources = await knowledgeService.updateSourcePriorities(userId, req.body);

    res.json(sources);
  } catch (error) {
    logger.error('Failed to update source priorities', { error });
    res.status(500).json({
      error: {
        code: 'UPDATE_PRIORITIES_FAILED',
        message: 'Failed to update source priorities',
      },
    });
  }
};

/**
 * @swagger
 * /knowledge/sources/preview:
 *   get:
 *     summary: Preview search results with current priorities
 *     tags: [Knowledge]
 *     responses:
 *       200:
 *         description: Search preview
 */
export const previewSearchResults = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const { q } = req.query;

    if (!userId) {
      res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'User not authenticated',
        },
      });
      return;
    }

    if (!q) {
      res.status(400).json({
        error: {
          code: 'INVALID_REQUEST',
          message: 'Query parameter "q" is required',
        },
      });
      return;
    }

    const preview = await knowledgeService.previewSearchResults(userId, q as string);

    res.json(preview);
  } catch (error) {
    logger.error('Failed to preview search results', { error });
    res.status(500).json({
      error: {
        code: 'PREVIEW_FAILED',
        message: 'Failed to preview search results',
      },
    });
  }
};
