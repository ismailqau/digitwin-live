import { createLogger } from '@clone/logger';
import { FaceModel } from '@clone/shared-types';

import {
  LipSyncModel,
  LipSyncRequest,
  LipSyncResponse,
  LipSyncServiceConfig,
  LipSyncModelConfig,
  ModelPerformanceMetrics,
  ModelBenchmarkResult,
  ModelSelectionCriteria,
  AudioChunk,
  GeneratedFrame,
  LipSyncError,
  LipSyncErrorCode,
} from '../types';

import { AudioFeatureService } from './audio-feature.service';
import { FaceModelCacheService } from './face-model-cache.service';
import { VideoGeneratorService } from './video-generator.service';
import { VideoStreamingService } from './video-streaming.service';

const logger = createLogger('LipSyncService');

// Default service configuration
const DEFAULT_CONFIG: LipSyncServiceConfig = {
  defaultModel: LipSyncModel.TPSM,
  fallbackChain: [
    LipSyncModel.TPSM,
    LipSyncModel.WAV2LIP,
    LipSyncModel.SADTALKER,
    LipSyncModel.STATIC,
  ],
  maxConcurrentSessions: 100,
  faceModelCacheSize: 50,
  audioFeatureCacheTtl: 300000, // 5 minutes
  frameCacheTtl: 60000, // 1 minute
  enableAdaptiveModelSelection: true,
  performanceMonitoringInterval: 30000, // 30 seconds
};

// Model configurations with performance characteristics
const MODEL_CONFIGS: Record<LipSyncModel, LipSyncModelConfig> = {
  [LipSyncModel.TPSM]: {
    model: LipSyncModel.TPSM,
    priority: 1,
    maxLatencyMs: 30,
    minQualityScore: 70,
    gpuMemoryMb: 512,
    supportsStreaming: true,
    supportedResolutions: [
      { width: 128, height: 128 },
      { width: 256, height: 256 },
      { width: 512, height: 512 },
    ],
  },
  [LipSyncModel.WAV2LIP]: {
    model: LipSyncModel.WAV2LIP,
    priority: 2,
    maxLatencyMs: 100,
    minQualityScore: 85,
    gpuMemoryMb: 1024,
    supportsStreaming: true,
    supportedResolutions: [
      { width: 256, height: 256 },
      { width: 512, height: 512 },
    ],
  },
  [LipSyncModel.SADTALKER]: {
    model: LipSyncModel.SADTALKER,
    priority: 3,
    maxLatencyMs: 60,
    minQualityScore: 80,
    gpuMemoryMb: 2048,
    supportsStreaming: true,
    supportedResolutions: [
      { width: 256, height: 256 },
      { width: 512, height: 512 },
    ],
  },
  [LipSyncModel.AUDIO2HEAD]: {
    model: LipSyncModel.AUDIO2HEAD,
    priority: 4,
    maxLatencyMs: 80,
    minQualityScore: 82,
    gpuMemoryMb: 2048,
    supportsStreaming: false,
    supportedResolutions: [{ width: 256, height: 256 }],
  },
  [LipSyncModel.STATIC]: {
    model: LipSyncModel.STATIC,
    priority: 5,
    maxLatencyMs: 5,
    minQualityScore: 50,
    gpuMemoryMb: 64,
    supportsStreaming: true,
    supportedResolutions: [
      { width: 128, height: 128 },
      { width: 256, height: 256 },
      { width: 512, height: 512 },
    ],
  },
};

/**
 * Main lip-sync service that orchestrates audio processing, face model loading,
 * video generation, and streaming with multi-model support.
 */
export class LipSyncService {
  private config: LipSyncServiceConfig;
  private audioFeatureService: AudioFeatureService;
  private faceModelCacheService: FaceModelCacheService;
  private videoGeneratorService: VideoGeneratorService;
  private videoStreamingService: VideoStreamingService;

  private modelPerformance: Map<LipSyncModel, ModelPerformanceMetrics> = new Map();
  private sessionModels: Map<string, LipSyncModel> = new Map();
  private activeSessions: Set<string> = new Set();
  private gpuAvailable = true;

  constructor(bucketName: string, config?: Partial<LipSyncServiceConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Initialize sub-services
    this.audioFeatureService = new AudioFeatureService(undefined, this.config.audioFeatureCacheTtl);
    this.faceModelCacheService = new FaceModelCacheService(
      bucketName,
      this.config.faceModelCacheSize
    );
    this.videoGeneratorService = new VideoGeneratorService();
    this.videoStreamingService = new VideoStreamingService();

    // Initialize model performance metrics
    this.initializeModelPerformance();

    // Start performance monitoring
    this.startPerformanceMonitoring();

    logger.info('LipSyncService initialized', { config: this.config });
  }

