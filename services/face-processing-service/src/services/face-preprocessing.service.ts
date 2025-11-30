import { FaceProcessingError } from '@clone/errors';
import { createLogger } from '@clone/logger';
import { FaceDetectionResult, BoundingBox, FacialKeypoint } from '@clone/shared-types';
import sharp from 'sharp';

const logger = createLogger('face-preprocessing-service');

export interface CroppedFace {
  buffer: Buffer;
  boundingBox: BoundingBox;
  padding: number;
}

export interface AlignedFace {
  buffer: Buffer;
  transformMatrix: number[][];
  landmarks: FacialKeypoint[];
}

export interface PreprocessingConfig {
  targetSize: number;
  padding: number;
  alignFace: boolean;
  normalizeColors: boolean;
}

const DEFAULT_CONFIG: PreprocessingConfig = {
  targetSize: 512,
  padding: 0.2,
  alignFace: true,
  normalizeColors: true,
};

/**
 * Face Preprocessing Service
 * Handles face cropping, alignment, and normalization
 */
export class FacePreprocessingService {
  private config: PreprocessingConfig;

  constructor(config: Partial<PreprocessingConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    logger.info('FacePreprocessingService initialized', { config: this.config });
  }

  /**
   * Crop face from image with padding
   */
  async cropFace(
    imageBuffer: Buffer,
    face: FaceDetectionResult,
    padding?: number
  ): Promise<CroppedFace> {
    const actualPadding = padding ?? this.config.padding;

    try {
      const image = sharp(imageBuffer);
      const metadata = await image.metadata();

      if (!metadata.width || !metadata.height) {
        throw new FaceProcessingError('Unable to read image dimensions');
      }

      const { x, y, width, height } = face.boundingBox;

      // Calculate padded bounding box
      const paddingX = width * actualPadding;
      const paddingY = height * actualPadding;

      const cropX = Math.max(0, Math.floor(x - paddingX));
      const cropY = Math.max(0, Math.floor(y - paddingY));
      const cropWidth = Math.min(metadata.width - cropX, Math.ceil(width + paddingX * 2));
      const cropHeight = Math.min(metadata.height - cropY, Math.ceil(height + paddingY * 2));

      const croppedBuffer = await image
        .extract({
          left: cropX,
          top: cropY,
          width: cropWidth,
          height: cropHeight,
        })
        .resize(this.config.targetSize, this.config.targetSize, {
          fit: 'cover',
          position: 'center',
        })
        .toBuffer();

      logger.debug('Face cropped successfully', {
        originalSize: { width: metadata.width, height: metadata.height },
        cropRegion: { x: cropX, y: cropY, width: cropWidth, height: cropHeight },
        targetSize: this.config.targetSize,
      });

      return {
        buffer: croppedBuffer,
        boundingBox: { x: cropX, y: cropY, width: cropWidth, height: cropHeight },
        padding: actualPadding,
      };
    } catch (error) {
      logger.error('Face cropping failed', { error });
      throw new FaceProcessingError('Failed to crop face from image', {
        originalError: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Align face based on eye positions
   */
  async alignFace(imageBuffer: Buffer, face: FaceDetectionResult): Promise<AlignedFace> {
    try {
      const leftEye = face.landmarks.find(
        (l: { landmark: string }) => l.landmark === 'left_eye_center'
      );
      const rightEye = face.landmarks.find(
        (l: { landmark: string }) => l.landmark === 'right_eye_center'
      );

      if (!leftEye || !rightEye) {
        logger.warn('Eye landmarks not found, skipping alignment');
        return {
          buffer: imageBuffer,
          transformMatrix: [
            [1, 0, 0],
            [0, 1, 0],
          ],
          landmarks: face.landmarks,
        };
      }

      // Calculate rotation angle
      const deltaY = rightEye.y - leftEye.y;
      const deltaX = rightEye.x - leftEye.x;
      const angle = Math.atan2(deltaY, deltaX) * (180 / Math.PI);

      // Rotate image to align eyes horizontally
      const image = sharp(imageBuffer);
      const metadata = await image.metadata();

      if (!metadata.width || !metadata.height) {
        throw new FaceProcessingError('Unable to read image dimensions');
      }

      const alignedBuffer = await image
        .rotate(-angle, {
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .toBuffer();

      // Calculate transformation matrix
      const cosA = Math.cos((-angle * Math.PI) / 180);
      const sinA = Math.sin((-angle * Math.PI) / 180);
      const transformMatrix = [
        [cosA, -sinA, 0],
        [sinA, cosA, 0],
      ];

      // Transform landmarks
      const centerX = metadata.width / 2;
      const centerY = metadata.height / 2;
      const transformedLandmarks = face.landmarks.map(
        (lm: { x: number; y: number; confidence: number; landmark: string }) => {
          const dx = lm.x - centerX;
          const dy = lm.y - centerY;
          return {
            ...lm,
            x: centerX + dx * cosA - dy * sinA,
            y: centerY + dx * sinA + dy * cosA,
          };
        }
      );

      logger.debug('Face aligned successfully', { rotationAngle: angle });

      return {
        buffer: alignedBuffer,
        transformMatrix,
        landmarks: transformedLandmarks,
      };
    } catch (error) {
      logger.error('Face alignment failed', { error });
      throw new FaceProcessingError('Failed to align face', {
        originalError: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Normalize image colors and contrast
   */
  async normalizeImage(imageBuffer: Buffer): Promise<Buffer> {
    try {
      const normalizedBuffer = await sharp(imageBuffer)
        .normalize()
        .modulate({
          brightness: 1,
          saturation: 1,
        })
        .toBuffer();

      logger.debug('Image normalized successfully');
      return normalizedBuffer;
    } catch (error) {
      logger.error('Image normalization failed', { error });
      throw new FaceProcessingError('Failed to normalize image', {
        originalError: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Full preprocessing pipeline
   */
  async preprocessFace(
    imageBuffer: Buffer,
    face: FaceDetectionResult
  ): Promise<{ buffer: Buffer; metadata: Record<string, unknown> }> {
    let processedBuffer = imageBuffer;
    const metadata: Record<string, unknown> = {};

    // Step 1: Align face
    if (this.config.alignFace) {
      const aligned = await this.alignFace(processedBuffer, face);
      processedBuffer = aligned.buffer;
      metadata.transformMatrix = aligned.transformMatrix;
    }

    // Step 2: Crop face
    const cropped = await this.cropFace(processedBuffer, face);
    processedBuffer = cropped.buffer;
    metadata.cropRegion = cropped.boundingBox;
    metadata.padding = cropped.padding;

    // Step 3: Normalize colors
    if (this.config.normalizeColors) {
      processedBuffer = await this.normalizeImage(processedBuffer);
      metadata.normalized = true;
    }

    metadata.targetSize = this.config.targetSize;

    return { buffer: processedBuffer, metadata };
  }
}
