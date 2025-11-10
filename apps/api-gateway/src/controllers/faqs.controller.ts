import { PrismaClient } from '@clone/database';
import { logger } from '@clone/logger';
import { Response } from 'express';

import { AuthRequest } from '../middleware/auth.middleware';
import { FAQService } from '../services/faq.service';

const prisma = new PrismaClient();
const faqService = new FAQService(prisma);

/**
 * @swagger
 * /faqs:
 *   post:
 *     summary: Create a new FAQ
 *     tags: [FAQs]
 *     responses:
 *       201:
 *         description: FAQ created
 */
export const createFAQ = async (req: AuthRequest, res: Response): Promise<void> => {
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

    const faq = await faqService.createFAQ(userId, req.body);

    res.status(201).json(faq);
  } catch (error) {
    logger.error('Failed to create FAQ', { error });
    res.status(500).json({
      error: {
        code: 'CREATE_FAQ_FAILED',
        message: 'Failed to create FAQ',
      },
    });
  }
};

/**
 * @swagger
 * /faqs:
 *   get:
 *     summary: Get all FAQs
 *     tags: [FAQs]
 *     responses:
 *       200:
 *         description: List of FAQs
 */
export const getFAQs = async (req: AuthRequest, res: Response): Promise<void> => {
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

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    const result = await faqService.getFAQs(userId, page, limit);

    res.json(result);
  } catch (error) {
    logger.error('Failed to fetch FAQs', { error });
    res.status(500).json({
      error: {
        code: 'FETCH_FAQS_FAILED',
        message: 'Failed to fetch FAQs',
      },
    });
  }
};

/**
 * @swagger
 * /faqs/{id}:
 *   get:
 *     summary: Get FAQ by ID
 *     tags: [FAQs]
 *     responses:
 *       200:
 *         description: FAQ details
 */
export const getFAQById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
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

    const faq = await faqService.getFAQ(id, userId);

    if (!faq) {
      res.status(404).json({
        error: {
          code: 'FAQ_NOT_FOUND',
          message: 'FAQ not found',
        },
      });
      return;
    }

    res.json(faq);
  } catch (error) {
    logger.error('Failed to fetch FAQ', { error, faqId: req.params.id });
    res.status(500).json({
      error: {
        code: 'FETCH_FAQ_FAILED',
        message: 'Failed to fetch FAQ',
      },
    });
  }
};

/**
 * @swagger
 * /faqs/{id}:
 *   put:
 *     summary: Update FAQ
 *     tags: [FAQs]
 *     responses:
 *       200:
 *         description: FAQ updated
 */
export const updateFAQ = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
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

    const faq = await faqService.updateFAQ(id, userId, req.body);

    res.json(faq);
  } catch (error) {
    logger.error('Failed to update FAQ', { error, faqId: req.params.id });

    if (error instanceof Error && error.message === 'FAQ not found') {
      res.status(404).json({
        error: {
          code: 'FAQ_NOT_FOUND',
          message: 'FAQ not found',
        },
      });
      return;
    }

    res.status(500).json({
      error: {
        code: 'UPDATE_FAQ_FAILED',
        message: 'Failed to update FAQ',
      },
    });
  }
};

/**
 * @swagger
 * /faqs/{id}:
 *   delete:
 *     summary: Delete FAQ
 *     tags: [FAQs]
 *     responses:
 *       204:
 *         description: FAQ deleted
 */
export const deleteFAQ = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
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

    await faqService.deleteFAQ(id, userId);

    res.status(204).send();
  } catch (error) {
    logger.error('Failed to delete FAQ', { error, faqId: req.params.id });

    if (error instanceof Error && error.message === 'FAQ not found') {
      res.status(404).json({
        error: {
          code: 'FAQ_NOT_FOUND',
          message: 'FAQ not found',
        },
      });
      return;
    }

    res.status(500).json({
      error: {
        code: 'DELETE_FAQ_FAILED',
        message: 'Failed to delete FAQ',
      },
    });
  }
};

/**
 * @swagger
 * /faqs/reorder:
 *   put:
 *     summary: Reorder FAQs
 *     tags: [FAQs]
 *     responses:
 *       200:
 *         description: FAQs reordered
 */
export const reorderFAQs = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const { faqIds } = req.body;

    if (!userId) {
      res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'User not authenticated',
        },
      });
      return;
    }

    if (!faqIds || !Array.isArray(faqIds) || faqIds.length === 0) {
      res.status(400).json({
        error: {
          code: 'INVALID_REQUEST',
          message: 'FAQ IDs are required',
        },
      });
      return;
    }

    await faqService.reorderFAQs(userId, faqIds);

    res.json({
      message: 'FAQs reordered successfully',
    });
  } catch (error) {
    logger.error('Failed to reorder FAQs', { error });
    res.status(500).json({
      error: {
        code: 'REORDER_FAQS_FAILED',
        message: 'Failed to reorder FAQs',
      },
    });
  }
};
