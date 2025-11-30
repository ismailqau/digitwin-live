import { createLogger } from '@clone/logger';
import { FaceModel } from '@clone/shared-types';
import { Storage } from '@google-cloud/storage';

import {
  CachedFaceModel,
  PreprocessedFaceData,
  FaceModelCompatibility,
  LipSyncModel,
} from '../types';

const logger = createLogger('FaceModelCacheService');

/**
 * Service for loading, caching, and managing face models for lip-sync generation.
 */
export class FaceModelCacheService {
  private storage: Storage;
  private bucketName: string;
  private modelCache: Map<string, CachedFaceModel> = new Map();
  private readonly maxCacheSize: number;
  private readonly maxMemoryMb: number;
  private currentMemoryUsageMb = 0;
  private preloadQueue: Set<string> = new Set();

  constructor(bucketName: string, maxCacheSize = 50, maxMemoryMb = 2048) {
    this.storage = new Storage();
    this.bucketName = bucketName;
    this.maxCacheSize = maxCacheSize;
    this.maxMemoryMb = maxMemoryMb;

    logger.info('FaceModelCacheService initialized', {
      bucketName,
      maxCacheSize,
      maxMemoryMb,
    });
  }

  /**
   * Load a face model from cache or GCS storage.
   */
  async loadFaceModel(userId: string, modelId: string): Promise<FaceModel> {
    const cacheKey = this.getCacheKey(userId, modelId);

    // Check cache first
    const cached = this.modelCache.get(cacheKey);
    if (cached) {
      cached.lastAccessedAt = new Date();
      logger.debug('Face model cache hit', { userId, modelId });
      return cached.model;
    }

    // Load from GCS
    logger.info('Loading face model from storage', { userId, modelId });
    const model = await this.loadFromStorage(userId, modelId);

    // Cache the model
    await this.cacheModel(cacheKey, model);

    return model;
  }

  /**
   * Get preprocessed face data for a model.
   */
  async getPreprocessedData(userId: string, modelId: string): Promise<PreprocessedFaceData | null> {
    const cacheKey = this.getCacheKey(userId, modelId);
    const cached = this.modelCache.get(cacheKey);

    if (cached?.preprocessedData) {
      return cached.preprocessedData;
    }

    // Load and preprocess if not cached
    const model = await this.loadFaceModel(userId, modelId);
    const preprocessed = await this.preprocessFaceModel(model);

    // Update cache with preprocessed data
    const cachedModel = this.modelCache.get(cacheKey);
    if (cachedModel) {
      cachedModel.preprocessedData = preprocessed;
      cachedModel.memoryUsageMb += this.estimatePreprocessedMemory(preprocessed);
    }

    return preprocessed;
  }

  /**
   * Validate face model compatibility with lip-sync models.
   */
  validateCompatibility(model: FaceModel): FaceModelCompatibility {
    const compatibleModels: LipSyncModel[] = [];
    const issues: string[] = [];

    // Check resolution
    const { width, height } = model.resolution;

    // TPSM - works with most resolutions
    if (width >= 128 && height >= 128) {
      compatibleModels.push(LipSyncModel.TPSM);
    } else {
      issues.push('Resolution too low for TPSM (min 128x128)');
    }

    // Wav2Lip - needs 256x256 or higher
    if (width >= 256 && height >= 256) {
      compatibleModels.push(LipSyncModel.WAV2LIP);
    } else {
      issues.push('Resolution too low for Wav2Lip (min 256x256)');
    }

    // SadTalker - needs good quality landmarks
    if (model.keypoints.length >= 68 && model.qualityScore >= 70) {
      compatibleModels.push(LipSyncModel.SADTALKER);
    } else {
      issues.push('Insufficient landmarks or quality for SadTalker');
    }

    // Audio2Head - needs expression templates
    if (model.expressionTemplates.length >= 3) {
      compatibleModels.push(LipSyncModel.AUDIO2HEAD);
    } else {
      issues.push('Insufficient expression templates for Audio2Head');
    }

    // Static fallback always works
    compatibleModels.push(LipSyncModel.STATIC);

    // Determine recommended model
    let recommendedModel = LipSyncModel.STATIC;
    if (compatibleModels.includes(LipSyncModel.TPSM)) {
      recommendedModel = LipSyncModel.TPSM;
    }
    if (compatibleModels.includes(LipSyncModel.WAV2LIP) && model.qualityScore >= 80) {
      recommendedModel = LipSyncModel.WAV2LIP;
    }

    return {
      modelId: model.id,
      compatibleLipSyncModels: compatibleModels,
      recommendedModel,
      issues,
    };
  }

  /**
   * Preload face models for active users.
   */
  async preloadForUsers(userIds: string[]): Promise<void> {
    for (const userId of userIds) {
      if (this.preloadQueue.has(userId)) continue;

      this.preloadQueue.add(userId);

      try {
        // Get user's active face model ID from metadata
        const modelId = await this.getActiveModelId(userId);
        if (modelId) {
          await this.loadFaceModel(userId, modelId);
          logger.debug('Preloaded face model', { userId, modelId });
        }
      } catch (error) {
        logger.warn('Failed to preload face model', { userId, error });
      } finally {
        this.preloadQueue.delete(userId);
      }
    }
  }

