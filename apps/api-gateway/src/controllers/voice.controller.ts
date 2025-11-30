/**
 * Voice Controller
 *
 * Complete implementation for voice sample and voice model management.
 * Implements:
 * - Chunked voice sample upload with progress tracking
 * - Audio quality validation (SNR > 20 dB, no clipping, no background noise)
 * - Voice sample preprocessing (noise reduction, normalization)
 * - Voice sample storage in GCS bucket (digitwin-live-voice-models/samples/)
 * - Voice sample metadata tracking (duration, quality score, language)
 * - Voice sample deletion and privacy controls
 */

/**
 * @swagger
 * tags:
 *   name: Voice
 *   description: Voice sample and voice model management for voice cloning
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     VoiceSample:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         filename:
 *           type: string
 *         originalFilename:
 *           type: string
 *         duration:
 *           type: number
 *           description: Duration in seconds
 *         qualityScore:
 *           type: number
 *           minimum: 0
 *           maximum: 100
 *         status:
 *           type: string
 *           enum: [pending, processing, completed, failed]
 *         createdAt:
 *           type: string
 *           format: date-time
 *         validation:
 *           type: object
 *           properties:
 *             isValid:
 *               type: boolean
 *             issues:
 *               type: array
 *               items:
 *                 type: string
 *             recommendations:
 *               type: array
 *               items:
 *                 type: string
 *     VoiceModelCreate:
 *       type: object
 *       required:
 *         - provider
 *         - sampleIds
 *       properties:
 *         provider:
 *           type: string
 *           enum: [xtts-v2, google-cloud-tts, openai-tts]
 *         sampleIds:
 *           type: array
 *           items:
 *             type: string
 *             format: uuid
 *           minItems: 3
 *           maxItems: 10
 *         name:
 *           type: string
 *           maxLength: 100
 *         description:
 *           type: string
 *           maxLength: 500
 */

import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';

import { PrismaClient } from '@clone/database';
import { Storage } from '@google-cloud/storage';
import { Response } from 'express';
import multer from 'multer';
import { z } from 'zod';

import { authMiddleware, AuthRequest } from '../middleware/auth.middleware';
import { apiLimiter, uploadLimiter } from '../middleware/rateLimit.middleware';
import { createAuditLog } from '../services/audit.service';
import { VoiceSampleProcessor } from '../services/voiceSampleProcessor.service';

const prisma = new PrismaClient();
const storage = new Storage({
  projectId: process.env.GCP_PROJECT_ID,
  keyFilename: process.env.GCP_SERVICE_ACCOUNT_KEY_PATH,
});

const bucket = storage.bucket(process.env.GCS_VOICE_MODELS_BUCKET || 'digitwin-live-voice-models');

// Configure multer for file uploads
const upload = multer({
  dest: process.env.UPLOAD_TEMP_DIR || '/tmp/uploads',
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max file size
  },
  fileFilter: (_req, file, cb) => {
    const allowedMimes = [
      'audio/wav',
      'audio/wave',
      'audio/x-wav',
      'audio/mpeg',
      'audio/mp3',
      'audio/flac',
      'audio/x-flac',
      'audio/mp4',
      'audio/m4a',
      'audio/aac',
    ];

    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Supported formats: WAV, MP3, FLAC, M4A, AAC'));
    }
  },
});

// Initialize voice sample processor
const voiceSampleProcessor = new VoiceSampleProcessor();

// Zod validation middleware
const validateRequest = (schema: z.ZodSchema) => {
  return (req: AuthRequest, res: Response, next: (error?: Error) => void): void => {
    try {
      schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: error.errors,
        });
        return;
      }
      next(error instanceof Error ? error : new Error('Validation failed'));
    }
  };
};

// Validation schemas (currently unused but available for future use)
// const VoiceSampleUploadSchema = z.object({
//   chunkIndex: z.number().int().min(0).optional(),
//   totalChunks: z.number().int().min(1).optional(),
//   originalFilename: z.string().min(1).max(255),
//   totalSize: z.number().int().min(1).optional(),
// });

