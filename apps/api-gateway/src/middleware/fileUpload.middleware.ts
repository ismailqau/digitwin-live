import { logger } from '@clone/logger';
import {
  validateDocumentFile,
  validateImageFile,
  validateVideoFile,
  validateAudioFile,
  validateBatchUpload,
  scanForMaliciousContent,
  FileValidationResult,
} from '@clone/validation';
import { Request, Response, NextFunction } from 'express';
import multer from 'multer';

/**
 * File upload type
 */
export type FileUploadType = 'document' | 'image' | 'video' | 'audio';

/**
 * Multer memory storage configuration
 */
const storage = multer.memoryStorage();

/**
 * Create multer upload middleware with validation
 */
export function createFileUploadMiddleware(
  type: FileUploadType,
  options: {
    maxFiles?: number;
    fieldName?: string;
  } = {}
): Array<(req: Request, res: Response, next: NextFunction) => void> {
  const { maxFiles = 1, fieldName = 'file' } = options;

  // Create multer instance
  const upload =
    maxFiles === 1
      ? multer({ storage }).single(fieldName)
      : multer({ storage }).array(fieldName, maxFiles);

  // Return middleware chain
  return [
    upload,
    (req: Request, res: Response, next: NextFunction) => {
      validateUploadedFiles(req, res, next, type);
    },
  ];
}

/**
 * Validate uploaded files
 */
function validateUploadedFiles(
  req: Request,
  res: Response,
  next: NextFunction,
  type: FileUploadType
): void {
  try {
    // Get uploaded files
    const files = req.file ? [req.file] : req.files ? (req.files as Express.Multer.File[]) : [];

    if (files.length === 0) {
      res.status(400).json({
        error: {
          code: 'NO_FILE_UPLOADED',
          message: 'No file was uploaded',
        },
      });
      return;
    }

    // Validate batch if multiple files
    if (files.length > 1) {
      const batchResult = validateBatchUpload(
        files.map((f) => ({
          filename: f.originalname,
          mimeType: f.mimetype,
          sizeBytes: f.size,
        }))
      );

      if (!batchResult.isValid) {
        res.status(400).json({
          error: {
            code: 'BATCH_VALIDATION_FAILED',
            message: 'Batch upload validation failed',
            details: batchResult.errors,
            warnings: batchResult.warnings,
          },
        });
        return;
      }
    }

    // Validate each file
    const validationErrors: Array<{ filename: string; errors: string[] }> = [];
    const validationWarnings: Array<{ filename: string; warnings: string[] }> = [];

    for (const file of files) {
      // Validate file type and size
      let result: FileValidationResult;

      switch (type) {
        case 'document':
          result = validateDocumentFile(file.originalname, file.mimetype, file.size);
          break;
        case 'image':
          result = validateImageFile(file.originalname, file.mimetype, file.size);
          break;
        case 'video':
          result = validateVideoFile(file.originalname, file.mimetype, file.size);
          break;
        case 'audio':
          result = validateAudioFile(file.originalname, file.mimetype, file.size);
          break;
        default:
          result = { isValid: false, errors: ['Unknown file type'], warnings: [] };
      }

      if (!result.isValid) {
        validationErrors.push({
          filename: file.originalname,
          errors: result.errors,
        });
      }

      if (result.warnings.length > 0) {
        validationWarnings.push({
          filename: file.originalname,
          warnings: result.warnings,
        });
      }

      // Scan for malicious content
      const scanResult = scanForMaliciousContent(file.buffer);
      if (!scanResult.isValid) {
        validationErrors.push({
          filename: file.originalname,
          errors: scanResult.errors,
        });

        logger.warn('Malicious file upload attempt detected', {
          filename: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
          userId: (req as { user?: { id: string } }).user?.id,
          errors: scanResult.errors,
        });
      }

      if (scanResult.warnings.length > 0) {
        validationWarnings.push({
          filename: file.originalname,
          warnings: scanResult.warnings,
        });
      }
    }

    // Return errors if any
    if (validationErrors.length > 0) {
      res.status(400).json({
        error: {
          code: 'FILE_VALIDATION_FAILED',
          message: 'One or more files failed validation',
          details: validationErrors,
          warnings: validationWarnings.length > 0 ? validationWarnings : undefined,
        },
      });
      return;
    }

    // Log warnings if any
    if (validationWarnings.length > 0) {
      logger.warn('File upload warnings', {
        warnings: validationWarnings,
        userId: (req as { user?: { id: string } }).user?.id,
      });
    }

    // All files valid, proceed
    next();
  } catch (error) {
    logger.error('File upload validation error', { error });
    next(error);
  }
}

/**
 * Document upload middleware
 */
export const uploadDocument = createFileUploadMiddleware('document', {
  fieldName: 'file',
  maxFiles: 1,
});

/**
 * Batch document upload middleware
 */
export const uploadDocuments = createFileUploadMiddleware('document', {
  fieldName: 'files',
  maxFiles: 10,
});

/**
 * Image upload middleware (for face models)
 */
export const uploadImage = createFileUploadMiddleware('image', {
  fieldName: 'image',
  maxFiles: 1,
});

/**
 * Batch image upload middleware (for face models)
 */
export const uploadImages = createFileUploadMiddleware('image', {
  fieldName: 'images',
  maxFiles: 10,
});

/**
 * Video upload middleware (for face models)
 */
export const uploadVideo = createFileUploadMiddleware('video', {
  fieldName: 'video',
  maxFiles: 1,
});

/**
 * Audio upload middleware (for voice samples)
 */
export const uploadAudio = createFileUploadMiddleware('audio', {
  fieldName: 'audio',
  maxFiles: 1,
});

/**
 * Batch audio upload middleware (for voice samples)
 */
export const uploadAudios = createFileUploadMiddleware('audio', {
  fieldName: 'audios',
  maxFiles: 10,
});
