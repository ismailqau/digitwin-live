import { FaceDetectionError } from '@clone/errors';
import { createLogger } from '@clone/logger';
import {
  FaceDetectionResult,
  FaceValidationResult,
  FaceQualityResult,
  FacePose,
  FacialKeypoint,
  FaceDetectionConfig,
  FACE_QUALITY_THRESHOLDS,
} from '@clone/shared-types';

import { MediaPipeAdapterService } from './mediapipe-adapter.service';

const logger = createLogger('face-detection-service');

// Default configuration
const DEFAULT_CONFIG: FaceDetectionConfig = {
  minConfidence: FACE_QUALITY_THRESHOLDS.MIN_CONFIDENCE,
  maxFaces: 10,
  minFaceSize: FACE_QUALITY_THRESHOLDS.MIN_FACE_SIZE,
  enableLandmarks: true,
  enableQualityMetrics: true,
};

/**
 * Face Detection Service
 * Handles face detection, 468 landmark extraction, and quality validation
 * Uses MediaPipe Face Mesh for accurate facial landmark extraction
 */
export class FaceDetectionService {
  private config: FaceDetectionConfig;
  private mediaPipeAdapter: MediaPipeAdapterService;

  constructor(config: Partial<FaceDetectionConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.mediaPipeAdapter = new MediaPipeAdapterService();
    logger.info('FaceDetectionService initialized', { config: this.config });
  }