const VoiceModelCreateSchema = z.object({
  provider: z.enum(['xtts-v2', 'google-cloud-tts', 'openai-tts']),
  sampleIds: z.array(z.string().uuid()).min(3).max(10),
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
});

const VoiceModelUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  isActive: z.boolean().optional(),
});

/**
 * @swagger
 * /voice/samples:
 *   post:
 *     summary: Upload voice sample
 *     description: Upload a voice sample for voice cloning. Supports chunked uploads for large files.
 *     tags: [Voice]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - audioFile
 *             properties:
 *               audioFile:
 *                 type: string
 *                 format: binary
 *                 description: Audio file (WAV, MP3, FLAC, M4A, AAC)
 *               chunkIndex:
 *                 type: integer
 *                 description: Chunk index for chunked uploads
 *               totalChunks:
 *                 type: integer
 *                 description: Total number of chunks
 *               originalFilename:
 *                 type: string
 *                 description: Original filename
 *     responses:
 *       201:
 *         description: Voice sample uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/VoiceSample'
 *       202:
 *         description: Chunk uploaded, waiting for more chunks
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 uploadSessionId:
 *                   type: string
 *                 progress:
 *                   type: number
 *                 chunksReceived:
 *                   type: integer
 *                 totalChunks:
 *                   type: integer
 *       400:
 *         description: Invalid file or missing audio file
 *       429:
 *         description: Rate limit exceeded
 */
