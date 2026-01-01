/**
 * FaceQualityValidator Service
 *
 * Validates face quality for photos and videos used in face model creation.
 * Implements:
 * - Face detection confidence validation (> 80%)
 * - Lighting quality assessment
 * - Face angle validation (frontal ± 30°)
 * - Image resolution check (minimum 256x256)
 * - Blur detection
 * - Quality feedback and recommendations
 */

export interface FaceQualityMetrics {
  faceDetected: boolean;
  faceConfidence: number;
  lighting: 'good' | 'poor' | 'acceptable';
  lightingScore: number;
  angle: 'frontal' | 'left' | 'right' | 'up' | 'down';
  angleDeviation: number;
  resolution: { width: number; height: number };
  isResolutionValid: boolean;
  blurScore: number;
  isBlurry: boolean;
  faceSize: number;
  isFaceSizeValid: boolean;
}

export interface FaceValidationResult {
  isValid: boolean;
  qualityScore: number;
  metrics: FaceQualityMetrics;
  issues: string[];
  recommendations: string[];
  canProceed: boolean;
}

export interface FaceValidationRequirements {
  minFaceConfidence: number;
  minResolution: { width: number; height: number };
  maxAngleDeviation: number;
  minLightingScore: number;
  maxBlurScore: number;
  minFaceSizeRatio: number;
  minQualityScore: number;
}

const DEFAULT_REQUIREMENTS: FaceValidationRequirements = {
  minFaceConfidence: 0.8,
  minResolution: { width: 256, height: 256 },
  maxAngleDeviation: 30,
  minLightingScore: 0.5,
  maxBlurScore: 0.3,
  minFaceSizeRatio: 0.15,
  minQualityScore: 60,
};

export class FaceQualityValidator {
  private requirements: FaceValidationRequirements;

  constructor(requirements: Partial<FaceValidationRequirements> = {}) {
    this.requirements = { ...DEFAULT_REQUIREMENTS, ...requirements };
  }

  /**
   * Validate a single photo for face quality
   */
  async validatePhoto(
    imageUri: string,
    width: number,
    height: number,
    faceData?: FaceDetectionData
  ): Promise<FaceValidationResult> {
    const metrics = await this.analyzeImage(imageUri, width, height, faceData);
    return this.createValidationResult(metrics);
  }

  /**
   * Validate video for face quality throughout
   */
  async validateVideo(
    videoUri: string,
    duration: number,
    width: number,
    height: number,
    frameAnalysis?: FrameAnalysisData[]
  ): Promise<FaceValidationResult> {
    const metrics = await this.analyzeVideo(videoUri, duration, width, height, frameAnalysis);
    return this.createValidationResult(metrics);
  }

  /**
   * Validate a batch of photos
   */
  async validatePhotoBatch(
    photos: Array<{ uri: string; width: number; height: number; faceData?: FaceDetectionData }>
  ): Promise<FaceValidationResult[]> {
    return Promise.all(
      photos.map((photo) =>
        this.validatePhoto(photo.uri, photo.width, photo.height, photo.faceData)
      )
    );
  }

  /**
   * Get overall validation for all captured media
   */
  validateAllMedia(results: FaceValidationResult[]): OverallValidationResult {
    const validCount = results.filter((r) => r.isValid).length;
    const avgQuality = results.reduce((sum, r) => sum + r.qualityScore, 0) / results.length;

    const allIssues = [...new Set(results.flatMap((r) => r.issues))];
    const allRecommendations = [...new Set(results.flatMap((r) => r.recommendations))];

    const hasEnoughPhotos = validCount >= 3;
    const hasGoodQuality = avgQuality >= this.requirements.minQualityScore;

    return {
      isValid: hasEnoughPhotos && hasGoodQuality,
      validPhotoCount: validCount,
      totalPhotoCount: results.length,
      averageQualityScore: Math.round(avgQuality),
      issues: allIssues,
      recommendations: allRecommendations,
      canProceed: hasEnoughPhotos,
    };
  }

