import { FaceProcessingError } from '@clone/errors';
import { createLogger } from '@clone/logger';
import { FaceModel } from '@clone/shared-types';

const logger = createLogger('face-model-storage-service');

/**
 * Face model status
 */
export type FaceModelStatus =
  | 'pending'
  | 'processing'
  | 'active'
  | 'inactive'
  | 'failed'
  | 'expired';

/**
 * Face model metadata for storage
 */
export interface FaceModelMetadata {
  id: string;
  userId: string;
  status: FaceModelStatus;
  version: number;
  qualityScore: number;
  resolution: { width: number; height: number };
  sampleCount: number;
  createdAt: Date;
  updatedAt: Date;
  activatedAt?: Date;
  expiresAt?: Date;
  storageInfo: StorageInfo;
  processingInfo?: ProcessingInfo;
}

/**
 * Storage information
 */
export interface StorageInfo {
  bucket: string;
  basePath: string;
  files: {
    neutralPose: string;
    keypoints: string;
    embeddings: string;
    expressionTemplates: string;
    metadata: string;
  };
  totalSizeBytes: number;
}

/**
 * Processing information
 */
export interface ProcessingInfo {
  startedAt: Date;
  completedAt?: Date;
  durationMs?: number;
  errors?: string[];
}

/**
 * Face model quality assessment
 */
export interface FaceModelQualityAssessment {
  overallScore: number;
  embeddingQuality: number;
  keypointQuality: number;
  expressionCoverage: number;
  resolutionScore: number;
  recommendations: string[];
}

/**
 * Face model analytics
 */
export interface FaceModelAnalytics {
  modelId: string;
  userId: string;
  usageCount: number;
  lastUsedAt?: Date;
  averageGenerationTimeMs: number;
  successRate: number;
  errorCount: number;
}

/**
 * Face model storage configuration
 */
export interface FaceModelStorageConfig {
  bucket: string;
  basePath: string;
  maxModelsPerUser: number;
  expirationDays: number;
  minQualityScore: number;
}

const DEFAULT_CONFIG: FaceModelStorageConfig = {
  bucket: 'digitwin-live-face-models',
  basePath: 'face-models',
  maxModelsPerUser: 5,
  expirationDays: 365,
  minQualityScore: 70,
};

/**
 * Face Model Storage Service
 * Handles CRUD operations, versioning, and storage management for face models
 */
export class FaceModelStorageService {
  private config: FaceModelStorageConfig;

  // In-memory storage (in production, use database + GCS)
  private models: Map<string, FaceModel> = new Map();
  private metadata: Map<string, FaceModelMetadata> = new Map();
  private analytics: Map<string, FaceModelAnalytics> = new Map();

  constructor(config: Partial<FaceModelStorageConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    logger.info('FaceModelStorageService initialized', { config: this.config });
  }

