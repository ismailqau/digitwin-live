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
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: List of documents
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

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    const result = await documentService.getUserDocuments(userId, {
      page,
      limit,
      q: req.query.q as string,
      status: req.query.status as string,
      fileType: req.query.fileType as string,
      dateFrom: req.query.dateFrom as string,
      dateTo: req.query.dateTo as string,
      sortBy: req.query.sortBy as string,
      order: req.query.order as 'asc' | 'desc',
    });

    res.json(result);
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
 * /documents/search:
 *   get:
 *     summary: Search documents
 *     tags: [Documents]
 *     responses:
 *       200:
 *         description: Search results
 */
export const searchDocuments = async (req: AuthRequest, res: Response): Promise<void> => {
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

    const result = await documentService.getUserDocuments(userId, {
      page,
      limit,
      q: req.query.q as string,
      status: req.query.status as string,
      fileType: req.query.fileType as string,
      dateFrom: req.query.dateFrom as string,
      dateTo: req.query.dateTo as string,
      sortBy: req.query.sortBy as string,
      order: req.query.order as 'asc' | 'desc',
    });

    res.json(result);
  } catch (error) {
    logger.error('Failed to search documents', { error });
    res.status(500).json({
      error: {
        code: 'SEARCH_FAILED',
        message: 'Failed to search documents',
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
 * /documents/{id}/content:
 *   get:
 *     summary: Get document content
 *     tags: [Documents]
 *     responses:
 *       200:
 *         description: Document content
 */
export const getDocumentContent = async (req: AuthRequest, res: Response): Promise<void> => {
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

    const content = await documentService.getDocumentContent(id, userId);

    if (!content) {
      res.status(404).json({
        error: {
          code: 'DOCUMENT_NOT_FOUND',
          message: 'Document not found',
        },
      });
      return;
    }

    // Return first 1000 characters as preview
    const preview = content.substring(0, 1000);
    const hasMore = content.length > 1000;

    res.json({
      documentId: id,
      content: preview,
      fullLength: content.length,
      previewLength: preview.length,
      hasMore,
    });
  } catch (error) {
    logger.error('Failed to fetch document content', { error, documentId: req.params.id });
    res.status(500).json({
      error: {
        code: 'FETCH_CONTENT_FAILED',
        message: 'Failed to fetch document content',
      },
    });
  }
};

/**
 * @swagger
 * /documents/{id}/chunks:
 *   get:
 *     summary: Get document chunks
 *     tags: [Documents]
 *     responses:
 *       200:
 *         description: Document chunks
 */
export const getDocumentChunks = async (req: AuthRequest, res: Response): Promise<void> => {
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

    const chunks = await documentService.getDocumentChunks(id, userId);

    if (!chunks) {
      res.status(404).json({
        error: {
          code: 'DOCUMENT_NOT_FOUND',
          message: 'Document not found',
        },
      });
      return;
    }

    res.json(chunks);
  } catch (error) {
    logger.error('Failed to fetch document chunks', { error, documentId: req.params.id });
    res.status(500).json({
      error: {
        code: 'FETCH_CHUNKS_FAILED',
        message: 'Failed to fetch document chunks',
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

    if (error instanceof Error) {
      if (error.message.includes('Duplicate')) {
        res.status(409).json({
          error: {
            code: 'DUPLICATE_DOCUMENT',
            message: error.message,
          },
        });
        return;
      }
      if (error.message.includes('size')) {
        res.status(413).json({
          error: {
            code: 'FILE_TOO_LARGE',
            message: error.message,
          },
        });
        return;
      }
      if (error.message.includes('Unsupported')) {
        res.status(415).json({
          error: {
            code: 'UNSUPPORTED_FILE_TYPE',
            message: error.message,
          },
        });
        return;
      }
    }

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
 * /documents/batch:
 *   post:
 *     summary: Batch upload documents
 *     tags: [Documents]
 *     responses:
 *       201:
 *         description: Documents uploaded
 */
export const batchUploadDocuments = async (req: AuthRequest, res: Response): Promise<void> => {
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

    if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
      res.status(400).json({
        error: {
          code: 'NO_FILES_PROVIDED',
          message: 'No files provided',
        },
      });
      return;
    }

    const documents = await documentService.batchUploadDocuments(userId, req.files);

    res.status(201).json({
      documents,
      total: documents.length,
    });
  } catch (error) {
    logger.error('Failed to batch upload documents', { error });
    res.status(500).json({
      error: {
        code: 'BATCH_UPLOAD_FAILED',
        message: 'Failed to batch upload documents',
      },
    });
  }
};

/**
 * @swagger
 * /documents/{id}:
 *   put:
 *     summary: Update document metadata
 *     tags: [Documents]
 *     responses:
 *       200:
 *         description: Document updated
 */
export const updateDocument = async (req: AuthRequest, res: Response): Promise<void> => {
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

    const document = await documentService.updateDocument(id, userId, req.body);

    res.json(document);
  } catch (error) {
    logger.error('Failed to update document', { error, documentId: req.params.id });

    if (error instanceof Error && error.message === 'Document not found') {
      res.status(404).json({
        error: {
          code: 'DOCUMENT_NOT_FOUND',
          message: 'Document not found',
        },
      });
      return;
    }

    res.status(500).json({
      error: {
        code: 'UPDATE_FAILED',
        message: 'Failed to update document',
      },
    });
  }
};

/**
 * @swagger
 * /documents/{id}/status:
 *   patch:
 *     summary: Update document status
 *     tags: [Documents]
 *     responses:
 *       200:
 *         description: Status updated
 */
export const updateDocumentStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;
    const { status } = req.body;

    if (!userId) {
      res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'User not authenticated',
        },
      });
      return;
    }

    if (!status) {
      res.status(400).json({
        error: {
          code: 'INVALID_REQUEST',
          message: 'Status is required',
        },
      });
      return;
    }

    const document = await documentService.updateDocumentStatus(id, userId, status);

    res.json(document);
  } catch (error) {
    logger.error('Failed to update document status', { error, documentId: req.params.id });

    if (error instanceof Error && error.message === 'Document not found') {
      res.status(404).json({
        error: {
          code: 'DOCUMENT_NOT_FOUND',
          message: 'Document not found',
        },
      });
      return;
    }

    res.status(500).json({
      error: {
        code: 'UPDATE_STATUS_FAILED',
        message: 'Failed to update document status',
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

    if (error instanceof Error && error.message === 'Document not found') {
      res.status(404).json({
        error: {
          code: 'DOCUMENT_NOT_FOUND',
          message: 'Document not found',
        },
      });
      return;
    }

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
 * /documents/bulk-delete:
 *   post:
 *     summary: Bulk delete documents
 *     tags: [Documents]
 *     responses:
 *       200:
 *         description: Documents deleted
 */
export const bulkDeleteDocuments = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const { documentIds } = req.body;

    if (!userId) {
      res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'User not authenticated',
        },
      });
      return;
    }

    if (!documentIds || !Array.isArray(documentIds) || documentIds.length === 0) {
      res.status(400).json({
        error: {
          code: 'INVALID_REQUEST',
          message: 'Document IDs are required',
        },
      });
      return;
    }

    const count = await documentService.bulkDeleteDocuments(documentIds, userId);

    res.json({
      deleted: count,
      message: `${count} documents deleted successfully`,
    });
  } catch (error) {
    logger.error('Failed to bulk delete documents', { error });
    res.status(500).json({
      error: {
        code: 'BULK_DELETE_FAILED',
        message: 'Failed to bulk delete documents',
      },
    });
  }
};

