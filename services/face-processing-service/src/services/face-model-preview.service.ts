import { FaceProcessingError } from '@clone/errors';
import { createLogger } from '@clone/logger';
import { FaceModel } from '@clone/shared-types';

const logger = createLogger('face-model-preview-service');

/**
 * Preview generation result
 */
export interface PreviewResult {
  previewId: string;
  modelId: string;
  videoData?: string; // base64 encoded
  thumbnailData?: string; // base64 encoded
  duration: number;
  frameCount: number;
  generationTimeMs: number;
  quality: PreviewQuality;
}

/**
 * Preview quality metrics
 */
export interface PreviewQuality {
  overallScore: number;
  lipSyncScore: number;
  faceQuality: number;
  smoothness: number;
  recommendations: string[];
}

/**
 * A/B test comparison result
 */
export interface ModelComparisonResult {
  comparisonId: string;
  modelA: {
    modelId: string;
    preview: PreviewResult;
  };
  modelB: {
    modelId: string;
    preview: PreviewResult;
  };
  winner: 'A' | 'B' | 'tie';
  metrics: ComparisonMetrics;
}

/**
 * Comparison metrics
 */
export interface ComparisonMetrics {
  qualityDifference: number;
  lipSyncDifference: number;
  speedDifference: number;
  recommendation: string;
}

/**
 * Model validation result
 */
export interface ModelValidationResult {
  isValid: boolean;
  validationId: string;
  modelId: string;
  checks: ValidationCheck[];
  overallScore: number;
  canActivate: boolean;
  recommendations: string[];
}

/**
 * Individual validation check
 */
export interface ValidationCheck {
  name: string;
  passed: boolean;
  score: number;
  message: string;
}

/**
 * Model recommendation
 */
export interface ModelRecommendation {
  type: 'improvement' | 'warning' | 'info';
  category: 'quality' | 'lighting' | 'expression' | 'resolution' | 'samples';
  message: string;
  priority: 'high' | 'medium' | 'low';
  actionable: boolean;
}

/**
 * Preview configuration
 */
export interface PreviewConfig {
  defaultDuration: number;
  defaultFrameRate: number;
  thumbnailSize: { width: number; height: number };
  minQualityForApproval: number;
  sampleAudioDuration: number;
}

const DEFAULT_CONFIG: PreviewConfig = {
  defaultDuration: 5000, // 5 seconds
  defaultFrameRate: 20,
  thumbnailSize: { width: 256, height: 256 },
  minQualityForApproval: 70,
  sampleAudioDuration: 3000, // 3 seconds
};

/**
 * Sample audio for testing
 */
const SAMPLE_AUDIO_TEXTS = [
  'Hello, this is a test of my digital clone.',
  'The quick brown fox jumps over the lazy dog.',
  'How are you doing today? I hope everything is going well.',
];

/**
 * Face Model Preview Service
 * Handles preview generation, A/B testing, and model validation
 */
export class FaceModelPreviewService {
  private config: PreviewConfig;

  // In-memory storage for previews and validations
  private previews: Map<string, PreviewResult> = new Map();
  private validations: Map<string, ModelValidationResult> = new Map();
  private comparisons: Map<string, ModelComparisonResult> = new Map();

  constructor(config: Partial<PreviewConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    logger.info('FaceModelPreviewService initialized', { config: this.config });
  }

