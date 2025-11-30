import { createLogger } from '@clone/logger';
import { FacialKeypoint } from '@clone/shared-types';
import { Router, Request, Response, NextFunction } from 'express';
import type { Router as RouterType } from 'express';
import sharp from 'sharp';

import { FaceDetectionService } from '../services/face-detection.service';
import { FaceEmbeddingService, FaceIdentity } from '../services/face-embedding.service';

const logger = createLogger('face-embedding-routes');
const router: RouterType = Router();

// Initialize services
const faceDetectionService = new FaceDetectionService();
const faceEmbeddingService = new FaceEmbeddingService();

// In-memory identity store (in production, use database)
const identityStore = new Map<string, FaceIdentity>();

/**
 * POST /api/v1/face/embedding/generate
 * Generate face embedding from an image
 */
router.post('/generate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { imageData, userId } = req.body;

    if (!imageData) {
      return res.status(400).json({
        success: false,
        error: 'imageData is required',
      });
    }

    const imageBuffer = Buffer.from(imageData, 'base64');
    const metadata = await sharp(imageBuffer).metadata();

    // Detect faces first
    const faces = await faceDetectionService.detectFaces(
      imageBuffer,
      metadata.width || 0,
      metadata.height || 0
    );

    if (faces.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No face detected in image',
      });
    }

    const primaryFace = faces.find((f) => f.isPrimary) || faces[0];

    // Generate embedding
    const embedding = await faceEmbeddingService.generateEmbedding(
      imageBuffer,
      primaryFace.landmarks
    );

    // Validate embedding
    const validation = faceEmbeddingService.validateEmbedding(embedding);

    logger.info('Face embedding generated', {
      userId,
      dimension: embedding.vector.length,
      confidence: embedding.confidence,
      isValid: validation.isValid,
    });

    return res.json({
      success: true,
      data: {
        embedding: {
          vector: embedding.vector,
          confidence: embedding.confidence,
        },
        validation,
        faceId: primaryFace.faceId,
        faceConfidence: primaryFace.confidence,
      },
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * POST /api/v1/face/embedding/compare
 * Compare two face embeddings
 */
router.post('/compare', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { embedding1, embedding2 } = req.body;

    if (!embedding1 || !embedding2) {
      return res.status(400).json({
        success: false,
        error: 'Both embedding1 and embedding2 are required',
      });
    }

    const result = faceEmbeddingService.compareEmbeddings(embedding1, embedding2);

    logger.info('Embeddings compared', {
      similarity: result.similarity,
      isMatch: result.isMatch,
      matchStrength: result.matchStrength,
    });

    return res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * POST /api/v1/face/embedding/identity/create
 * Create a face identity from multiple samples
 */
router.post('/identity/create', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, images } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId is required',
      });
    }

    if (!images || !Array.isArray(images) || images.length < 3) {
      return res.status(400).json({
        success: false,
        error: 'At least 3 images are required for identity creation',
      });
    }

    // Process each image and generate embeddings
    const samples: Array<{ imageBuffer: Buffer; landmarks: FacialKeypoint[] }> = [];

    for (const imageData of images) {
      const imageBuffer = Buffer.from(imageData, 'base64');
      const metadata = await sharp(imageBuffer).metadata();

      const faces = await faceDetectionService.detectFaces(
        imageBuffer,
        metadata.width || 0,
        metadata.height || 0
      );

      if (faces.length > 0) {
        const primaryFace = faces.find((f) => f.isPrimary) || faces[0];
        samples.push({
          imageBuffer,
          landmarks: primaryFace.landmarks,
        });
      }
    }

    if (samples.length < 3) {
      return res.status(400).json({
        success: false,
        error: `Only ${samples.length} valid face samples found, need at least 3`,
      });
    }

    // Generate embeddings
    const embeddings = await faceEmbeddingService.generateEmbeddingsFromSamples(samples);

    // Check consistency
    const consistency = faceEmbeddingService.checkConsistency(embeddings);

    // Create identity
    const identity = faceEmbeddingService.createIdentity(userId, embeddings);

    // Store identity
    identityStore.set(identity.id, identity);

    logger.info('Face identity created', {
      userId,
      identityId: identity.id,
      sampleCount: identity.sampleCount,
      consistencyScore: consistency.consistencyScore,
    });

    return res.json({
      success: true,
      data: {
        identityId: identity.id,
        userId: identity.userId,
        sampleCount: identity.sampleCount,
        confidence: identity.confidence,
        version: identity.version,
        consistency: {
          isConsistent: consistency.isConsistent,
          score: consistency.consistencyScore,
          outlierCount: consistency.outlierIndices.length,
          recommendations: consistency.recommendations,
        },
        metadata: identity.metadata,
        createdAt: identity.createdAt,
      },
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * POST /api/v1/face/embedding/identity/verify
 * Verify a face against an existing identity
 */
router.post('/identity/verify', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { identityId, imageData } = req.body;

    if (!identityId || !imageData) {
      return res.status(400).json({
        success: false,
        error: 'identityId and imageData are required',
      });
    }

    // Get identity from store
    const identity = identityStore.get(identityId);
    if (!identity) {
      return res.status(404).json({
        success: false,
        error: 'Identity not found',
      });
    }

    // Process image
    const imageBuffer = Buffer.from(imageData, 'base64');
    const metadata = await sharp(imageBuffer).metadata();

    const faces = await faceDetectionService.detectFaces(
      imageBuffer,
      metadata.width || 0,
      metadata.height || 0
    );

    if (faces.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No face detected in image',
      });
    }

    const primaryFace = faces.find((f) => f.isPrimary) || faces[0];

    // Generate embedding
    const embedding = await faceEmbeddingService.generateEmbedding(
      imageBuffer,
      primaryFace.landmarks
    );

    // Verify against identity
    const verification = faceEmbeddingService.verifyIdentity(embedding, identity);

    logger.info('Identity verification completed', {
      identityId,
      isVerified: verification.isVerified,
      similarity: verification.similarity,
      matchStrength: verification.matchStrength,
    });

    return res.json({
      success: true,
      data: {
        isVerified: verification.isVerified,
        similarity: verification.similarity,
        confidence: verification.confidence,
        matchStrength: verification.matchStrength,
        bestMatchIndex: verification.bestMatchIndex,
      },
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * POST /api/v1/face/embedding/identity/update
 * Update an identity with a new face sample
 */
router.post('/identity/update', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { identityId, imageData } = req.body;

    if (!identityId || !imageData) {
      return res.status(400).json({
        success: false,
        error: 'identityId and imageData are required',
      });
    }

    // Get identity from store
    const identity = identityStore.get(identityId);
    if (!identity) {
      return res.status(404).json({
        success: false,
        error: 'Identity not found',
      });
    }

    // Process image
    const imageBuffer = Buffer.from(imageData, 'base64');
    const metadata = await sharp(imageBuffer).metadata();

    const faces = await faceDetectionService.detectFaces(
      imageBuffer,
      metadata.width || 0,
      metadata.height || 0
    );

    if (faces.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No face detected in image',
      });
    }

    const primaryFace = faces.find((f) => f.isPrimary) || faces[0];

    // Generate embedding
    const embedding = await faceEmbeddingService.generateEmbedding(
      imageBuffer,
      primaryFace.landmarks
    );

    // Update identity
    const updatedIdentity = faceEmbeddingService.updateIdentity(identity, embedding);

    // Store updated identity
    identityStore.set(identityId, updatedIdentity);

    logger.info('Identity updated', {
      identityId,
      newVersion: updatedIdentity.version,
      sampleCount: updatedIdentity.sampleCount,
    });

    return res.json({
      success: true,
      data: {
        identityId: updatedIdentity.id,
        version: updatedIdentity.version,
        sampleCount: updatedIdentity.sampleCount,
        confidence: updatedIdentity.confidence,
        updatedAt: updatedIdentity.updatedAt,
      },
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * GET /api/v1/face/embedding/identity/:identityId
 * Get identity details
 */
router.get('/identity/:identityId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { identityId } = req.params;

    const identity = identityStore.get(identityId);
    if (!identity) {
      return res.status(404).json({
        success: false,
        error: 'Identity not found',
      });
    }

    return res.json({
      success: true,
      data: {
        identityId: identity.id,
        userId: identity.userId,
        sampleCount: identity.sampleCount,
        confidence: identity.confidence,
        version: identity.version,
        metadata: identity.metadata,
        createdAt: identity.createdAt,
        updatedAt: identity.updatedAt,
        needsReEmbedding: faceEmbeddingService.needsReEmbedding(identity),
      },
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * DELETE /api/v1/face/embedding/identity/:identityId
 * Delete an identity
 */
router.delete('/identity/:identityId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { identityId } = req.params;

    if (!identityStore.has(identityId)) {
      return res.status(404).json({
        success: false,
        error: 'Identity not found',
      });
    }

    identityStore.delete(identityId);

    logger.info('Identity deleted', { identityId });

    return res.json({
      success: true,
      message: 'Identity deleted successfully',
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * POST /api/v1/face/embedding/cluster
 * Cluster multiple face embeddings to find distinct identities
 */
router.post('/cluster', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { images } = req.body;

    if (!images || !Array.isArray(images) || images.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'At least 2 images are required for clustering',
      });
    }

    // Process each image and generate embeddings
    const embeddings = [];

    for (const imageData of images) {
      const imageBuffer = Buffer.from(imageData, 'base64');
      const metadata = await sharp(imageBuffer).metadata();

      const faces = await faceDetectionService.detectFaces(
        imageBuffer,
        metadata.width || 0,
        metadata.height || 0
      );

      if (faces.length > 0) {
        const primaryFace = faces.find((f) => f.isPrimary) || faces[0];
        const embedding = await faceEmbeddingService.generateEmbedding(
          imageBuffer,
          primaryFace.landmarks
        );
        embeddings.push(embedding);
      }
    }

    if (embeddings.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Could not extract enough face embeddings for clustering',
      });
    }

    // Cluster embeddings
    const clusters = faceEmbeddingService.clusterEmbeddings(embeddings);

    logger.info('Embeddings clustered', {
      totalEmbeddings: embeddings.length,
      clusterCount: clusters.length,
    });

    return res.json({
      success: true,
      data: {
        totalEmbeddings: embeddings.length,
        clusterCount: clusters.length,
        clusters: clusters.map((c) => ({
          clusterId: c.clusterId,
          size: c.size,
          memberIndices: c.memberIndices,
          intraClusterSimilarity: c.intraClusterSimilarity,
        })),
      },
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * POST /api/v1/face/embedding/consistency
 * Check consistency of multiple face samples
 */
router.post('/consistency', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { images } = req.body;

    if (!images || !Array.isArray(images) || images.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'At least 2 images are required for consistency check',
      });
    }

    // Process each image and generate embeddings
    const embeddings = [];

    for (const imageData of images) {
      const imageBuffer = Buffer.from(imageData, 'base64');
      const metadata = await sharp(imageBuffer).metadata();

      const faces = await faceDetectionService.detectFaces(
        imageBuffer,
        metadata.width || 0,
        metadata.height || 0
      );

      if (faces.length > 0) {
        const primaryFace = faces.find((f) => f.isPrimary) || faces[0];
        const embedding = await faceEmbeddingService.generateEmbedding(
          imageBuffer,
          primaryFace.landmarks
        );
        embeddings.push(embedding);
      }
    }

    if (embeddings.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Could not extract enough face embeddings for consistency check',
      });
    }

    // Check consistency
    const consistency = faceEmbeddingService.checkConsistency(embeddings);

    logger.info('Consistency check completed', {
      isConsistent: consistency.isConsistent,
      consistencyScore: consistency.consistencyScore,
      outlierCount: consistency.outlierIndices.length,
    });

    return res.json({
      success: true,
      data: {
        isConsistent: consistency.isConsistent,
        consistencyScore: consistency.consistencyScore,
        outlierIndices: consistency.outlierIndices,
        recommendations: consistency.recommendations,
        pairwiseSimilarities: consistency.pairwiseSimilarities,
      },
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * GET /api/v1/face/embedding/config
 * Get embedding service configuration
 */
router.get('/config', (_req: Request, res: Response) => {
  const config = faceEmbeddingService.getConfig();

  return res.json({
    success: true,
    data: {
      embeddingDimension: config.embeddingDimension,
      similarityThreshold: config.similarityThreshold,
      strongMatchThreshold: config.strongMatchThreshold,
      moderateMatchThreshold: config.moderateMatchThreshold,
      minSamplesForIdentity: config.minSamplesForIdentity,
      maxSamplesForIdentity: config.maxSamplesForIdentity,
      modelVersion: config.modelVersion,
    },
  });
});

export default router;