  /**
   * Process lip-sync request and generate video frames.
   */
  async processLipSync(request: LipSyncRequest): Promise<LipSyncResponse> {
    const startTime = Date.now();
    const { sessionId, userId, audioChunk, faceModelId, modelPreference } = request;

    try {
      // Track session
      this.activeSessions.add(sessionId);

      // Load face model
      const faceModel = await this.faceModelCacheService.loadFaceModel(userId, faceModelId);

      // Validate face model compatibility
      const compatibility = this.faceModelCacheService.validateCompatibility(faceModel);
      if (compatibility.compatibleLipSyncModels.length === 0) {
        throw this.createError(
          LipSyncErrorCode.FACE_MODEL_INCOMPATIBLE,
          'Face model is not compatible with any lip-sync model'
        );
      }

      // Select lip-sync model
      const selectedModel = this.selectModel(
        sessionId,
        modelPreference,
        compatibility.compatibleLipSyncModels
      );

      // Get preprocessed face data
      const preprocessedData = await this.faceModelCacheService.getPreprocessedData(
        userId,
        faceModelId
      );

      if (!preprocessedData) {
        throw this.createError(
          LipSyncErrorCode.FACE_MODEL_NOT_FOUND,
          'Failed to preprocess face model'
        );
      }

      // Extract audio features
      const audioFeatures = await this.audioFeatureService.extractFeatures(audioChunk);

      // Generate video frames
      const frames = await this.videoGeneratorService.generateFrames(
        sessionId,
        audioFeatures,
        faceModel,
        preprocessedData,
        selectedModel
      );

      // Calculate sync state
      const syncState = this.videoStreamingService.calculateSyncState(
        sessionId,
        audioChunk.timestamp,
        frames[0]?.timestamp || audioChunk.timestamp
      );

      // Apply sync correction if needed
      const correctedFrames = this.videoStreamingService.applySyncCorrection(frames, syncState);

      const processingTime = Date.now() - startTime;

      // Update model performance
      this.updateModelPerformance(selectedModel, processingTime, frames.length, true);

      return {
        sessionId,
        frames: correctedFrames,
        syncState,
        metrics: {
          processingTimeMs: processingTime,
          modelUsed: selectedModel,
          framesGenerated: frames.length,
        },
      };
    } catch (error) {
      logger.error('Lip-sync processing failed', { sessionId, error });

      // Try fallback model
      const fallbackResult = await this.tryFallback(request, error as Error);
      if (fallbackResult) {
        return fallbackResult;
      }

      throw error;
    }
  }

  /**
   * Select the best lip-sync model based on criteria.
   */
  selectModel(
    sessionId: string,
    preference?: LipSyncModel,
    compatibleModels?: LipSyncModel[],
    criteria?: ModelSelectionCriteria
  ): LipSyncModel {
    // Check if session already has a model assigned
    const existingModel = this.sessionModels.get(sessionId);
    if (existingModel && !preference) {
      return existingModel;
    }

    // Use preference if compatible
    if (preference && (!compatibleModels || compatibleModels.includes(preference))) {
      this.sessionModels.set(sessionId, preference);
      return preference;
    }

    // Filter by compatibility
    let candidates = compatibleModels || this.config.fallbackChain;

    // Filter by criteria
    if (criteria) {
      candidates = candidates.filter((model) => {
        const config = MODEL_CONFIGS[model];
        const perf = this.modelPerformance.get(model);

        if (criteria.maxLatencyMs && config.maxLatencyMs > criteria.maxLatencyMs) {
          return false;
        }
        if (criteria.minQualityScore && config.minQualityScore < criteria.minQualityScore) {
          return false;
        }
        if (!criteria.gpuAvailable && config.gpuMemoryMb > 100) {
          return false;
        }
        if (perf && perf.successRate < 0.5) {
          return false;
        }

        return true;
      });
    }

    // Select based on adaptive selection or priority
    let selectedModel: LipSyncModel;

    if (this.config.enableAdaptiveModelSelection) {
      selectedModel = this.selectAdaptively(candidates);
    } else {
      // Select by priority
      candidates.sort((a, b) => MODEL_CONFIGS[a].priority - MODEL_CONFIGS[b].priority);
      selectedModel = candidates[0] || this.config.defaultModel;
    }

    this.sessionModels.set(sessionId, selectedModel);
    return selectedModel;
  }

