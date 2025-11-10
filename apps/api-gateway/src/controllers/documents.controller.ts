import { PrismaClient } from '@clone/database';
import { logger } from '@clone/logger';
import { Response } from 'express';

import { AuthRequest } from '../middleware/auth.middleware';
import { DocumentService } from '../services/document.service';

const prisma = new PrismaClient();
const documentService = new DocumentService(prisma);

/**
 * @swagger
 * /documents:
 *   get:
 *     summary: Get all documents for the authenticated user
 *     tags: [Documents]
 *     responses:
 *       200:
 *         description: List of documents
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 documents:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Document'
 */
export const getDocuments = async (req: AuthRequest, res: Response): Promise<void> => {
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

    const documents = await documentService.getUserDocuments(userId);
    res.json({ documents });
  } catch (error) {
    logger.error('Failed to fetch documents', { error });
    res.status(500).json({
      error: {
        code: 'FETCH_DOCUMENTS_FAILED',
        message: 'Failed to fetch documents',
      },
    });
  }
};

/**
 * @swagger
 * /documents/{id}:
 *   get:
 *     summary: Get a specific document by ID
 *     tags: [Documents]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Document details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Document'
 *       404:
 *         description: Document not found
 */
export const getDocumentById = async (req: AuthRequest, res: Response): Promise<void> => {
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

    const document = await documentService.getDocument(id, userId);

    if (!document) {
      res.status(404).json({
        error: {
          code: 'DOCUMENT_NOT_FOUND',
          message: 'Document not found',
        },
      });
      return;
    }

    res.json(document);
  } catch (error) {
    logger.error('Failed to fetch document', { error, documentId: req.params.id });
    res.status(500).json({
      error: {
        code: 'FETCH_DOCUMENT_FAILED',
        message: 'Failed to fetch document',
      },
    });
  }
};

/**
 * @swagger
 * /documents:
 *   post:
 *     summary: Upload a new document
 *     tags: [Documents]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: Document uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Document'
 */
export const uploadDocument = async (req: AuthRequest, res: Response): Promise<void> => {
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

    if (!req.file) {
      res.status(400).json({
        error: {
          code: 'NO_FILE_PROVIDED',
          message: 'No file provided',
        },
      });
      return;
    }

    // Upload document and queue for processing
    const document = await documentService.uploadDocument(userId, req.file);

    res.status(201).json(document);
  } catch (error) {
    logger.error('Failed to upload document', { error });
    res.status(500).json({
      error: {
        code: 'UPLOAD_FAILED',
        message: error instanceof Error ? error.message : 'Failed to upload document',
      },
    });
  }
};

/**
 * @swagger
 * /documents/{id}:
 *   delete:
 *     summary: Delete a document
 *     tags: [Documents]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       204:
 *         description: Document deleted successfully
 *       404:
 *         description: Document not found
 */
export const deleteDocument = async (req: AuthRequest, res: Response): Promise<void> => {
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

    await documentService.deleteDocument(id, userId);
    res.status(204).send();
  } catch (error) {
    logger.error('Failed to delete document', { error, documentId: req.params.id });
    res.status(500).json({
      error: {
        code: 'DELETE_FAILED',
        message: 'Failed to delete document',
      },
    });
  }
};

/**
 * @swagger
 * /documents/{id}/status:
 *   get:
 *     summary: Get document processing status
 *     tags: [Documents]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Document processing status
 */
export const getDocumentStatus = async (req: AuthRequest, res: Response): Promise<void> => {
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

    const status = await documentService.getProcessingStatus(id, userId);

    if (!status) {
      res.status(404).json({
        error: {
          code: 'DOCUMENT_NOT_FOUND',
          message: 'Document not found',
        },
      });
      return;
    }

    res.json(status);
  } catch (error) {
    logger.error('Failed to get document status', { error, documentId: req.params.id });
    res.status(500).json({
      error: {
        code: 'STATUS_FETCH_FAILED',
        message: 'Failed to get document status',
      },
    });
  }
};