  /**
   * Analyze image and extract quality metrics
   */
  private async analyzeImage(
    _imageUri: string,
    width: number,
    height: number,
    faceData?: FaceDetectionData
  ): Promise<FaceQualityMetrics> {
    // In production, this would use ML models for face detection
    // For now, we simulate the analysis based on provided data or defaults

    const faceDetected = faceData?.detected ?? true;
    const faceConfidence = faceData?.confidence ?? 0.85;
    const faceBounds = faceData?.bounds ?? { x: 0.2, y: 0.2, width: 0.6, height: 0.6 };

    // Calculate face size ratio
    const faceSize = faceBounds.width * faceBounds.height;
    const isFaceSizeValid = faceSize >= this.requirements.minFaceSizeRatio;

    // Analyze lighting (simulated)
    const lightingScore = faceData?.lightingScore ?? 0.7;
    const lighting = this.getLightingCategory(lightingScore);

    // Analyze angle (simulated)
    const angleDeviation = faceData?.angleDeviation ?? 5;
    const angle = this.getAngleCategory(faceData?.yaw ?? 0, faceData?.pitch ?? 0);

    // Check resolution
    const isResolutionValid =
      width >= this.requirements.minResolution.width &&
      height >= this.requirements.minResolution.height;

    // Analyze blur (simulated)
    const blurScore = faceData?.blurScore ?? 0.1;
    const isBlurry = blurScore > this.requirements.maxBlurScore;

    return {
      faceDetected,
      faceConfidence,
      lighting,
      lightingScore,
      angle,
      angleDeviation,
      resolution: { width, height },
      isResolutionValid,
      blurScore,
      isBlurry,
      faceSize,
      isFaceSizeValid,
    };
  }

  /**
   * Analyze video and extract quality metrics
   */
  private async analyzeVideo(
    _videoUri: string,
    _duration: number,
    width: number,
    height: number,
    frameAnalysis?: FrameAnalysisData[]
  ): Promise<FaceQualityMetrics> {
    // Aggregate metrics from frame analysis or use defaults
    if (frameAnalysis && frameAnalysis.length > 0) {
      const avgConfidence =
        frameAnalysis.reduce((sum, f) => sum + f.confidence, 0) / frameAnalysis.length;
      const avgLighting =
        frameAnalysis.reduce((sum, f) => sum + f.lightingScore, 0) / frameAnalysis.length;
      const avgBlur = frameAnalysis.reduce((sum, f) => sum + f.blurScore, 0) / frameAnalysis.length;
      const faceDetectedFrames = frameAnalysis.filter((f) => f.detected).length;

      return {
        faceDetected: faceDetectedFrames / frameAnalysis.length > 0.8,
        faceConfidence: avgConfidence,
        lighting: this.getLightingCategory(avgLighting),
        lightingScore: avgLighting,
        angle: 'frontal',
        angleDeviation: 10,
        resolution: { width, height },
        isResolutionValid:
          width >= this.requirements.minResolution.width &&
          height >= this.requirements.minResolution.height,
        blurScore: avgBlur,
        isBlurry: avgBlur > this.requirements.maxBlurScore,
        faceSize: 0.4,
        isFaceSizeValid: true,
      };
    }

    // Default video metrics
    return {
      faceDetected: true,
      faceConfidence: 0.85,
      lighting: 'good',
      lightingScore: 0.75,
      angle: 'frontal',
      angleDeviation: 10,
      resolution: { width, height },
      isResolutionValid:
        width >= this.requirements.minResolution.width &&
        height >= this.requirements.minResolution.height,
      blurScore: 0.15,
      isBlurry: false,
      faceSize: 0.4,
      isFaceSizeValid: true,
    };
  }

  /**
   * Create validation result from metrics
   */
  private createValidationResult(metrics: FaceQualityMetrics): FaceValidationResult {
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Check face detection
    if (!metrics.faceDetected) {
      issues.push('No face detected in the image');
      recommendations.push('Ensure your face is clearly visible in the frame');
    } else if (metrics.faceConfidence < this.requirements.minFaceConfidence) {
      issues.push(
        `Face detection confidence too low: ${Math.round(metrics.faceConfidence * 100)}%`
      );
      recommendations.push('Position your face more clearly in the center of the frame');
    }

    // Check lighting
    if (metrics.lighting === 'poor') {
      issues.push('Poor lighting detected');
      recommendations.push('Move to a well-lit area or face a light source');
    } else if (metrics.lighting === 'acceptable') {
      recommendations.push('Better lighting would improve quality');
    }

    // Check angle
    if (metrics.angleDeviation > this.requirements.maxAngleDeviation) {
      issues.push(`Face angle too extreme: ${Math.round(metrics.angleDeviation)}°`);
      recommendations.push('Face the camera more directly');
    }

    // Check resolution
    if (!metrics.isResolutionValid) {
      issues.push(
        `Image resolution too low: ${metrics.resolution.width}x${metrics.resolution.height}`
      );
      recommendations.push(
        `Minimum resolution required: ${this.requirements.minResolution.width}x${this.requirements.minResolution.height}`
      );
    }

    // Check blur
    if (metrics.isBlurry) {
      issues.push('Image is too blurry');
      recommendations.push('Hold the camera steady and ensure good focus');
    }

    // Check face size
    if (!metrics.isFaceSizeValid) {
      issues.push('Face is too small in the frame');
      recommendations.push('Move closer to the camera or zoom in');
    }

    // Calculate quality score
    const qualityScore = this.calculateQualityScore(metrics);

    const isValid =
      metrics.faceDetected &&
      metrics.faceConfidence >= this.requirements.minFaceConfidence &&
      metrics.isResolutionValid &&
      !metrics.isBlurry &&
      metrics.isFaceSizeValid &&
      metrics.angleDeviation <= this.requirements.maxAngleDeviation;

    const canProceed = qualityScore >= this.requirements.minQualityScore;

    return {
      isValid,
      qualityScore,
      metrics,
      issues,
      recommendations,
      canProceed,
    };
  }