  /**
   * Generate preview video for a face model
   */
  async generatePreview(
    model: FaceModel,
    options: { duration?: number; audioText?: string } = {}
  ): Promise<PreviewResult> {
    const startTime = Date.now();
    const duration = options.duration || this.config.defaultDuration;
    const audioText = options.audioText || this.getRandomSampleText();

    try {
      // In production, this would:
      // 1. Generate TTS audio from audioText
      // 2. Run lip-sync model to generate video frames
      // 3. Encode video and return
      logger.debug('Generating preview with audio text', { audioText: audioText.substring(0, 20) });

      const frameCount = Math.floor((duration / 1000) * this.config.defaultFrameRate);

      // Simulate preview generation
      const quality = this.assessPreviewQuality(model, frameCount);

      const previewId = `preview_${model.id}_${Date.now()}`;
      const preview: PreviewResult = {
        previewId,
        modelId: model.id,
        videoData: this.generateMockVideoData(model, frameCount),
        thumbnailData: this.generateMockThumbnail(model),
        duration,
        frameCount,
        generationTimeMs: Date.now() - startTime,
        quality,
      };

      this.previews.set(previewId, preview);

      logger.info('Preview generated', {
        previewId,
        modelId: model.id,
        duration,
        frameCount,
        qualityScore: quality.overallScore,
      });

      return preview;
    } catch (error) {
      logger.error('Failed to generate preview', { modelId: model.id, error });
      throw new FaceProcessingError('Preview generation failed', {
        originalError: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Get random sample text for preview
   */
  private getRandomSampleText(): string {
    return SAMPLE_AUDIO_TEXTS[Math.floor(Math.random() * SAMPLE_AUDIO_TEXTS.length)];
  }

  /**
   * Generate mock video data (placeholder for actual video generation)
   */
  private generateMockVideoData(_model: FaceModel, _frameCount: number): string {
    // In production, this would be actual video data
    return 'mock_video_base64_data';
  }

  /**
   * Generate mock thumbnail
   */
  private generateMockThumbnail(_model: FaceModel): string {
    // In production, this would be actual thumbnail
    return 'mock_thumbnail_base64_data';
  }

  /**
   * Assess preview quality
   */
  private assessPreviewQuality(model: FaceModel, _frameCount: number): PreviewQuality {
    const recommendations: string[] = [];

    // Calculate lip-sync score based on expression templates
    const lipSyncScore = model.expressionTemplates.length >= 3 ? 85 : 60;
    if (lipSyncScore < 70) {
      recommendations.push('Add more expression samples for better lip-sync');
    }

    // Calculate face quality based on keypoints
    const avgKeypointConfidence =
      model.keypoints.length > 0
        ? model.keypoints.reduce(
            (sum: number, k: { confidence: number }) => sum + k.confidence,
            0
          ) / model.keypoints.length
        : 0;
    const faceQuality = avgKeypointConfidence * 100;
    if (faceQuality < 80) {
      recommendations.push('Use higher quality face images');
    }

    // Calculate smoothness based on embedding consistency
    const smoothness = model.embeddings.length >= 3 ? 80 : 60;
    if (smoothness < 70) {
      recommendations.push('Add more face samples for smoother animation');
    }

    const overallScore = (lipSyncScore + faceQuality + smoothness) / 3;

    return {
      overallScore: Math.round(overallScore),
      lipSyncScore: Math.round(lipSyncScore),
      faceQuality: Math.round(faceQuality),
      smoothness: Math.round(smoothness),
      recommendations,
    };
  }

  /**
   * Compare two face models (A/B testing)
   */
  async compareModels(
    modelA: FaceModel,
    modelB: FaceModel,
    options: { audioText?: string } = {}
  ): Promise<ModelComparisonResult> {
    const audioText = options.audioText || this.getRandomSampleText();

    // Generate previews for both models
    const [previewA, previewB] = await Promise.all([
      this.generatePreview(modelA, { audioText }),
      this.generatePreview(modelB, { audioText }),
    ]);

    // Calculate comparison metrics
    const qualityDifference = previewA.quality.overallScore - previewB.quality.overallScore;
    const lipSyncDifference = previewA.quality.lipSyncScore - previewB.quality.lipSyncScore;
    const speedDifference = previewB.generationTimeMs - previewA.generationTimeMs;

    // Determine winner
    let winner: 'A' | 'B' | 'tie';
    if (Math.abs(qualityDifference) < 5) {
      winner = 'tie';
    } else {
      winner = qualityDifference > 0 ? 'A' : 'B';
    }

    // Generate recommendation
    let recommendation: string;
    if (winner === 'tie') {
      recommendation = 'Both models perform similarly. Choose based on personal preference.';
    } else if (winner === 'A') {
      recommendation = `Model A is recommended with ${Math.abs(qualityDifference)}% better quality.`;
    } else {
      recommendation = `Model B is recommended with ${Math.abs(qualityDifference)}% better quality.`;
    }

    const comparisonId = `comparison_${Date.now()}`;
    const result: ModelComparisonResult = {
      comparisonId,
      modelA: { modelId: modelA.id, preview: previewA },
      modelB: { modelId: modelB.id, preview: previewB },
      winner,
      metrics: {
        qualityDifference,
        lipSyncDifference,
        speedDifference,
        recommendation,
      },
    };

    this.comparisons.set(comparisonId, result);

    logger.info('Models compared', {
      comparisonId,
      modelAId: modelA.id,
      modelBId: modelB.id,
      winner,
    });

    return result;
  }

  /**
   * Validate face model for activation
   */
  async validateModel(model: FaceModel): Promise<ModelValidationResult> {
    const checks: ValidationCheck[] = [];
    const recommendations: string[] = [];

    // Check 1: Embedding quality
    const embeddingCheck = this.checkEmbeddings(model);
    checks.push(embeddingCheck);
    if (!embeddingCheck.passed) {
      recommendations.push('Improve face sample quality for better embeddings');
    }

    // Check 2: Keypoint coverage
    const keypointCheck = this.checkKeypoints(model);
    checks.push(keypointCheck);
    if (!keypointCheck.passed) {
      recommendations.push('Ensure face is fully visible in all samples');
    }

    // Check 3: Expression templates
    const expressionCheck = this.checkExpressionTemplates(model);
    checks.push(expressionCheck);
    if (!expressionCheck.passed) {
      recommendations.push('Add video with varied expressions for better animation');
    }

    // Check 4: Resolution
    const resolutionCheck = this.checkResolution(model);
    checks.push(resolutionCheck);
    if (!resolutionCheck.passed) {
      recommendations.push('Use higher resolution images (512x512 or larger)');
    }

    // Check 5: Sample count
    const sampleCheck = this.checkSampleCount(model);
    checks.push(sampleCheck);
    if (!sampleCheck.passed) {
      recommendations.push('Add more face samples for robust identity');
    }

    // Calculate overall score
    const overallScore = checks.reduce((sum, c) => sum + c.score, 0) / checks.length;
    const isValid = checks.every((c) => c.passed);
    const canActivate = overallScore >= this.config.minQualityForApproval;

    const validationId = `validation_${model.id}_${Date.now()}`;
    const result: ModelValidationResult = {
      isValid,
      validationId,
      modelId: model.id,
      checks,
      overallScore: Math.round(overallScore),
      canActivate,
      recommendations,
    };

    this.validations.set(validationId, result);

    logger.info('Model validated', {
      validationId,
      modelId: model.id,
      isValid,
      canActivate,
      overallScore: result.overallScore,
    });

    return result;
  }

  /**
   * Check embedding quality
   */
  private checkEmbeddings(model: FaceModel): ValidationCheck {
    const minEmbeddings = 3;
    const minConfidence = 0.8;

    const hasEnough = model.embeddings.length >= minEmbeddings;
    const avgConfidence =
      model.embeddings.length > 0
        ? model.embeddings.reduce(
            (sum: number, e: { confidence: number }) => sum + e.confidence,
            0
          ) / model.embeddings.length
        : 0;
    const goodConfidence = avgConfidence >= minConfidence;

    const passed = hasEnough && goodConfidence;
    const score = (hasEnough ? 50 : 0) + avgConfidence * 50;

    return {
      name: 'Embedding Quality',
      passed,
      score: Math.round(score),
      message: passed
        ? 'Embeddings meet quality requirements'
        : `Need ${minEmbeddings}+ embeddings with ${minConfidence * 100}%+ confidence`,
    };
  }

  /**
   * Check keypoint coverage
   */
  private checkKeypoints(model: FaceModel): ValidationCheck {
    const minKeypoints = 400;
    const minConfidence = 0.85;

    const hasEnough = model.keypoints.length >= minKeypoints;
    const avgConfidence =
      model.keypoints.length > 0
        ? model.keypoints.reduce(
            (sum: number, k: { confidence: number }) => sum + k.confidence,
            0
          ) / model.keypoints.length
        : 0;
    const goodConfidence = avgConfidence >= minConfidence;

    const passed = hasEnough && goodConfidence;
    const score = (model.keypoints.length / 468) * 50 + avgConfidence * 50;

    return {
      name: 'Keypoint Coverage',
      passed,
      score: Math.round(Math.min(100, score)),
      message: passed
        ? 'Keypoint coverage is sufficient'
        : `Need ${minKeypoints}+ keypoints with ${minConfidence * 100}%+ confidence`,
    };
  }

  /**
   * Check expression templates
   */
  private checkExpressionTemplates(model: FaceModel): ValidationCheck {
    const minTemplates = 2;
    const hasNeutral = model.expressionTemplates.some(
      (t: { name: string }) => t.name === 'neutral'
    );
    const hasTalking = model.expressionTemplates.some(
      (t: { name: string }) => t.name === 'talking'
    );

    const hasEnough = model.expressionTemplates.length >= minTemplates;
    const hasRequired = hasNeutral && hasTalking;

    const passed = hasEnough && hasRequired;
    const score = (hasEnough ? 40 : 0) + (hasNeutral ? 30 : 0) + (hasTalking ? 30 : 0);

    return {
      name: 'Expression Templates',
      passed,
      score,
      message: passed
        ? 'Expression templates are complete'
        : 'Need neutral and talking expression templates',
    };
  }

  /**
   * Check resolution
   */
  private checkResolution(model: FaceModel): ValidationCheck {
    const minResolution = 256;
    const optimalResolution = 512;

    const minDim = Math.min(model.resolution.width, model.resolution.height);
    const meetsMinimum = minDim >= minResolution;
    const isOptimal = minDim >= optimalResolution;

    const passed = meetsMinimum;
    const score = Math.min(100, (minDim / optimalResolution) * 100);

    return {
      name: 'Resolution',
      passed,
      score: Math.round(score),
      message: isOptimal
        ? 'Resolution is optimal'
        : meetsMinimum
          ? 'Resolution is acceptable but could be improved'
          : `Minimum resolution is ${minResolution}x${minResolution}`,
    };
  }

  /**
   * Check sample count
   */
  private checkSampleCount(model: FaceModel): ValidationCheck {
    const minSamples = 3;
    const optimalSamples = 5;

    const sampleCount = model.embeddings.length;
    const meetsMinimum = sampleCount >= minSamples;
    const isOptimal = sampleCount >= optimalSamples;

    const passed = meetsMinimum;
    const score = Math.min(100, (sampleCount / optimalSamples) * 100);

    return {
      name: 'Sample Count',
      passed,
      score: Math.round(score),
      message: isOptimal
        ? 'Sample count is optimal'
        : meetsMinimum
          ? 'More samples would improve quality'
          : `Need at least ${minSamples} face samples`,
    };
  }

  /**
   * Get recommendations for model improvement
   */
  getRecommendations(model: FaceModel): ModelRecommendation[] {
    const recommendations: ModelRecommendation[] = [];

    // Quality recommendations
    if (model.qualityScore < 70) {
      recommendations.push({
        type: 'warning',
        category: 'quality',
        message: 'Overall quality is below recommended threshold',
        priority: 'high',
        actionable: true,
      });
    }

    // Embedding recommendations
    if (model.embeddings.length < 5) {
      recommendations.push({
        type: 'improvement',
        category: 'samples',
        message: 'Add more face samples for better identity recognition',
        priority: 'medium',
        actionable: true,
      });
    }

    // Expression recommendations
    if (model.expressionTemplates.length < 3) {
      recommendations.push({
        type: 'improvement',
        category: 'expression',
        message: 'Upload video with varied expressions for smoother animation',
        priority: 'medium',
        actionable: true,
      });
    }

    // Resolution recommendations
    const minDim = Math.min(model.resolution.width, model.resolution.height);
    if (minDim < 512) {
      recommendations.push({
        type: 'improvement',
        category: 'resolution',
        message: 'Use higher resolution images for better detail',
        priority: 'low',
        actionable: true,
      });
    }

    // Keypoint recommendations
    const avgKeypointConfidenceRec =
      model.keypoints.length > 0
        ? model.keypoints.reduce(
            (sum: number, k: { confidence: number }) => sum + k.confidence,
            0
          ) / model.keypoints.length
        : 0;
    if (avgKeypointConfidenceRec < 0.9) {
      recommendations.push({
        type: 'improvement',
        category: 'lighting',
        message: 'Improve lighting for better facial landmark detection',
        priority: 'medium',
        actionable: true,
      });
    }

    return recommendations;
  }

  /**
   * Approve model for activation
   */
  async approveModel(modelId: string, validationId: string): Promise<boolean> {
    const validation = this.validations.get(validationId);

    if (!validation || validation.modelId !== modelId) {
      throw new FaceProcessingError('Validation not found or model mismatch');
    }

    if (!validation.canActivate) {
      throw new FaceProcessingError('Model does not meet activation requirements', {
        overallScore: validation.overallScore,
        minRequired: this.config.minQualityForApproval,
      });
    }

    logger.info('Model approved for activation', { modelId, validationId });
    return true;
  }

  /**
   * Reject model with feedback
   */
  async rejectModel(
    modelId: string,
    validationId: string,
    reason: string
  ): Promise<{ rejected: boolean; recommendations: string[] }> {
    const validation = this.validations.get(validationId);

    if (!validation || validation.modelId !== modelId) {
      throw new FaceProcessingError('Validation not found or model mismatch');
    }

    logger.info('Model rejected', { modelId, validationId, reason });

    return {
      rejected: true,
      recommendations: validation.recommendations,
    };
  }

  /**
   * Get preview by ID
   */
  getPreview(previewId: string): PreviewResult | null {
    return this.previews.get(previewId) || null;
  }

  /**
   * Get validation by ID
   */
  getValidation(validationId: string): ModelValidationResult | null {
    return this.validations.get(validationId) || null;
  }

  /**
   * Get comparison by ID
   */
  getComparison(comparisonId: string): ModelComparisonResult | null {
    return this.comparisons.get(comparisonId) || null;
  }

  /**
   * Get configuration
   */
  getConfig(): PreviewConfig {
    return { ...this.config };
  }
}