  /**
   * Detect faces in an image buffer
   * Returns array of detected faces with 468 landmarks each
   */
  async detectFaces(
    imageBuffer: Buffer,
    imageWidth: number,
    imageHeight: number
  ): Promise<FaceDetectionResult[]> {
    const startTime = Date.now();

    try {
      // Use MediaPipe adapter for face detection
      const detections = await this.mediaPipeAdapter.detectFaces(
        imageBuffer,
        imageWidth,
        imageHeight
      );

      // Convert to FaceDetectionResult format
      const faces: FaceDetectionResult[] = detections.map((detection, index) => {
        const landmarks = this.mediaPipeAdapter.convertToKeypoints(
          detection.landmarks,
          imageWidth,
          imageHeight
        );

        const quality = this.mediaPipeAdapter.calculateQualityFromLandmarks(
          detection.landmarks,
          detection.boundingBox,
          imageWidth,
          imageHeight
        );

        return {
          faceId: `face_${Date.now()}_${index}`,
          boundingBox: detection.boundingBox,
          landmarks,
          confidence: detection.confidence,
          isPrimary: false,
          quality,
        };
      });

      // Filter by confidence and size thresholds
      const validFaces = faces.filter(
        (face) =>
          face.confidence >= this.config.minConfidence &&
          face.boundingBox.width >= this.config.minFaceSize &&
          face.boundingBox.height >= this.config.minFaceSize
      );

      // Limit to maxFaces
      const limitedFaces = validFaces.slice(0, this.config.maxFaces);

      // Mark primary face (largest by area)
      if (limitedFaces.length > 0) {
        const primaryIndex = this.findPrimaryFace(limitedFaces);
        limitedFaces.forEach((face, index) => {
          face.isPrimary = index === primaryIndex;
        });
      }

      logger.debug('Face detection completed', {
        totalDetected: detections.length,
        validFaces: validFaces.length,
        returnedFaces: limitedFaces.length,
        processingTimeMs: Date.now() - startTime,
      });

      return limitedFaces;
    } catch (error) {
      logger.error('Face detection failed', { error });
      throw new FaceDetectionError('Failed to detect faces in image', {
        originalError: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Validate a single face for quality requirements
   * Returns detailed validation result with recommendations
   */
  async validateFace(
    imageBuffer: Buffer,
    imageWidth: number,
    imageHeight: number
  ): Promise<FaceValidationResult> {
    const startTime = Date.now();
    const recommendations: string[] = [];

    try {
      const faces = await this.detectFaces(imageBuffer, imageWidth, imageHeight);

      if (faces.length === 0) {
        return {
          isValid: false,
          faceDetected: false,
          faceCount: 0,
          primaryFace: null,
          allFaces: [],
          quality: this.createEmptyQualityResult(imageWidth, imageHeight),
          pose: null,
          recommendations: [
            'No face detected. Please ensure your face is clearly visible and well-lit.',
          ],
          processingTimeMs: Date.now() - startTime,
        };
      }

      const primaryFace = faces.find((f) => f.isPrimary) || faces[0];
      const pose = this.calculatePose(primaryFace.landmarks);
      const quality = this.assessQuality(primaryFace, imageWidth, imageHeight, pose);

      // Generate detailed recommendations
      this.generateRecommendations(quality, primaryFace, pose, recommendations);

      const isValid = this.checkValidity(quality, primaryFace, pose);

      return {
        isValid,
        faceDetected: true,
        faceCount: faces.length,
        primaryFace,
        allFaces: faces,
        quality,
        pose,
        recommendations,
        processingTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      logger.error('Face validation failed', { error });
      throw new FaceDetectionError('Failed to validate face', {
        originalError: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Check if face meets all validity requirements
   */
  private checkValidity(
    quality: FaceQualityResult,
    face: FaceDetectionResult,
    pose: FacePose
  ): boolean {
    return (
      quality.clarity >= FACE_QUALITY_THRESHOLDS.MIN_BLUR_SCORE &&
      quality.lighting !== 'poor' &&
      face.confidence >= this.config.minConfidence &&
      face.quality.overallScore >= FACE_QUALITY_THRESHOLDS.MIN_OVERALL_QUALITY &&
      Math.abs(pose.yaw) <= FACE_QUALITY_THRESHOLDS.MAX_YAW &&
      Math.abs(pose.pitch) <= FACE_QUALITY_THRESHOLDS.MAX_PITCH &&
      Math.abs(pose.roll) <= FACE_QUALITY_THRESHOLDS.MAX_ROLL
    );
  }

  /**
   * Generate detailed recommendations based on quality assessment
   */
  private generateRecommendations(
    quality: FaceQualityResult,
    face: FaceDetectionResult,
    pose: FacePose,
    recommendations: string[]
  ): void {
    // Lighting recommendations
    if (quality.lighting === 'poor') {
      recommendations.push(
        'Lighting is too dark or uneven. Move to a well-lit area with even lighting on your face.'
      );
    } else if (quality.lighting === 'acceptable') {
      recommendations.push('Lighting could be improved. Consider facing a window or light source.');
    }

    // Angle/pose recommendations
    if (quality.angle !== 'frontal') {
      if (Math.abs(pose.yaw) > FACE_QUALITY_THRESHOLDS.MAX_YAW) {
        recommendations.push('Face is turned too far to the side. Look directly at the camera.');
      }
      if (Math.abs(pose.pitch) > FACE_QUALITY_THRESHOLDS.MAX_PITCH) {
        recommendations.push('Face is tilted up or down. Keep your head level with the camera.');
      }
      if (Math.abs(pose.roll) > FACE_QUALITY_THRESHOLDS.MAX_ROLL) {
        recommendations.push('Head is tilted to the side. Keep your head straight.');
      }
    }

    // Clarity/blur recommendations
    if (quality.clarity < FACE_QUALITY_THRESHOLDS.MIN_BLUR_SCORE) {
      recommendations.push('Image is blurry. Hold the camera steady or tap to focus on your face.');
    }

    // Confidence recommendations
    if (face.confidence < 0.9) {
      recommendations.push(
        'Face detection confidence is low. Ensure your full face is visible without obstructions.'
      );
    }

    // Resolution recommendations
    if (face.quality.resolutionScore < 0.7) {
      recommendations.push('Face is too small in the image. Move closer to the camera.');
    }

    // Occlusion recommendations
    if (face.quality.occlusionScore < 0.8) {
      recommendations.push(
        'Part of your face may be covered. Remove glasses, hats, or hair from your face.'
      );
    }
  }

  /**
   * Find the primary face (largest by area)
   */
  private findPrimaryFace(faces: FaceDetectionResult[]): number {
    let maxArea = 0;
    let primaryIndex = 0;

    faces.forEach((face, index) => {
      const area = face.boundingBox.width * face.boundingBox.height;
      if (area > maxArea) {
        maxArea = area;
        primaryIndex = index;
      }
    });

    return primaryIndex;
  }

  /**
   * Calculate face pose from 468 landmarks
   * Uses eye and nose positions for accurate pose estimation
   */
  private calculatePose(landmarks: FacialKeypoint[]): FacePose {
    // Find key landmarks for pose estimation
    const leftEye = landmarks.find((l) => l.landmark === 'left_eye_center');
    const rightEye = landmarks.find((l) => l.landmark === 'right_eye_center');
    const noseTip = landmarks.find((l) => l.landmark === 'nose_tip');
    const chin = landmarks.find((l) => l.landmark === 'chin');
    const forehead = landmarks.find((l) => l.landmark === 'forehead');

    if (!leftEye || !rightEye || !noseTip) {
      return { yaw: 0, pitch: 0, roll: 0 };
    }

    // Calculate roll from eye positions (head tilt)
    const eyeDeltaY = rightEye.y - leftEye.y;
    const eyeDeltaX = rightEye.x - leftEye.x;
    const roll = Math.atan2(eyeDeltaY, eyeDeltaX) * (180 / Math.PI);

    // Calculate yaw from nose position relative to eyes (left-right rotation)
    const eyeCenterX = (leftEye.x + rightEye.x) / 2;
    const noseOffset = noseTip.x - eyeCenterX;
    const eyeDistance = Math.abs(eyeDeltaX);
    const yaw = eyeDistance > 0 ? (noseOffset / eyeDistance) * 45 : 0;

    // Calculate pitch from vertical face proportions (up-down rotation)
    let pitch = 0;
    if (chin && forehead) {
      const faceHeight = chin.y - forehead.y;
      const noseVerticalPos = (noseTip.y - forehead.y) / faceHeight;
      // Normal nose position is around 0.55-0.6 of face height
      pitch = (noseVerticalPos - 0.55) * 60;
    } else {
      const eyeCenterY = (leftEye.y + rightEye.y) / 2;
      const noseVerticalOffset = noseTip.y - eyeCenterY;
      pitch = eyeDistance > 0 ? (noseVerticalOffset / eyeDistance - 0.5) * 30 : 0;
    }

    return {
      yaw: Math.round(yaw * 10) / 10,
      pitch: Math.round(pitch * 10) / 10,
      roll: Math.round(roll * 10) / 10,
    };
  }

  /**
   * Assess overall face quality
   */
  private assessQuality(
    face: FaceDetectionResult,
    imageWidth: number,
    imageHeight: number,
    pose: FacePose
  ): FaceQualityResult {
    const { quality } = face;

    // Determine lighting quality
    let lighting: 'good' | 'poor' | 'acceptable';
    if (quality.lightingScore >= 0.8) {
      lighting = 'good';
    } else if (quality.lightingScore >= FACE_QUALITY_THRESHOLDS.MIN_LIGHTING_SCORE) {
      lighting = 'acceptable';
    } else {
      lighting = 'poor';
    }

    // Determine angle based on pose
    let angle: 'frontal' | 'profile' | 'angled';
    const absYaw = Math.abs(pose.yaw);
    const absPitch = Math.abs(pose.pitch);
    const absRoll = Math.abs(pose.roll);

    if (
      absYaw <= FACE_QUALITY_THRESHOLDS.MAX_YAW &&
      absPitch <= FACE_QUALITY_THRESHOLDS.MAX_PITCH &&
      absRoll <= FACE_QUALITY_THRESHOLDS.MAX_ROLL
    ) {
      angle = 'frontal';
    } else if (absYaw > 60) {
      angle = 'profile';
    } else {
      angle = 'angled';
    }

    const recommendations: string[] = [];
    if (lighting === 'poor') {
      recommendations.push('Improve lighting conditions.');
    }
    if (angle !== 'frontal') {
      recommendations.push('Face the camera directly.');
    }
    if (quality.blurScore < FACE_QUALITY_THRESHOLDS.MIN_BLUR_SCORE) {
      recommendations.push('Image is blurry. Hold camera steady.');
    }

    const isValid =
      quality.overallScore >= FACE_QUALITY_THRESHOLDS.MIN_OVERALL_QUALITY &&
      lighting !== 'poor' &&
      angle === 'frontal';

    return {
      isValid,
      faceDetected: true,
      resolution: { width: imageWidth, height: imageHeight },
      lighting,
      angle,
      clarity: quality.blurScore,
      recommendations,
    };
  }

  /**
   * Create empty quality result for no-face scenarios
   */
  private createEmptyQualityResult(imageWidth: number, imageHeight: number): FaceQualityResult {
    return {
      isValid: false,
      faceDetected: false,
      resolution: { width: imageWidth, height: imageHeight },
      lighting: 'poor',
      angle: 'frontal',
      clarity: 0,
      recommendations: ['No face detected in the image.'],
    };
  }

  /**
   * Get specific landmark by name
   */
  getLandmarkByName(landmarks: FacialKeypoint[], name: string): FacialKeypoint | undefined {
    return landmarks.find((l) => l.landmark === name);
  }

  /**
   * Get landmarks for a specific facial region
   */
  getLandmarksByRegion(landmarks: FacialKeypoint[], region: string): FacialKeypoint[] {
    const regionPrefixes: Record<string, string[]> = {
      eyes: ['left_eye', 'right_eye'],
      nose: ['nose'],
      mouth: ['mouth', 'lip'],
      eyebrows: ['eyebrow'],
      contour: ['chin', 'cheek', 'jaw', 'forehead'],
    };

    const prefixes = regionPrefixes[region] || [];
    return landmarks.filter((l) => prefixes.some((prefix) => l.landmark.includes(prefix)));
  }

  /**
   * Calculate inter-pupillary distance (IPD)
   * Useful for face normalization
   */
  calculateIPD(landmarks: FacialKeypoint[]): number {
    const leftEye = this.getLandmarkByName(landmarks, 'left_eye_center');
    const rightEye = this.getLandmarkByName(landmarks, 'right_eye_center');

    if (!leftEye || !rightEye) {
      return 0;
    }

    return Math.sqrt(Math.pow(rightEye.x - leftEye.x, 2) + Math.pow(rightEye.y - leftEye.y, 2));
  }

  /**
   * Dispose resources
   */
  async dispose(): Promise<void> {
    await this.mediaPipeAdapter.dispose();
    logger.info('FaceDetectionService disposed');
  }
}