  /**
   * Hot-swap face model during conversation.
   */
  async hotSwapModel(userId: string, oldModelId: string, newModelId: string): Promise<FaceModel> {
    logger.info('Hot-swapping face model', { userId, oldModelId, newModelId });

    // Load new model first
    const newModel = await this.loadFaceModel(userId, newModelId);

    // Validate new model
    const compatibility = this.validateCompatibility(newModel);
    if (compatibility.compatibleLipSyncModels.length === 0) {
      throw new Error('New face model is not compatible with any lip-sync model');
    }

    // Optionally evict old model to free memory
    const oldCacheKey = this.getCacheKey(userId, oldModelId);
    if (this.modelCache.has(oldCacheKey)) {
      this.evictModel(oldCacheKey);
    }

    return newModel;
  }

  /**
   * Optimize face model for specific lip-sync model.
   */
  async optimizeForModel(
    faceModel: FaceModel,
    lipSyncModel: LipSyncModel
  ): Promise<PreprocessedFaceData> {
    const preprocessed = await this.preprocessFaceModel(faceModel);

    switch (lipSyncModel) {
      case LipSyncModel.TPSM:
        return this.optimizeForTPSM(preprocessed, faceModel);
      case LipSyncModel.WAV2LIP:
        return this.optimizeForWav2Lip(preprocessed, faceModel);
      case LipSyncModel.SADTALKER:
        return this.optimizeForSadTalker(preprocessed, faceModel);
      case LipSyncModel.AUDIO2HEAD:
        return this.optimizeForAudio2Head(preprocessed, faceModel);
      default:
        return preprocessed;
    }
  }

  /**
   * Get cache statistics.
   */
  getCacheStats(): {
    size: number;
    maxSize: number;
    memoryUsageMb: number;
    maxMemoryMb: number;
    hitRate: number;
  } {
    return {
      size: this.modelCache.size,
      maxSize: this.maxCacheSize,
      memoryUsageMb: this.currentMemoryUsageMb,
      maxMemoryMb: this.maxMemoryMb,
      hitRate: this.calculateHitRate(),
    };
  }

  /**
   * Clear the model cache.
   */
  clearCache(): void {
    this.modelCache.clear();
    this.currentMemoryUsageMb = 0;
    logger.info('Face model cache cleared');
  }

  // ============================================================================
  // Private Methods - Storage
  // ============================================================================

  private async loadFromStorage(userId: string, modelId: string): Promise<FaceModel> {
    const basePath = `face-models/${userId}/${modelId}`;

    try {
      // Load metadata
      const metadataFile = this.storage.bucket(this.bucketName).file(`${basePath}/metadata.json`);

      const [metadataExists] = await metadataFile.exists();
      if (!metadataExists) {
        throw new Error(`Face model not found: ${modelId}`);
      }

      const [metadataContent] = await metadataFile.download();
      const metadata = JSON.parse(metadataContent.toString());

      // Load keypoints
      const keypointsFile = this.storage.bucket(this.bucketName).file(`${basePath}/keypoints.json`);

      const [keypointsContent] = await keypointsFile.download();
      const keypoints = JSON.parse(keypointsContent.toString());

      // Load embeddings
      const embeddingsFile = this.storage
        .bucket(this.bucketName)
        .file(`${basePath}/embeddings.json`);

      const [embeddingsContent] = await embeddingsFile.download();
      const embeddings = JSON.parse(embeddingsContent.toString());

      // Load expression templates
      const templatesFile = this.storage
        .bucket(this.bucketName)
        .file(`${basePath}/expression_templates.json`);

      let expressionTemplates = [];
      const [templatesExists] = await templatesFile.exists();
      if (templatesExists) {
        const [templatesContent] = await templatesFile.download();
        expressionTemplates = JSON.parse(templatesContent.toString());
      }

      return {
        id: modelId,
        userId,
        modelPath: basePath,
        resolution: metadata.resolution || { width: 256, height: 256 },
        keypoints,
        embeddings,
        neutralPose: `gs://${this.bucketName}/${basePath}/neutral_pose.jpg`,
        expressionTemplates,
        createdAt: new Date(metadata.createdAt),
        qualityScore: metadata.qualityScore || 70,
      };
    } catch (error) {
      logger.error('Failed to load face model from storage', {
        userId,
        modelId,
        error,
      });
      throw error;
    }
  }

  private async getActiveModelId(userId: string): Promise<string | null> {
    try {
      const userMetaFile = this.storage
        .bucket(this.bucketName)
        .file(`face-models/${userId}/active_model.json`);

      const [exists] = await userMetaFile.exists();
      if (!exists) return null;

      const [content] = await userMetaFile.download();
      const data = JSON.parse(content.toString());
      return data.activeModelId || null;
    } catch {
      return null;
    }
  }

  // ============================================================================
  // Private Methods - Caching
  // ============================================================================