  /**
   * Benchmark all available models.
   */
  async benchmarkModels(
    faceModel: FaceModel,
    testAudioChunk: AudioChunk
  ): Promise<ModelBenchmarkResult[]> {
    const results: ModelBenchmarkResult[] = [];
    const compatibility = this.faceModelCacheService.validateCompatibility(faceModel);

    for (const model of compatibility.compatibleLipSyncModels) {
      try {
        const result = await this.benchmarkSingleModel(model, faceModel, testAudioChunk);
        results.push(result);
      } catch (error) {
        logger.warn('Model benchmark failed', { model, error });
        results.push({
          model,
          testDurationMs: 0,
          framesGenerated: 0,
          averageLatencyMs: Infinity,
          maxLatencyMs: Infinity,
          minLatencyMs: Infinity,
          qualityScore: 0,
          gpuMemoryPeakMb: 0,
          isRecommended: false,
        });
      }
    }

    // Mark recommended model
    const bestModel = results.reduce((best, current) => {
      if (current.averageLatencyMs < best.averageLatencyMs && current.qualityScore > 60) {
        return current;
      }
      return best;
    }, results[0]);

    if (bestModel) {
      bestModel.isRecommended = true;
    }

    return results;
  }

  /**
   * Switch model during conversation.
   */
  async switchModel(sessionId: string, newModel: LipSyncModel): Promise<void> {
    const currentModel = this.sessionModels.get(sessionId);

    if (currentModel === newModel) {
      return;
    }

    logger.info('Switching lip-sync model', {
      sessionId,
      from: currentModel,
      to: newModel,
    });

    this.sessionModels.set(sessionId, newModel);

    // Update metrics
    const metrics = this.videoGeneratorService.getMetrics();
    metrics.modelSwitches++;
  }

  /**
   * Get model performance metrics.
   */
  getModelPerformance(model?: LipSyncModel): ModelPerformanceMetrics | ModelPerformanceMetrics[] {
    if (model) {
      return this.modelPerformance.get(model) || this.createDefaultPerformanceMetrics(model);
    }

    return Array.from(this.modelPerformance.values());
  }

  /**
   * Get service health status.
   */
  getHealthStatus(): {
    healthy: boolean;
    activeSessions: number;
    gpuAvailable: boolean;
    modelStatus: Record<LipSyncModel, { available: boolean; latencyMs: number }>;
  } {
    const modelStatus = {} as Record<LipSyncModel, { available: boolean; latencyMs: number }>;

    for (const model of Object.values(LipSyncModel)) {
      const perf = this.modelPerformance.get(model);
      modelStatus[model] = {
        available: perf ? perf.successRate > 0.5 : true,
        latencyMs: perf?.averageLatencyMs || MODEL_CONFIGS[model].maxLatencyMs,
      };
    }

    return {
      healthy: this.activeSessions.size < this.config.maxConcurrentSessions,
      activeSessions: this.activeSessions.size,
      gpuAvailable: this.gpuAvailable,
      modelStatus,
    };
  }

  /**
   * End a session and clean up resources.
   */
  endSession(sessionId: string): void {
    this.activeSessions.delete(sessionId);
    this.sessionModels.delete(sessionId);
    this.videoStreamingService.clearSession(sessionId);
    this.videoGeneratorService.clearBuffer(sessionId);

    logger.debug('Session ended', { sessionId });
  }

  /**
   * Prepare frames for WebSocket streaming.
   */
  prepareForStreaming(sessionId: string, frames: GeneratedFrame[]) {
    return this.videoStreamingService.prepareFramesForStreaming(sessionId, frames);
  }