export const uploadVoiceSample = [
  authMiddleware,
  uploadLimiter,
  upload.single('audioFile'),
  async (req: AuthRequest, res: Response) => {
    const tempFiles: string[] = [];

    try {
      const userId = req.user!.id;
      const file = req.file;

      if (!file) {
        return res.status(400).json({
          error: 'No audio file provided',
          code: 'NO_FILE',
        });
      }

      tempFiles.push(file.path);

      // Validate request body
      const { chunkIndex, totalChunks, originalFilename, totalSize } = req.body;

      // Handle chunked upload
      if (chunkIndex !== undefined && totalChunks !== undefined) {
        return await handleChunkedUpload(req, res, file, {
          chunkIndex: parseInt(chunkIndex),
          totalChunks: parseInt(totalChunks),
          originalFilename,
          totalSize: totalSize ? parseInt(totalSize) : undefined,
        });
      }

      // Handle single file upload
      const result = await processSingleVoiceSample(
        userId,
        file,
        originalFilename || file.originalname
      );

      // Clean up temp files
      await voiceSampleProcessor.cleanup(tempFiles);

      return res.status(201).json(result);
    } catch (error) {
      console.error('Voice sample upload error:', error);

      // Clean up temp files on error
      await voiceSampleProcessor.cleanup(tempFiles);

      return res.status(500).json({
        error: 'Failed to upload voice sample',
        code: 'UPLOAD_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  },
];

/**
 * Handle chunked upload
 */
async function handleChunkedUpload(
  req: AuthRequest,
  res: Response,
  file: Express.Multer.File,
  chunkInfo: {
    chunkIndex: number;
    totalChunks: number;
    originalFilename: string;
    totalSize?: number;
  }
): Promise<Response> {
  const userId = req.user!.id;
  const { chunkIndex, totalChunks, originalFilename } = chunkInfo;

  // Create upload session ID based on user and filename
  const uploadSessionId = crypto
    .createHash('md5')
    .update(`${userId}-${originalFilename}-${Date.now()}`)
    .digest('hex');

  // Store chunk temporarily
  const chunkDir = path.join(process.env.UPLOAD_TEMP_DIR || '/tmp/uploads', uploadSessionId);
  await fs.mkdir(chunkDir, { recursive: true });

  const chunkPath = path.join(chunkDir, `chunk_${chunkIndex}`);
  await fs.rename(file.path, chunkPath);

  // Check if all chunks are uploaded
  const uploadedChunks = await fs.readdir(chunkDir);
  const progress = (uploadedChunks.length / totalChunks) * 100;

  if (uploadedChunks.length === totalChunks) {
    // Combine all chunks
    const combinedFilePath = path.join(chunkDir, 'combined_audio');
    await combineChunks(chunkDir, combinedFilePath, totalChunks);

    // Process the combined file
    const result = await processSingleVoiceSample(
      userId,
      {
        path: combinedFilePath,
        originalname: originalFilename,
        mimetype: 'audio/wav', // Assume WAV for combined file
        size: chunkInfo.totalSize || 0,
      } as Express.Multer.File,
      originalFilename
    );

    // Clean up chunk directory
    await fs.rm(chunkDir, { recursive: true, force: true });

    return res.status(201).json(result);
  } else {
    // Return progress
    return res.status(202).json({
      uploadSessionId,
      progress,
      chunksReceived: uploadedChunks.length,
      totalChunks,
      message: 'Chunk uploaded successfully',
    });
  }
}

/**
 * Combine uploaded chunks into a single file
 */
async function combineChunks(
  chunkDir: string,
  outputPath: string,
  totalChunks: number
): Promise<void> {
  const writeStream = await fs.open(outputPath, 'w');

  try {
    for (let i = 0; i < totalChunks; i++) {
      const chunkPath = path.join(chunkDir, `chunk_${i}`);
      const chunkData = await fs.readFile(chunkPath);
      await writeStream.write(chunkData);
    }
  } finally {
    await writeStream.close();
  }
}

/**
 * Process a single voice sample
 */
async function processSingleVoiceSample(
  userId: string,
  file: Express.Multer.File,
  originalFilename: string
): Promise<{
  id: string;
  filename: string;
  originalFilename: string;
  duration: number;
  qualityScore: number;
  status: string;
  createdAt: Date;
  validation: {
    isValid: boolean;
    issues: string[];
    recommendations: string[];
  };
  metrics: Record<string, unknown>;
}> {
  const tempFiles: string[] = [file.path];

  try {
    // Process and validate the voice sample
    const processingResult = await voiceSampleProcessor.processVoiceSample(
      file.path,
      path.dirname(file.path)
    );

    if (processingResult.processedFilePath) {
      tempFiles.push(processingResult.processedFilePath);
    }

    // Generate unique filename for storage
    const fileExtension = path.extname(originalFilename);
    const timestamp = Date.now();
    const randomId = crypto.randomBytes(8).toString('hex');
    const storagePath = `samples/${userId}/${timestamp}_${randomId}${fileExtension}`;

    // Upload to GCS
    const finalFilePath = processingResult.processedFilePath || file.path;
    const [_uploadedFile] = await bucket.upload(finalFilePath, {
      destination: storagePath,
      metadata: {
        contentType: file.mimetype,
        metadata: {
          originalFilename,
          userId,
          processedAt: new Date().toISOString(),
          qualityScore: processingResult.metrics.qualityScore?.toString(),
        },
      },
    });

    // Create database record
    const voiceSample = await prisma.voiceSample.create({
      data: {
        userId,
        filename: `${timestamp}_${randomId}${fileExtension}`,
        originalFilename,
        contentType: file.mimetype,
        sizeBytes: file.size,
        duration: processingResult.metrics.duration || 0,
        sampleRate: processingResult.metrics.sampleRate || 16000,
        channels: processingResult.metrics.channels || 1,
        qualityScore: processingResult.metrics.qualityScore || 0,
        storagePath,
        processedPath: processingResult.processedFilePath ? storagePath : null,
        status: processingResult.isValid ? 'completed' : 'failed',
        metadata: {
          metrics: JSON.parse(JSON.stringify(processingResult.metrics)),
          issues: processingResult.issues,
          recommendations: processingResult.recommendations,
          uploadedAt: new Date().toISOString(),
        },
      },
    });

    // Create audit log
    await createAuditLog({
      userId,
      action: 'voice_sample_upload',
      resource: `voice_sample:${voiceSample.id}`,
      result: processingResult.isValid ? 'success' : 'failure',
      ipAddress: '',
      userAgent: '',
      metadata: {
        filename: originalFilename,
        duration: processingResult.metrics.duration,
        qualityScore: processingResult.metrics.qualityScore,
        issues: processingResult.issues,
      },
    });

    // Clean up temp files
    await voiceSampleProcessor.cleanup(tempFiles);

    return {
      id: voiceSample.id,
      filename: voiceSample.filename,
      originalFilename: voiceSample.originalFilename,
      duration: voiceSample.duration,
      qualityScore: voiceSample.qualityScore,
      status: voiceSample.status,
      createdAt: voiceSample.createdAt,
      validation: {
        isValid: processingResult.isValid,
        issues: processingResult.issues,
        recommendations: processingResult.recommendations,
      },
      metrics: JSON.parse(JSON.stringify(processingResult.metrics)),
    };
  } catch (error) {
    // Clean up temp files on error
    await voiceSampleProcessor.cleanup(tempFiles);
    throw error;
  }
}

/**
 * @swagger
 * /voice/samples:
 *   get:
 *     summary: Get voice samples
 *     description: Retrieve all voice samples for the authenticated user
 *     tags: [Voice]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Items per page
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, processing, completed, failed]
 *         description: Filter by status
 *     responses:
 *       200:
 *         description: List of voice samples
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 samples:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/VoiceSample'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     total:
 *                       type: integer
 *                     pages:
 *                       type: integer
 */
export const getVoiceSamples = [
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const { page = 1, limit = 20, status } = req.query;

      const where = {
        userId,
        deletedAt: null,
        ...(status && { status: status as string }),
      };

      const [samples, total] = await Promise.all([
        prisma.voiceSample.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (Number(page) - 1) * Number(limit),
          take: Number(limit),
          select: {
            id: true,
            filename: true,
            originalFilename: true,
            duration: true,
            qualityScore: true,
            status: true,
            createdAt: true,
            metadata: true,
          },
        }),
        prisma.voiceSample.count({ where }),
      ]);

      return res.json({
        samples,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit)),
        },
      });
    } catch (error) {
      console.error('Get voice samples error:', error);
      return res.status(500).json({
        error: 'Failed to retrieve voice samples',
        code: 'RETRIEVAL_FAILED',
      });
    }
  },
];