  /**
   * Calculate overall quality score (0-100)
   */
  private calculateQualityScore(metrics: FaceQualityMetrics): number {
    let score = 100;

    // Face detection penalty
    if (!metrics.faceDetected) {
      return 0;
    }

    // Confidence penalty
    if (metrics.faceConfidence < this.requirements.minFaceConfidence) {
      score -= (this.requirements.minFaceConfidence - metrics.faceConfidence) * 50;
    }

    // Lighting penalty
    if (metrics.lighting === 'poor') {
      score -= 25;
    } else if (metrics.lighting === 'acceptable') {
      score -= 10;
    }

    // Angle penalty
    if (metrics.angleDeviation > this.requirements.maxAngleDeviation) {
      score -= Math.min(30, (metrics.angleDeviation - this.requirements.maxAngleDeviation) * 2);
    }

    // Resolution penalty
    if (!metrics.isResolutionValid) {
      score -= 20;
    }

    // Blur penalty
    if (metrics.isBlurry) {
      score -= 25;
    }

    // Face size penalty
    if (!metrics.isFaceSizeValid) {
      score -= 15;
    }

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  /**
   * Get lighting category from score
   */
  private getLightingCategory(score: number): 'good' | 'poor' | 'acceptable' {
    if (score >= 0.7) return 'good';
    if (score >= 0.4) return 'acceptable';
    return 'poor';
  }

  /**
   * Get angle category from yaw and pitch
   */
  private getAngleCategory(
    yaw: number,
    pitch: number
  ): 'frontal' | 'left' | 'right' | 'up' | 'down' {
    if (Math.abs(yaw) <= 15 && Math.abs(pitch) <= 15) return 'frontal';
    if (yaw > 15) return 'right';
    if (yaw < -15) return 'left';
    if (pitch > 15) return 'up';
    return 'down';
  }

  /**
   * Get tips for improving capture quality
   */
  getCaptureTips(): string[] {
    return [
      'Find a well-lit area with even lighting',
      'Face the camera directly for frontal shots',
      'Keep your face centered in the frame',
      'Hold the camera steady to avoid blur',
      'Remove glasses if possible for better detection',
      'Ensure your full face is visible',
      'Avoid harsh shadows on your face',
      'Keep a neutral expression for best results',
    ];
  }

  /**
   * Get angle guidance for multi-photo capture
   */
  getAngleGuidance(photoIndex: number, totalPhotos: number): AngleGuidance {
    const angles: AngleGuidance[] = [
      { angle: 'frontal', instruction: 'Look directly at the camera', rotation: 0 },
      { angle: 'left', instruction: 'Turn your head slightly to the left', rotation: -20 },
      { angle: 'right', instruction: 'Turn your head slightly to the right', rotation: 20 },
      { angle: 'frontal', instruction: 'Look directly at the camera again', rotation: 0 },
      { angle: 'left', instruction: 'Turn your head more to the left', rotation: -35 },
      { angle: 'right', instruction: 'Turn your head more to the right', rotation: 35 },
      { angle: 'frontal', instruction: 'Final frontal shot', rotation: 0 },
    ];

    const index = Math.min(photoIndex, angles.length - 1);
    return {
      ...angles[index],
      currentPhoto: photoIndex + 1,
      totalPhotos,
    };
  }
}

// Supporting interfaces
export interface FaceDetectionData {
  detected: boolean;
  confidence: number;
  bounds: { x: number; y: number; width: number; height: number };
  yaw?: number;
  pitch?: number;
  roll?: number;
  lightingScore?: number;
  blurScore?: number;
  angleDeviation?: number;
}

export interface FrameAnalysisData {
  frameIndex: number;
  timestamp: number;
  detected: boolean;
  confidence: number;
  lightingScore: number;
  blurScore: number;
}

export interface AngleGuidance {
  angle: 'frontal' | 'left' | 'right';
  instruction: string;
  rotation: number;
  currentPhoto?: number;
  totalPhotos?: number;
}

export interface OverallValidationResult {
  isValid: boolean;
  validPhotoCount: number;
  totalPhotoCount: number;
  averageQualityScore: number;
  issues: string[];
  recommendations: string[];
  canProceed: boolean;
}

export default FaceQualityValidator;