  /**
   * Get streaming service for direct access.
   */
  getStreamingService(): VideoStreamingService {
    return this.videoStreamingService;
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private initializeModelPerformance(): void {
    for (const model of Object.values(LipSyncModel)) {
      this.modelPerformance.set(model, this.createDefaultPerformanceMetrics(model));
    }
  }

  private createDefaultPerformanceMetrics(model: LipSyncModel): ModelPerformanceMetrics {
    const config = MODEL_CONFIGS[model];
    return {
      model,
      averageLatencyMs: config.maxLatencyMs,
      p95LatencyMs: config.maxLatencyMs * 1.5,
      p99LatencyMs: config.maxLatencyMs * 2,
      successRate: 1.0,
      qualityScore: config.minQualityScore,
      gpuUtilization: 0,
      memoryUsageMb: config.gpuMemoryMb,
      framesPerSecond: 1000 / config.maxLatencyMs,
      lastUpdated: new Date(),
    };
  }

  private updateModelPerformance(
    model: LipSyncModel,
    latencyMs: number,
    framesGenerated: number,
    success: boolean
  ): void {
    const metrics = this.modelPerformance.get(model);
    if (!metrics) return;

    // Update with exponential moving average
    const alpha = 0.1;
    metrics.averageLatencyMs = alpha * latencyMs + (1 - alpha) * metrics.averageLatencyMs;
    metrics.successRate = alpha * (success ? 1 : 0) + (1 - alpha) * metrics.successRate;

    if (framesGenerated > 0 && latencyMs > 0) {
      metrics.framesPerSecond = (framesGenerated / latencyMs) * 1000;
    }

    metrics.lastUpdated = new Date();
  }

  private selectAdaptively(candidates: LipSyncModel[]): LipSyncModel {
    // Score each model based on performance metrics
    let bestModel = candidates[0] || this.config.defaultModel;
    let bestScore = -Infinity;

    for (const model of candidates) {
      const perf = this.modelPerformance.get(model);
      const config = MODEL_CONFIGS[model];

      if (!perf) continue;

      // Calculate score: higher is better
      // Prioritize low latency and high success rate
      const latencyScore = 100 - Math.min(100, perf.averageLatencyMs);
      const successScore = perf.successRate * 100;
      const qualityScore = config.minQualityScore;

      const totalScore = latencyScore * 0.4 + successScore * 0.4 + qualityScore * 0.2;

      if (totalScore > bestScore) {
        bestScore = totalScore;
        bestModel = model;
      }
    }

    return bestModel;
  }

  private async tryFallback(
    request: LipSyncRequest,
    originalError: Error
  ): Promise<LipSyncResponse | null> {
    const currentModel = this.sessionModels.get(request.sessionId);
    const currentIndex = this.config.fallbackChain.indexOf(
      currentModel || this.config.defaultModel
    );

    // Try next model in fallback chain
    for (let i = currentIndex + 1; i < this.config.fallbackChain.length; i++) {
      const fallbackModel = this.config.fallbackChain[i];

      logger.info('Trying fallback model', {
        sessionId: request.sessionId,
        from: currentModel,
        to: fallbackModel,
      });

      try {
        this.sessionModels.set(request.sessionId, fallbackModel);
        return await this.processLipSync({
          ...request,
          modelPreference: fallbackModel,
        });
      } catch (error) {
        logger.warn('Fallback model failed', { model: fallbackModel, error });
        this.updateModelPerformance(fallbackModel, 0, 0, false);
      }
    }

    logger.error('All fallback models failed', {
      sessionId: request.sessionId,
      originalError: originalError.message,
    });

    return null;
  }

  private async benchmarkSingleModel(
    model: LipSyncModel,
    faceModel: FaceModel,
    testAudioChunk: AudioChunk
  ): Promise<ModelBenchmarkResult> {
    const startTime = Date.now();
    const latencies: number[] = [];

    // Run multiple iterations
    const iterations = 5;
    let totalFrames = 0;

    const preprocessedData = await this.faceModelCacheService.getPreprocessedData(
      faceModel.userId,
      faceModel.id
    );

    if (!preprocessedData) {
      throw new Error('Failed to preprocess face model');
    }

    for (let i = 0; i < iterations; i++) {
      const iterStart = Date.now();

      const audioFeatures = await this.audioFeatureService.extractFeatures(testAudioChunk);
      const frames = await this.videoGeneratorService.generateFrames(
        `benchmark_${i}`,
        audioFeatures,
        faceModel,
        preprocessedData,
        model
      );

      latencies.push(Date.now() - iterStart);
      totalFrames += frames.length;
    }

    const testDuration = Date.now() - startTime;
    const sortedLatencies = latencies.sort((a, b) => a - b);

    return {
      model,
      testDurationMs: testDuration,
      framesGenerated: totalFrames,
      averageLatencyMs: latencies.reduce((a, b) => a + b, 0) / latencies.length,
      maxLatencyMs: sortedLatencies[sortedLatencies.length - 1],
      minLatencyMs: sortedLatencies[0],
      qualityScore: MODEL_CONFIGS[model].minQualityScore,
      gpuMemoryPeakMb: MODEL_CONFIGS[model].gpuMemoryMb,
      isRecommended: false,
    };
  }

  private startPerformanceMonitoring(): void {
    setInterval(() => {
      // Check GPU availability
      this.checkGpuAvailability();

      // Log performance summary
      const summary = Array.from(this.modelPerformance.entries()).map(([model, perf]) => ({
        model,
        latency: Math.round(perf.averageLatencyMs),
        successRate: Math.round(perf.successRate * 100),
      }));

      logger.debug('Performance summary', {
        models: summary,
        activeSessions: this.activeSessions.size,
      });
    }, this.config.performanceMonitoringInterval);
  }

  private checkGpuAvailability(): void {
    // In production, this would check actual GPU status
    // For now, assume GPU is available
    this.gpuAvailable = true;
  }

  private createError(code: LipSyncErrorCode, message: string): LipSyncError {
    return {
      code,
      message,
      recoverable: code !== LipSyncErrorCode.FACE_MODEL_NOT_FOUND,
      fallbackAvailable: this.config.fallbackChain.length > 1,
    };
  }
}