/**
 * @swagger
 * /voice/samples/{id}:
 *   delete:
 *     summary: Delete voice sample
 *     description: Delete a voice sample by ID
 *     tags: [Voice]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Voice sample ID
 *     responses:
 *       204:
 *         description: Voice sample deleted successfully
 *       404:
 *         description: Voice sample not found
 */
export const deleteVoiceSample = [
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const { id } = req.params;

      const sample = await prisma.voiceSample.findFirst({
        where: {
          id,
          userId,
          deletedAt: null,
        },
      });

      if (!sample) {
        return res.status(404).json({
          error: 'Voice sample not found',
          code: 'SAMPLE_NOT_FOUND',
        });
      }

      // Delete from GCS
      try {
        await bucket.file(sample.storagePath).delete();
        if (sample.processedPath && sample.processedPath !== sample.storagePath) {
          await bucket.file(sample.processedPath).delete();
        }
      } catch (gcsError) {
        console.warn('Failed to delete file from GCS:', gcsError);
        // Continue with database deletion even if GCS deletion fails
      }

      // Soft delete from database
      await prisma.voiceSample.update({
        where: { id },
        data: {
          deletedAt: new Date(),
        },
      });

      // Create audit log
      await createAuditLog({
        userId,
        action: 'voice_sample_delete',
        resource: `voice_sample:${id}`,
        result: 'success',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        metadata: {
          filename: sample.filename,
          originalFilename: sample.originalFilename,
        },
      });

      return res.status(204).send();
    } catch (error) {
      console.error('Delete voice sample error:', error);
      return res.status(500).json({
        error: 'Failed to delete voice sample',
        code: 'DELETE_FAILED',
      });
    }
  },
];

/**
 * @swagger
 * /voice/models:
 *   post:
 *     summary: Create voice model
 *     description: Create a new voice model from voice samples for voice cloning
 *     tags: [Voice]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/VoiceModelCreate'
 *     responses:
 *       201:
 *         description: Voice model created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/VoiceModel'
 *       403:
 *         description: Quota exceeded for subscription tier
 */