/**
 * @swagger
 * /documents/{id}/reindex:
 *   post:
 *     summary: Reindex document
 *     tags: [Documents]
 *     responses:
 *       200:
 *         description: Document queued for reindexing
 */
export const reindexDocument = async (req: AuthRequest, res: Response): Promise<void> => {
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

    const result = await documentService.reindexDocument(id, userId);

    res.json(result);
  } catch (error) {
    logger.error('Failed to reindex document', { error, documentId: req.params.id });

    if (error instanceof Error && error.message === 'Document not found') {
      res.status(404).json({
        error: {
          code: 'DOCUMENT_NOT_FOUND',
          message: 'Document not found',
        },
      });
      return;
    }

    res.status(500).json({
      error: {
        code: 'REINDEX_FAILED',
        message: 'Failed to reindex document',
      },
    });
  }
};

/**
 * @swagger
 * /documents/bulk-reindex:
 *   post:
 *     summary: Bulk reindex documents
 *     tags: [Documents]
 *     responses:
 *       200:
 *         description: Documents queued for reindexing
 */
export const bulkReindexDocuments = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const { documentIds } = req.body;

    if (!userId) {
      res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'User not authenticated',
        },
      });
      return;
    }

    if (!documentIds || !Array.isArray(documentIds) || documentIds.length === 0) {
      res.status(400).json({
        error: {
          code: 'INVALID_REQUEST',
          message: 'Document IDs are required',
        },
      });
      return;
    }

    const result = await documentService.bulkReindexDocuments(documentIds, userId);

    res.json(result);
  } catch (error) {
    logger.error('Failed to bulk reindex documents', { error });
    res.status(500).json({
      error: {
        code: 'BULK_REINDEX_FAILED',
        message: 'Failed to bulk reindex documents',
      },
    });
  }
};

/**
 * @swagger
 * /documents/{id}/processing-status:
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

/**
 * @swagger
 * /documents/stats:
 *   get:
 *     summary: Get document statistics
 *     tags: [Documents]
 *     responses:
 *       200:
 *         description: Document statistics
 */
export const getDocumentStatistics = async (req: AuthRequest, res: Response): Promise<void> => {
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

    const stats = await documentService.getDocumentStatistics(userId);

    res.json(stats);
  } catch (error) {
    logger.error('Failed to get document statistics', { error });
    res.status(500).json({
      error: {
        code: 'STATS_FETCH_FAILED',
        message: 'Failed to get document statistics',
      },
    });
  }
};

/**
 * @swagger
 * /documents/stats/usage:
 *   get:
 *     summary: Get storage usage breakdown
 *     tags: [Documents]
 *     responses:
 *       200:
 *         description: Storage usage
 */
export const getStorageUsage = async (req: AuthRequest, res: Response): Promise<void> => {
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

    const usage = await documentService.getStorageUsage(userId);

    res.json(usage);
  } catch (error) {
    logger.error('Failed to get storage usage', { error });
    res.status(500).json({
      error: {
        code: 'USAGE_FETCH_FAILED',
        message: 'Failed to get storage usage',
      },
    });
  }
};