  private getCacheKey(userId: string, modelId: string): string {
    return `${userId}:${modelId}`;
  }

  private async cacheModel(cacheKey: string, model: FaceModel): Promise<void> {
    const memoryUsage = this.estimateModelMemory(model);

    // Check if we need to evict models
    while (
      this.modelCache.size >= this.maxCacheSize ||
      this.currentMemoryUsageMb + memoryUsage > this.maxMemoryMb
    ) {
      this.evictLRU();
    }

    this.modelCache.set(cacheKey, {
      model,
      loadedAt: new Date(),
      lastAccessedAt: new Date(),
      memoryUsageMb: memoryUsage,
    });

    this.currentMemoryUsageMb += memoryUsage;
  }

  private evictModel(cacheKey: string): void {
    const cached = this.modelCache.get(cacheKey);
    if (cached) {
      this.currentMemoryUsageMb -= cached.memoryUsageMb;
      this.modelCache.delete(cacheKey);
      logger.debug('Evicted face model from cache', { cacheKey });
    }
  }

  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestTime = Date.now();

    this.modelCache.forEach((cached, key) => {
      if (cached.lastAccessedAt.getTime() < oldestTime) {
        oldestTime = cached.lastAccessedAt.getTime();
        oldestKey = key;
      }
    });

    if (oldestKey) {
      this.evictModel(oldestKey);
    }
  }

  private estimateModelMemory(model: FaceModel): number {
    // Estimate memory usage in MB
    let memory = 0;

    // Keypoints: ~100 bytes per keypoint
    memory += (model.keypoints.length * 100) / (1024 * 1024);

    // Embeddings: ~4KB per embedding
    memory += (model.embeddings.length * 4096) / (1024 * 1024);

    // Expression templates: ~2KB per template
    memory += (model.expressionTemplates.length * 2048) / (1024 * 1024);

    // Base overhead
    memory += 1;

    return memory;
  }

  private estimatePreprocessedMemory(data: PreprocessedFaceData): number {
    let memory = 0;

    if (data.alignedFace) {
      memory += data.alignedFace.length / (1024 * 1024);
    }
    if (data.textureMap) {
      memory += data.textureMap.length / (1024 * 1024);
    }
    if (data.meshData) {
      memory += data.meshData.length / (1024 * 1024);
    }

    return memory;
  }

  private calculateHitRate(): number {
    // Simplified hit rate calculation
    return this.modelCache.size > 0 ? 0.8 : 0;
  }

  // ============================================================================
  // Private Methods - Preprocessing
  // ============================================================================

  private async preprocessFaceModel(model: FaceModel): Promise<PreprocessedFaceData> {
    // Extract landmarks as 2D array
    const landmarks = model.keypoints.map((kp) => [kp.x, kp.y]);

    // Get average embedding
    const embedding =
      model.embeddings.length > 0 ? model.embeddings[0].vector : new Array(512).fill(0);

    // Load and align neutral pose image
    let alignedFace: Buffer | undefined;
    try {
      if (model.neutralPose.startsWith('gs://')) {
        const path = model.neutralPose.replace(`gs://${this.bucketName}/`, '');
        const file = this.storage.bucket(this.bucketName).file(path);
        const [content] = await file.download();
        alignedFace = content;
      }
    } catch (error) {
      logger.warn('Failed to load neutral pose image', { error });
    }

    return {
      alignedFace: alignedFace || Buffer.alloc(0),
      landmarks,
      embedding,
    };
  }

  private optimizeForTPSM(data: PreprocessedFaceData, model: FaceModel): PreprocessedFaceData {
    // TPSM uses thin-plate spline warping
    // Ensure landmarks are in the correct format
    return {
      ...data,
      landmarks: this.normalizeLandmarks(data.landmarks, model.resolution),
    };
  }

  private optimizeForWav2Lip(data: PreprocessedFaceData, _model: FaceModel): PreprocessedFaceData {
    // Wav2Lip needs face cropped to 96x96 around mouth region
    // This is a placeholder - actual implementation would crop the face
    return {
      ...data,
      landmarks: this.extractMouthLandmarks(data.landmarks),
    };
  }

  private optimizeForSadTalker(
    data: PreprocessedFaceData,
    _model: FaceModel
  ): PreprocessedFaceData {
    // SadTalker uses 3DMM coefficients
    // This is a placeholder - actual implementation would compute 3DMM
    return data;
  }

  private optimizeForAudio2Head(
    data: PreprocessedFaceData,
    _model: FaceModel
  ): PreprocessedFaceData {
    // Audio2Head needs head pose information
    return data;
  }

  private normalizeLandmarks(
    landmarks: number[][],
    resolution: { width: number; height: number }
  ): number[][] {
    return landmarks.map(([x, y]) => [x / resolution.width, y / resolution.height]);
  }

  private extractMouthLandmarks(landmarks: number[][]): number[][] {
    // Extract mouth region landmarks (indices 48-67 in 68-point model)
    if (landmarks.length >= 68) {
      return landmarks.slice(48, 68);
    }
    return landmarks;
  }
}