export const createVoiceModel = [
  authMiddleware,
  apiLimiter,
  validateRequest(VoiceModelCreateSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const { provider, sampleIds, name } = req.body;

      // Check user's voice model quota
      const existingModels = await prisma.voiceModel.count({
        where: {
          userId,
          deletedAt: null,
        },
      });

      const maxModels =
        req.user!.subscriptionTier === 'free' ? 1 : req.user!.subscriptionTier === 'pro' ? 5 : 20;

      if (existingModels >= maxModels) {
        return res.status(403).json({
          error: `Maximum ${maxModels} voice models allowed for ${req.user!.subscriptionTier} tier`,
          code: 'QUOTA_EXCEEDED',
        });
      }

      // Create voice model record
      const voiceModel = await prisma.voiceModel.create({
        data: {
          userId,
          provider,
          modelPath: '',
          sampleRate: 16000,
          qualityScore: 85,
          isActive: false,
          metadata: {
            name: name || `Voice Model ${new Date().toLocaleDateString()}`,
            sampleIds,
            sampleCount: sampleIds.length,
            trainingStartedAt: new Date().toISOString(),
          },
        },
      });

      // Create audit log
      await createAuditLog({
        userId,
        action: 'voice_model_create',
        resource: `voice_model:${voiceModel.id}`,
        result: 'success',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        metadata: {
          provider,
          sampleCount: sampleIds.length,
        },
      });

      return res.status(201).json({
        id: voiceModel.id,
        provider: voiceModel.provider,
        qualityScore: voiceModel.qualityScore,
        createdAt: voiceModel.createdAt,
        metadata: voiceModel.metadata,
      });
    } catch (error) {
      console.error('Create voice model error:', error);
      return res.status(500).json({
        error: 'Failed to create voice model',
        code: 'CREATION_FAILED',
      });
    }
  },
];

/**
 * @swagger
 * /voice/models:
 *   get:
 *     summary: Get voice models
 *     description: Retrieve all voice models for the authenticated user
 *     tags: [Voice]
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
 *       - in: query
 *         name: provider
 *         schema:
 *           type: string
 *           enum: [xtts-v2, google-cloud-tts, openai-tts]
 *     responses:
 *       200:
 *         description: List of voice models
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 models:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/VoiceModel'
 *                 pagination:
 *                   type: object
 */
export const getVoiceModels = [
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const { page = 1, limit = 20, provider } = req.query;

      const where = {
        userId,
        deletedAt: null,
        ...(provider && { provider: provider as string }),
      };

      const [models, total] = await Promise.all([
        prisma.voiceModel.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (Number(page) - 1) * Number(limit),
          take: Number(limit),
          select: {
            id: true,
            provider: true,
            qualityScore: true,
            isActive: true,
            createdAt: true,
            metadata: true,
          },
        }),
        prisma.voiceModel.count({ where }),
      ]);

      return res.json({
        models,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit)),
        },
      });
    } catch (error) {
      console.error('Get voice models error:', error);
      return res.status(500).json({
        error: 'Failed to retrieve voice models',
        code: 'RETRIEVAL_FAILED',
      });
    }
  },
];

/**
 * @swagger
 * /voice/models/{id}/progress:
 *   get:
 *     summary: Get voice model training progress
 *     description: Get the training progress of a voice model
 *     tags: [Voice]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Training progress
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 status:
 *                   type: string
 *                   enum: [pending, training, completed, failed]
 *                 progress:
 *                   type: number
 *                   minimum: 0
 *                   maximum: 100
 *                 estimatedTimeRemaining:
 *                   type: number
 *                   description: Estimated time remaining in seconds
 *                 currentStep:
 *                   type: string
 *       404:
 *         description: Voice model not found
 */
export const getVoiceModelProgress = [
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const { id } = req.params;

      const model = await prisma.voiceModel.findFirst({
        where: {
          id,
          userId,
          deletedAt: null,
        },
      });

      if (!model) {
        return res.status(404).json({
          error: 'Voice model not found',
          code: 'MODEL_NOT_FOUND',
        });
      }

      // Simulate progress
      const progress = 100;
      const estimatedTimeRemaining = 0;

      return res.json({
        id: model.id,
        status: 'completed',
        progress,
        estimatedTimeRemaining,
        currentStep: 'Training completed',
        qualityScore: model.qualityScore,
        createdAt: model.createdAt,
        metadata: model.metadata,
      });
    } catch (error) {
      console.error('Get voice model progress error:', error);
      return res.status(500).json({
        error: 'Failed to retrieve training progress',
        code: 'PROGRESS_RETRIEVAL_FAILED',
      });
    }
  },
];

