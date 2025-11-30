import { createLogger } from '@clone/logger';
import { FACE_QUALITY_THRESHOLDS } from '@clone/shared-types';
import { Router, Request, Response, NextFunction } from 'express';
import type { Router as RouterType } from 'express';
import sharp from 'sharp';

import { BatchProcessorService } from '../services/batch-processor.service';
import { FaceDetectionService } from '../services/face-detection.service';
import { FacePreprocessingService } from '../services/face-preprocessing.service';
import { FaceQualityService } from '../services/face-quality.service';

const logger = createLogger('face-validation-routes');
const router: RouterType = Router();

// Initialize services
const faceDetectionService = new FaceDetectionService();
const faceQualityService = new FaceQualityService();
const facePreprocessingService = new FacePreprocessingService();
const batchProcessorService = new BatchProcessorService();

/**
 * POST /api/v1/face/detect
 * Detect faces in a single image
 */
router.post('/detect', async (req: Request, res: Response, next: NextFunction) => {
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

    const faces = await faceDetectionService.detectFaces(
      imageBuffer,
      metadata.width || 0,
      metadata.height || 0
    );

    logger.info('Face detection completed', {
      userId,
      faceCount: faces.length,
    });

    return res.json({
      success: true,
      data: {
        faces,
        imageMetadata: {
          width: metadata.width,
          height: metadata.height,
          format: metadata.format,
        },
      },
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * POST /api/v1/face/validate
 * Validate a face image for quality requirements
 */
router.post('/validate', async (req: Request, res: Response, next: NextFunction) => {
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

    const validationResult = await faceDetectionService.validateFace(
      imageBuffer,
      metadata.width || 0,
      metadata.height || 0
    );

    // Get detailed quality assessment if face was detected
    let qualityAssessment = null;
    if (validationResult.primaryFace && validationResult.pose) {
      qualityAssessment = faceQualityService.assessQuality(
        validationResult.primaryFace,
        metadata.width || 0,
        metadata.height || 0,
        validationResult.pose
      );
    }

    logger.info('Face validation completed', {
      userId,
      isValid: validationResult.isValid,
      faceDetected: validationResult.faceDetected,
    });

    return res.json({
      success: true,
      data: {
        validation: validationResult,
        qualityAssessment,
      },
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * POST /api/v1/face/preprocess
 * Preprocess a face image (crop, align, normalize)
 */
router.post('/preprocess', async (req: Request, res: Response, next: NextFunction) => {
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

    // First detect faces
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

    // Preprocess the face
    const { buffer, metadata: processMetadata } = await facePreprocessingService.preprocessFace(
      imageBuffer,
      primaryFace
    );

    logger.info('Face preprocessing completed', {
      userId,
      metadata: processMetadata,
    });

    return res.json({
      success: true,
      data: {
        processedImage: buffer.toString('base64'),
        metadata: processMetadata,
        originalFace: primaryFace,
      },
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * POST /api/v1/face/batch
 * Process multiple images in batch
 */
router.post('/batch', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { images, userId } = req.body;

    if (!images || !Array.isArray(images) || images.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'images array is required',
      });
    }

    if (images.length > 20) {
      return res.status(400).json({
        success: false,
        error: 'Maximum 20 images allowed per batch',
      });
    }

    const imageBuffers = images.map((img: string) => Buffer.from(img, 'base64'));
    const response = await batchProcessorService.processImages(imageBuffers, userId);

    logger.info('Batch processing completed', {
      userId,
      totalImages: images.length,
      validImages: response.summary.validFrames,
    });

    return res.json({
      success: true,
      data: response,
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * POST /api/v1/face/analyze
 * Detailed image analysis for quality metrics
 */
router.post('/analyze', async (req: Request, res: Response, next: NextFunction) => {
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

    // Analyze image quality
    const imageAnalysis = await faceQualityService.analyzeImage(imageBuffer);
    const blurScore = await faceQualityService.calculateBlurScore(imageBuffer);
    const lightingScore = await faceQualityService.calculateLightingScore(imageBuffer);

    // Detect faces
    const faces = await faceDetectionService.detectFaces(
      imageBuffer,
      metadata.width || 0,
      metadata.height || 0
    );

    logger.info('Image analysis completed', {
      userId,
      faceCount: faces.length,
      blurScore,
      lightingScore,
    });

    return res.json({
      success: true,
      data: {
        imageMetadata: {
          width: metadata.width,
          height: metadata.height,
          format: metadata.format,
          channels: metadata.channels,
          hasAlpha: metadata.hasAlpha,
        },
        imageAnalysis: {
          ...imageAnalysis,
          blurScore,
          lightingScore,
        },
        faceCount: faces.length,
        faces: faces.map((face) => ({
          faceId: face.faceId,
          confidence: face.confidence,
          isPrimary: face.isPrimary,
          boundingBox: face.boundingBox,
          quality: face.quality,
        })),
        thresholds: FACE_QUALITY_THRESHOLDS,
      },
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * POST /api/v1/face/landmarks
 * Extract 468 facial landmarks from image
 */
router.post('/landmarks', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { imageData, userId, faceIndex } = req.body;

    if (!imageData) {
      return res.status(400).json({
        success: false,
        error: 'imageData is required',
      });
    }

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

    const targetFace =
      faceIndex !== undefined ? faces[faceIndex] : faces.find((f) => f.isPrimary) || faces[0];

    if (!targetFace) {
      return res.status(400).json({
        success: false,
        error: 'Specified face not found',
      });
    }

    // Group landmarks by region
    const eyeLandmarks = faceDetectionService.getLandmarksByRegion(targetFace.landmarks, 'eyes');
    const noseLandmarks = faceDetectionService.getLandmarksByRegion(targetFace.landmarks, 'nose');
    const mouthLandmarks = faceDetectionService.getLandmarksByRegion(targetFace.landmarks, 'mouth');
    const contourLandmarks = faceDetectionService.getLandmarksByRegion(
      targetFace.landmarks,
      'contour'
    );

    // Calculate inter-pupillary distance
    const ipd = faceDetectionService.calculateIPD(targetFace.landmarks);

    logger.info('Landmark extraction completed', {
      userId,
      landmarkCount: targetFace.landmarks.length,
      ipd,
    });

    return res.json({
      success: true,
      data: {
        faceId: targetFace.faceId,
        totalLandmarks: targetFace.landmarks.length,
        interPupillaryDistance: ipd,
        landmarks: {
          all: targetFace.landmarks,
          byRegion: {
            eyes: eyeLandmarks,
            nose: noseLandmarks,
            mouth: mouthLandmarks,
            contour: contourLandmarks,
          },
        },
        boundingBox: targetFace.boundingBox,
      },
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * POST /api/v1/face/quality-check
 * Quick quality check with pass/fail result
 */
router.post('/quality-check', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { imageData, userId, strictMode } = req.body;

    if (!imageData) {
      return res.status(400).json({
        success: false,
        error: 'imageData is required',
      });
    }

    const imageBuffer = Buffer.from(imageData, 'base64');
    const metadata = await sharp(imageBuffer).metadata();

    const validationResult = await faceDetectionService.validateFace(
      imageBuffer,
      metadata.width || 0,
      metadata.height || 0
    );

    // Apply stricter thresholds if requested
    let passed = validationResult.isValid;
    if (strictMode && validationResult.primaryFace) {
      passed = passed && validationResult.primaryFace.quality.overallScore >= 80;
    }

    const qualityTier = validationResult.primaryFace
      ? faceQualityService.getQualityTier(validationResult.primaryFace.quality.overallScore)
      : 'poor';

    logger.info('Quality check completed', {
      userId,
      passed,
      qualityTier,
      strictMode: !!strictMode,
    });

    return res.json({
      success: true,
      data: {
        passed,
        qualityTier,
        faceDetected: validationResult.faceDetected,
        faceCount: validationResult.faceCount,
        overallScore: validationResult.primaryFace?.quality.overallScore || 0,
        confidence: validationResult.primaryFace?.confidence || 0,
        issues: validationResult.recommendations,
        processingTimeMs: validationResult.processingTimeMs,
      },
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * GET /api/v1/face/thresholds
 * Get current quality thresholds
 */
router.get('/thresholds', (_req: Request, res: Response) => {
  return res.json({
    success: true,
    data: {
      thresholds: FACE_QUALITY_THRESHOLDS,
      description: {
        MIN_CONFIDENCE: 'Minimum face detection confidence (0-1)',
        MIN_FACE_SIZE: 'Minimum face size in pixels',
        MIN_RESOLUTION: 'Minimum face resolution for quality processing',
        MAX_YAW: 'Maximum left-right head rotation in degrees',
        MAX_PITCH: 'Maximum up-down head rotation in degrees',
        MAX_ROLL: 'Maximum head tilt in degrees',
        MIN_BLUR_SCORE: 'Minimum image sharpness score (0-1)',
        MIN_LIGHTING_SCORE: 'Minimum lighting quality score (0-1)',
        MIN_OVERALL_QUALITY: 'Minimum overall quality score (0-100)',
      },
    },
  });
});

/**
 * GET /api/v1/face/health
 * Health check endpoint
 */
router.get('/health', (_req: Request, res: Response) => {
  return res.json({
    success: true,
    service: 'face-processing-service',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    capabilities: [
      'face-detection',
      'landmark-extraction',
      'quality-validation',
      'batch-processing',
      'face-preprocessing',
    ],
  });
});

export default router;