  /**
   * Create a new face model
   */
  async createModel(
    userId: string,
    modelData: Omit<FaceModel, 'id' | 'createdAt' | 'qualityScore'>
  ): Promise<FaceModel> {
    // Check user model limit
    const userModels = this.getModelsByUser(userId);
    if (userModels.length >= this.config.maxModelsPerUser) {
      throw new FaceProcessingError(
        `Maximum ${this.config.maxModelsPerUser} models per user exceeded`
      );
    }

    const modelId = `model_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const qualityScore = this.calculateQualityScore(modelData);

    const model: FaceModel = {
      id: modelId,
      userId,
      modelPath: `${this.config.basePath}/${userId}/${modelId}`,
      resolution: modelData.resolution,
      keypoints: modelData.keypoints,
      embeddings: modelData.embeddings,
      neutralPose: modelData.neutralPose,
      expressionTemplates: modelData.expressionTemplates,
      createdAt: new Date(),
      qualityScore,
    };

    // Create metadata
    const meta: FaceModelMetadata = {
      id: modelId,
      userId,
      status: 'pending',
      version: 1,
      qualityScore,
      resolution: model.resolution,
      sampleCount: model.embeddings.length,
      createdAt: new Date(),
      updatedAt: new Date(),
      storageInfo: this.createStorageInfo(userId, modelId),
    };

    // Store model and metadata
    this.models.set(modelId, model);
    this.metadata.set(modelId, meta);

    // Initialize analytics
    this.analytics.set(modelId, {
      modelId,
      userId,
      usageCount: 0,
      averageGenerationTimeMs: 0,
      successRate: 1,
      errorCount: 0,
    });

    logger.info('Face model created', {
      modelId,
      userId,
      qualityScore,
      sampleCount: model.embeddings.length,
    });

    return model;
  }

  /**
   * Get face model by ID
   */
  async getModel(modelId: string): Promise<FaceModel | null> {
    return this.models.get(modelId) || null;
  }

  /**
   * Get face model metadata
   */
  async getModelMetadata(modelId: string): Promise<FaceModelMetadata | null> {
    return this.metadata.get(modelId) || null;
  }

  /**
   * Get all models for a user
   */
  getModelsByUser(userId: string): FaceModel[] {
    return Array.from(this.models.values()).filter((m) => m.userId === userId);
  }

  /**
   * Get active model for a user
   */
  async getActiveModel(userId: string): Promise<FaceModel | null> {
    const userModels = this.getModelsByUser(userId);
    const activeModel = userModels.find((m) => {
      const meta = this.metadata.get(m.id);
      return meta?.status === 'active';
    });
    return activeModel || null;
  }

  /**
   * Update face model
   */
  async updateModel(
    modelId: string,
    updates: Partial<Omit<FaceModel, 'id' | 'userId' | 'createdAt'>>
  ): Promise<FaceModel> {
    const model = this.models.get(modelId);
    if (!model) {
      throw new FaceProcessingError('Face model not found', { modelId });
    }

    const meta = this.metadata.get(modelId);
    if (!meta) {
      throw new FaceProcessingError('Face model metadata not found', { modelId });
    }

    // Update model
    const updatedModel: FaceModel = {
      ...model,
      ...updates,
      qualityScore:
        updates.keypoints || updates.embeddings
          ? this.calculateQualityScore({ ...model, ...updates })
          : model.qualityScore,
    };

    // Update metadata
    const updatedMeta: FaceModelMetadata = {
      ...meta,
      version: meta.version + 1,
      qualityScore: updatedModel.qualityScore,
      updatedAt: new Date(),
      sampleCount: updatedModel.embeddings.length,
    };

    this.models.set(modelId, updatedModel);
    this.metadata.set(modelId, updatedMeta);

    logger.info('Face model updated', {
      modelId,
      newVersion: updatedMeta.version,
      qualityScore: updatedModel.qualityScore,
    });

    return updatedModel;
  }

  /**
   * Delete face model (soft delete)
   */
  async deleteModel(modelId: string): Promise<void> {
    const meta = this.metadata.get(modelId);
    if (!meta) {
      throw new FaceProcessingError('Face model not found', { modelId });
    }

    // Soft delete - mark as inactive
    meta.status = 'inactive';
    meta.updatedAt = new Date();
    this.metadata.set(modelId, meta);

    logger.info('Face model deleted (soft)', { modelId });
  }

  /**
   * Permanently delete face model
   */
  async permanentlyDeleteModel(modelId: string): Promise<void> {
    this.models.delete(modelId);
    this.metadata.delete(modelId);
    this.analytics.delete(modelId);

    logger.info('Face model permanently deleted', { modelId });
  }

  /**
   * Activate face model
   */
  async activateModel(modelId: string): Promise<void> {
    const model = this.models.get(modelId);
    const meta = this.metadata.get(modelId);

    if (!model || !meta) {
      throw new FaceProcessingError('Face model not found', { modelId });
    }

    // Check quality score
    if (meta.qualityScore < this.config.minQualityScore) {
      throw new FaceProcessingError(
        `Model quality score ${meta.qualityScore} is below minimum ${this.config.minQualityScore}`
      );
    }

    // Deactivate other models for this user
    const userModels = this.getModelsByUser(model.userId);
    for (const m of userModels) {
      const otherMeta = this.metadata.get(m.id);
      if (otherMeta && otherMeta.status === 'active') {
        otherMeta.status = 'inactive';
        otherMeta.updatedAt = new Date();
        this.metadata.set(m.id, otherMeta);
      }
    }

    // Activate this model
    meta.status = 'active';
    meta.activatedAt = new Date();
    meta.updatedAt = new Date();
    meta.expiresAt = new Date(Date.now() + this.config.expirationDays * 24 * 60 * 60 * 1000);
    this.metadata.set(modelId, meta);

    logger.info('Face model activated', { modelId, userId: model.userId });
  }

  /**
   * Deactivate face model
   */
  async deactivateModel(modelId: string): Promise<void> {
    const meta = this.metadata.get(modelId);
    if (!meta) {
      throw new FaceProcessingError('Face model not found', { modelId });
    }

    meta.status = 'inactive';
    meta.updatedAt = new Date();
    this.metadata.set(modelId, meta);

    logger.info('Face model deactivated', { modelId });
  }

  /**
   * Calculate quality score for a face model
   */
  private calculateQualityScore(modelData: Partial<FaceModel>): number {
    let score = 0;
    let factors = 0;

    // Embedding quality (0-30 points)
    if (modelData.embeddings && modelData.embeddings.length > 0) {
      const avgConfidence =
        modelData.embeddings.reduce((sum, e) => sum + e.confidence, 0) /
        modelData.embeddings.length;
      score += avgConfidence * 30;
      factors++;
    }

    // Keypoint quality (0-25 points)
    if (modelData.keypoints && modelData.keypoints.length > 0) {
      const avgConfidence =
        modelData.keypoints.reduce((sum, k) => sum + k.confidence, 0) / modelData.keypoints.length;
      const keypointCoverage = Math.min(1, modelData.keypoints.length / 468);
      score += (avgConfidence * 0.5 + keypointCoverage * 0.5) * 25;
      factors++;
    }

    // Expression template coverage (0-25 points)
    if (modelData.expressionTemplates && modelData.expressionTemplates.length > 0) {
      const templateCoverage = Math.min(1, modelData.expressionTemplates.length / 5);
      score += templateCoverage * 25;
      factors++;
    }

    // Resolution score (0-20 points)
    if (modelData.resolution) {
      const minDim = Math.min(modelData.resolution.width, modelData.resolution.height);
      const resScore = Math.min(1, minDim / 512);
      score += resScore * 20;
      factors++;
    }

    return factors > 0 ? Math.round(score) : 0;
  }

  /**
   * Assess face model quality in detail
   */
  assessModelQuality(model: FaceModel): FaceModelQualityAssessment {
    const recommendations: string[] = [];

    // Embedding quality
    const embeddingQuality =
      model.embeddings.length > 0
        ? (model.embeddings.reduce((sum, e) => sum + e.confidence, 0) / model.embeddings.length) *
          100
        : 0;
    if (embeddingQuality < 80) {
      recommendations.push('Upload higher quality face images for better embeddings');
    }

    // Keypoint quality
    const keypointQuality =
      model.keypoints.length > 0
        ? (model.keypoints.reduce((sum, k) => sum + k.confidence, 0) / model.keypoints.length) *
          (model.keypoints.length / 468) *
          100
        : 0;
    if (keypointQuality < 70) {
      recommendations.push('Ensure face is clearly visible and well-lit');
    }

    // Expression coverage
    const expressionCoverage = Math.min(100, (model.expressionTemplates.length / 5) * 100);
    if (expressionCoverage < 60) {
      recommendations.push('Upload video with more varied expressions for better animation');
    }

    // Resolution score
    const minDim = Math.min(model.resolution.width, model.resolution.height);
    const resolutionScore = Math.min(100, (minDim / 512) * 100);
    if (resolutionScore < 80) {
      recommendations.push('Use higher resolution images (512x512 or larger)');
    }

    const overallScore =
      (embeddingQuality + keypointQuality + expressionCoverage + resolutionScore) / 4;

    return {
      overallScore: Math.round(overallScore),
      embeddingQuality: Math.round(embeddingQuality),
      keypointQuality: Math.round(keypointQuality),
      expressionCoverage: Math.round(expressionCoverage),
      resolutionScore: Math.round(resolutionScore),
      recommendations,
    };
  }

  /**
   * Create storage info for a model
   */
  private createStorageInfo(userId: string, modelId: string): StorageInfo {
    const basePath = `${this.config.basePath}/${userId}/${modelId}`;
    return {
      bucket: this.config.bucket,
      basePath,
      files: {
        neutralPose: `${basePath}/neutral_pose.jpg`,
        keypoints: `${basePath}/keypoints.json`,
        embeddings: `${basePath}/embeddings.json`,
        expressionTemplates: `${basePath}/expression_templates.json`,
        metadata: `${basePath}/metadata.json`,
      },
      totalSizeBytes: 0,
    };
  }

  /**
   * Get model analytics
   */
  async getModelAnalytics(modelId: string): Promise<FaceModelAnalytics | null> {
    return this.analytics.get(modelId) || null;
  }

  /**
   * Record model usage
   */
  async recordUsage(modelId: string, generationTimeMs: number, success: boolean): Promise<void> {
    const analytics = this.analytics.get(modelId);
    if (!analytics) return;

    analytics.usageCount++;
    analytics.lastUsedAt = new Date();

    // Update average generation time
    const totalTime =
      analytics.averageGenerationTimeMs * (analytics.usageCount - 1) + generationTimeMs;
    analytics.averageGenerationTimeMs = totalTime / analytics.usageCount;

    if (!success) {
      analytics.errorCount++;
    }
    analytics.successRate = (analytics.usageCount - analytics.errorCount) / analytics.usageCount;

    this.analytics.set(modelId, analytics);
  }

  /**
   * Backup face model
   */
  async backupModel(modelId: string): Promise<string> {
    const model = this.models.get(modelId);
    const meta = this.metadata.get(modelId);

    if (!model || !meta) {
      throw new FaceProcessingError('Face model not found', { modelId });
    }

    const backup = {
      model,
      metadata: meta,
      backupAt: new Date().toISOString(),
      version: meta.version,
    };

    const backupId = `backup_${modelId}_${Date.now()}`;

    // In production, store to GCS
    logger.info('Face model backed up', { modelId, backupId });

    return JSON.stringify(backup);
  }

  /**
   * Restore face model from backup
   */
  async restoreModel(backupData: string): Promise<FaceModel> {
    const backup = JSON.parse(backupData);

    const model = backup.model as FaceModel;
    const meta = backup.metadata as FaceModelMetadata;

    // Restore with new version
    meta.version++;
    meta.updatedAt = new Date();
    meta.status = 'inactive';

    this.models.set(model.id, model);
    this.metadata.set(model.id, meta);

    logger.info('Face model restored', { modelId: model.id, version: meta.version });

    return model;
  }

  /**
   * Get expired models
   */
  getExpiredModels(): FaceModelMetadata[] {
    const now = new Date();
    return Array.from(this.metadata.values()).filter(
      (meta) => meta.expiresAt && meta.expiresAt < now
    );
  }

  /**
   * Cleanup expired models
   */
  async cleanupExpiredModels(): Promise<number> {
    const expired = this.getExpiredModels();

    for (const meta of expired) {
      meta.status = 'expired';
      meta.updatedAt = new Date();
      this.metadata.set(meta.id, meta);
    }

    logger.info('Expired models cleaned up', { count: expired.length });
    return expired.length;
  }

  /**
   * Get storage statistics for a user
   */
  getUserStorageStats(userId: string): {
    modelCount: number;
    activeModelId: string | null;
    totalSizeBytes: number;
    oldestModel: Date | null;
    newestModel: Date | null;
  } {
    const userModels = this.getModelsByUser(userId);
    const userMeta = userModels
      .map((m) => this.metadata.get(m.id))
      .filter(Boolean) as FaceModelMetadata[];

    const activeModel = userMeta.find((m) => m.status === 'active');
    const totalSize = userMeta.reduce((sum, m) => sum + m.storageInfo.totalSizeBytes, 0);
    const dates = userMeta.map((m) => m.createdAt);

    return {
      modelCount: userModels.length,
      activeModelId: activeModel?.id || null,
      totalSizeBytes: totalSize,
      oldestModel: dates.length > 0 ? new Date(Math.min(...dates.map((d) => d.getTime()))) : null,
      newestModel: dates.length > 0 ? new Date(Math.max(...dates.map((d) => d.getTime()))) : null,
    };
  }

  /**
   * Get configuration
   */
  getConfig(): FaceModelStorageConfig {
    return { ...this.config };
  }
}
