import { FaceProcessingError } from '@clone/errors';
import { createLogger } from '@clone/logger';
import {
  FaceValidationResult,
  BatchFaceDetectionResult,
  FaceProcessingResponse,
  FaceDetectionConfig,
} from '@clone/shared-types';
import sharp from 'sharp';

import { FaceDetectionService } from './face-detection.service';

const logger = createLogger('batch-processor-service');

export interface BatchProcessingConfig {
  maxConcurrent: number;
  frameInterval: number; // For video: process every N frames
  minFrameQuality: number;
}

const DEFAULT_CONFIG: BatchProcessingConfig = {
  maxConcurrent: 4,
  frameInterval: 5,
  minFrameQuality: 60,
};

/**
 * Batch Processor Service
 * Handles batch processing of multiple images or video frames
 */
export class BatchProcessorService {
  private config: BatchProcessingConfig;
  private faceDetectionService: FaceDetectionService;

  constructor(
    faceDetectionConfig?: Partial<FaceDetectionConfig>,
    batchConfig?: Partial<BatchProcessingConfig>
  ) {
    this.config = { ...DEFAULT_CONFIG, ...batchConfig };
    this.faceDetectionService = new FaceDetectionService(faceDetectionConfig);
    logger.info('BatchProcessorService initialized', { config: this.config });
  }

  /**
   * Process multiple images in batch
   */
  async processImages(images: Buffer[], userId: string): Promise<FaceProcessingResponse> {
    const startTime = Date.now();
    const results: FaceValidationResult[] = [];
    const batchResults: BatchFaceDetectionResult[] = [];

    logger.info('Starting batch image processing', {
      userId,
      imageCount: images.length,
    });

    // Process images in batches
    for (let i = 0; i < images.length; i += this.config.maxConcurrent) {
      const batch = images.slice(i, i + this.config.maxConcurrent);
      const batchPromises = batch.map(async (imageBuffer, batchIndex) => {
        const frameIndex = i + batchIndex;
        try {
          const metadata = await sharp(imageBuffer).metadata();
          const width = metadata.width || 0;
          const height = metadata.height || 0;

          const result = await this.faceDetectionService.validateFace(imageBuffer, width, height);

          return {
            frameIndex,
            timestamp: Date.now(),
            result,
          };
        } catch (error) {
          logger.error('Failed to process image', { frameIndex, error });
          return {
            frameIndex,
            timestamp: Date.now(),
            result: this.createErrorResult(error),
          };
        }
      });

      const batchResultsChunk = await Promise.all(batchPromises);
      batchResults.push(...batchResultsChunk);
      results.push(...batchResultsChunk.map((br) => br.result));
    }

    const summary = this.calculateSummary(batchResults);

    const response: FaceProcessingResponse = {
      requestId: `batch_${Date.now()}`,
      userId,
      status: this.determineStatus(results),
      results,
      batchResults,
      summary,
      processingTimeMs: Date.now() - startTime,
    };

    logger.info('Batch processing completed', {
      userId,
      totalFrames: images.length,
      validFrames: summary.validFrames,
      processingTimeMs: response.processingTimeMs,
    });

    return response;
  }

  /**
   * Extract and process frames from video buffer
   */
  async processVideo(videoBuffer: Buffer, userId: string): Promise<FaceProcessingResponse> {
    logger.info('Starting video processing', { userId });

    try {
      // Extract frames from video
      const frames = await this.extractVideoFrames(videoBuffer);

      // Sample frames based on interval
      const sampledFrames = frames.filter((_, index) => index % this.config.frameInterval === 0);

      logger.debug('Frames extracted', {
        totalFrames: frames.length,
        sampledFrames: sampledFrames.length,
      });

      // Process sampled frames
      const response = await this.processImages(sampledFrames, userId);
      response.summary.totalFrames = frames.length;

      return response;
    } catch (error) {
      logger.error('Video processing failed', { error });
      throw new FaceProcessingError('Failed to process video', {
        originalError: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Extract frames from video buffer
   * In production, use ffmpeg or similar
   */
  private async extractVideoFrames(_videoBuffer: Buffer): Promise<Buffer[]> {
    // Simulated frame extraction
    // In production, use fluent-ffmpeg or similar library
    logger.warn('Video frame extraction is simulated in development');

    // Return empty array - in production this would extract actual frames
    return [];
  }

  /**
   * Calculate summary statistics from batch results
   */
  private calculateSummary(batchResults: BatchFaceDetectionResult[]): {
    totalFrames: number;
    validFrames: number;
    averageQuality: number;
    bestFrameIndex: number;
  } {
    const validResults = batchResults.filter((br) => br.result.isValid);
    const qualityScores = batchResults
      .filter((br) => br.result.primaryFace)
      .map((br) => br.result.primaryFace!.quality.overallScore);

    let bestFrameIndex = 0;
    let bestQuality = 0;

    batchResults.forEach((br, index) => {
      if (br.result.primaryFace) {
        const quality = br.result.primaryFace.quality.overallScore;
        if (quality > bestQuality) {
          bestQuality = quality;
          bestFrameIndex = index;
        }
      }
    });

    return {
      totalFrames: batchResults.length,
      validFrames: validResults.length,
      averageQuality:
        qualityScores.length > 0
          ? qualityScores.reduce((a, b) => a + b, 0) / qualityScores.length
          : 0,
      bestFrameIndex,
    };
  }

  /**
   * Determine overall processing status
   */
  private determineStatus(results: FaceValidationResult[]): 'success' | 'partial' | 'failed' {
    const validCount = results.filter((r) => r.isValid).length;

    if (validCount === results.length) {
      return 'success';
    } else if (validCount > 0) {
      return 'partial';
    } else {
      return 'failed';
    }
  }

  /**
   * Create error result for failed processing
   */
  private createErrorResult(error: unknown): FaceValidationResult {
    return {
      isValid: false,
      faceDetected: false,
      faceCount: 0,
      primaryFace: null,
      allFaces: [],
      quality: {
        isValid: false,
        faceDetected: false,
        resolution: { width: 0, height: 0 },
        lighting: 'poor',
        angle: 'frontal',
        clarity: 0,
        recommendations: [error instanceof Error ? error.message : 'Processing failed'],
      },
      pose: null,
      recommendations: ['Failed to process image. Please try again.'],
      processingTimeMs: 0,
    };
  }
}