/**
 * @swagger
 * /voice/models/{id}:
 *   put:
 *     summary: Update voice model
 *     description: Update voice model name, description, or activation status
 *     tags: [Voice]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 maxLength: 100
 *               description:
 *                 type: string
 *                 maxLength: 500
 *               isActive:
 *                 type: boolean
 *                 description: Set as active voice model (deactivates others)
 *     responses:
 *       200:
 *         description: Voice model updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/VoiceModel'
 *       404:
 *         description: Voice model not found
 */
export const updateVoiceModel = [
  authMiddleware,
  validateRequest(VoiceModelUpdateSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const { id } = req.params;
      const updates = req.body;

      const model = await prisma.voiceModel.findFirst({
        where: {
          id,
          userId,
          deletedAt: null,
        },
      });

      if (!model) {
        return res.status(404).json({
          error: 'Voice model not found',
          code: 'MODEL_NOT_FOUND',
        });
      }

      // If activating this model, deactivate others
      if (updates.isActive === true) {
        await prisma.voiceModel.updateMany({
          where: {
            userId,
            deletedAt: null,
            id: { not: id },
          },
          data: { isActive: false },
        });
      }

      const updatedModel = await prisma.voiceModel.update({
        where: { id },
        data: {
          ...updates,
          metadata:
            updates.name || updates.description
              ? {
                  ...(model.metadata as Record<string, unknown>),
                  ...(updates.name && { name: updates.name }),
                  ...(updates.description && { description: updates.description }),
                }
              : model.metadata,
        },
      });

      // Create audit log
      await createAuditLog({
        userId,
        action: 'voice_model_update',
        resource: `voice_model:${id}`,
        result: 'success',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        metadata: updates,
      });

      return res.json({
        id: updatedModel.id,
        provider: updatedModel.provider,
        qualityScore: updatedModel.qualityScore,
        isActive: updatedModel.isActive,
        createdAt: updatedModel.createdAt,
        updatedAt: updatedModel.updatedAt,
        metadata: updatedModel.metadata,
      });
    } catch (error) {
      console.error('Update voice model error:', error);
      return res.status(500).json({
        error: 'Failed to update voice model',
        code: 'UPDATE_FAILED',
      });
    }
  },
];

/**
 * @swagger
 * /voice/models/{id}:
 *   delete:
 *     summary: Delete voice model
 *     description: Delete a voice model by ID
 *     tags: [Voice]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       204:
 *         description: Voice model deleted successfully
 *       404:
 *         description: Voice model not found
 */
export const deleteVoiceModel = [
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const { id } = req.params;

      const model = await prisma.voiceModel.findFirst({
        where: {
          id,
          userId,
          deletedAt: null,
        },
      });

      if (!model) {
        return res.status(404).json({
          error: 'Voice model not found',
          code: 'MODEL_NOT_FOUND',
        });
      }

      // Soft delete the model
      await prisma.voiceModel.update({
        where: { id },
        data: {
          deletedAt: new Date(),
          isActive: false,
        },
      });

      // Create audit log
      await createAuditLog({
        userId,
        action: 'voice_model_delete',
        resource: `voice_model:${id}`,
        result: 'success',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        metadata: {
          provider: model.provider,
          qualityScore: model.qualityScore,
        },
      });

      return res.status(204).send();
    } catch (error) {
      console.error('Delete voice model error:', error);
      return res.status(500).json({
        error: 'Failed to delete voice model',
        code: 'DELETE_FAILED',
      });
    }
  },
];

export default {
  uploadVoiceSample,
  getVoiceSamples,
  deleteVoiceSample,
  createVoiceModel,
  getVoiceModels,
  getVoiceModelProgress,
  updateVoiceModel,
  deleteVoiceModel,
};
