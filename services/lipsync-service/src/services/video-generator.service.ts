import { createLogger } from '@clone/logger';
import { FaceModel } from '@clone/shared-types';

import {
  AudioFeatures,
  LipSyncModel,
  VideoGenerationConfig,
  GeneratedFrame,
  FrameBuffer,
  VideoGenerationMetrics,
  PreprocessedFaceData,
  Resolution,
} from '../types';

const logger = createLogger('VideoGeneratorService');

// Default video generation configuration
const DEFAULT_CONFIG: VideoGenerationConfig = {
  targetFps: 20,
  resolution: { width: 256, height: 256 },
  format: 'jpeg',
  quality: 85,
  enableInterpolation: true,
  bufferSizeFrames: 10,
};

/**
 * Service for generating lip-synced video frames from audio features.
 */
export class VideoGeneratorService {
  private config: VideoGenerationConfig;
  private metrics: VideoGenerationMetrics;
  private frameBuffer: Map<string, FrameBuffer> = new Map();
  private frameCache: Map<string, GeneratedFrame> = new Map();
  private readonly maxCacheSize = 500;

  constructor(config?: Partial<VideoGenerationConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.metrics = this.initializeMetrics();

    logger.info('VideoGeneratorService initialized', { config: this.config });
  }

  /**
   * Generate video frames synchronized with audio features.
   */
  async generateFrames(
    sessionId: string,
    audioFeatures: AudioFeatures,
    faceModel: FaceModel,
    preprocessedData: PreprocessedFaceData,
    lipSyncModel: LipSyncModel
  ): Promise<GeneratedFrame[]> {
    const startTime = Date.now();
    const frames: GeneratedFrame[] = [];

    try {
      // Calculate number of frames needed
      const frameDuration = 1000 / this.config.targetFps;
      const numFrames = Math.ceil(audioFeatures.duration / frameDuration);

      for (let i = 0; i < numFrames; i++) {
        const frameTimestamp = audioFeatures.timestamp + i * frameDuration;
        const audioTimestamp = frameTimestamp;

        // Check cache first
        const cacheKey = this.generateFrameCacheKey(faceModel.id, audioFeatures, i);
        const cachedFrame = this.frameCache.get(cacheKey);

        if (cachedFrame) {
          frames.push({ ...cachedFrame, timestamp: frameTimestamp });
          continue;
        }

        // Generate frame based on lip-sync model
        const frame = await this.generateSingleFrame(
          i,
          frameTimestamp,
          audioTimestamp,
          audioFeatures,
          faceModel,
          preprocessedData,
          lipSyncModel
        );

        frames.push(frame);

        // Cache the frame
        this.addToFrameCache(cacheKey, frame);
      }

      // Update metrics
      const processingTime = Date.now() - startTime;
      this.updateMetrics(frames.length, processingTime, lipSyncModel);

      // Add to frame buffer
      this.addToBuffer(sessionId, frames, audioFeatures.timestamp);

      return frames;
    } catch (error) {
      logger.error('Failed to generate video frames', { error, sessionId });
      this.metrics.framesDropped += 1;
      throw error;
    }
  }

  /**
   * Generate a single video frame.
   */
  private async generateSingleFrame(
    sequenceNumber: number,
    timestamp: number,
    audioTimestamp: number,
    audioFeatures: AudioFeatures,
    faceModel: FaceModel,
    preprocessedData: PreprocessedFaceData,
    lipSyncModel: LipSyncModel
  ): Promise<GeneratedFrame> {
    const frameStartTime = Date.now();

    // Get the mel spectrogram frame for this timestamp
    const melFrameIndex = this.getMelFrameIndex(audioFeatures, timestamp - audioFeatures.timestamp);
    const melFrame = audioFeatures.melSpectrogram[melFrameIndex] || [];

    // Generate frame based on model
    let frameData: Buffer;
    let isInterpolated = false;

    switch (lipSyncModel) {
      case LipSyncModel.TPSM:
        frameData = await this.generateTPSMFrame(melFrame, preprocessedData, faceModel.resolution);
        break;
      case LipSyncModel.WAV2LIP:
        frameData = await this.generateWav2LipFrame(
          melFrame,
          preprocessedData,
          faceModel.resolution
        );
        break;
      case LipSyncModel.SADTALKER:
        frameData = await this.generateSadTalkerFrame(
          melFrame,
          audioFeatures,
          preprocessedData,
          faceModel.resolution
        );
        break;
      case LipSyncModel.AUDIO2HEAD:
        frameData = await this.generateAudio2HeadFrame(
          melFrame,
          audioFeatures,
          preprocessedData,
          faceModel.resolution
        );
        break;
      case LipSyncModel.STATIC:
      default:
        frameData = await this.generateStaticFrame(
          melFrame,
          preprocessedData,
          faceModel.resolution
        );
        break;
    }

    // Apply interpolation if enabled and we have previous frame
    if (this.config.enableInterpolation && sequenceNumber > 0) {
      // Interpolation would be applied here in production
      isInterpolated = false;
    }

    const generationTime = Date.now() - frameStartTime;

    return {
      data: frameData,
      timestamp,
      format: this.config.format,
      width: this.config.resolution.width,
      height: this.config.resolution.height,
      audioTimestamp,
      sequenceNumber,
      lipSyncModel,
      generationTimeMs: generationTime,
      isInterpolated,
    };
  }

  /**
   * Generate frame using TPSM (Thin-Plate Spline Motion).
   * This is the fastest model, suitable for real-time streaming.
   */
  private async generateTPSMFrame(
    melFrame: number[],
    preprocessedData: PreprocessedFaceData,
    resolution: Resolution
  ): Promise<Buffer> {
    // TPSM uses thin-plate spline warping based on audio features
    // This is a placeholder - actual implementation would use the TPSM model

    // Calculate mouth openness from mel features
    const mouthOpenness = this.calculateMouthOpenness(melFrame);

    // Generate warped face image
    return this.generatePlaceholderFrame(resolution, mouthOpenness, preprocessedData);
  }

  /**
   * Generate frame using Wav2Lip.
   * Higher quality but slower than TPSM.
   */
  private async generateWav2LipFrame(
    melFrame: number[],
    preprocessedData: PreprocessedFaceData,
    resolution: Resolution
  ): Promise<Buffer> {
    // Wav2Lip generates lip movements directly from mel spectrogram
    // This is a placeholder - actual implementation would use the Wav2Lip model

    const mouthOpenness = this.calculateMouthOpenness(melFrame);

    return this.generatePlaceholderFrame(resolution, mouthOpenness, preprocessedData);
  }

  /**
   * Generate frame using SadTalker.
   * Includes head motion and natural lip-sync.
   */
  private async generateSadTalkerFrame(
    melFrame: number[],
    audioFeatures: AudioFeatures,
    preprocessedData: PreprocessedFaceData,
    resolution: Resolution
  ): Promise<Buffer> {
    // SadTalker generates both head motion and lip-sync
    // This is a placeholder - actual implementation would use the SadTalker model

    const mouthOpenness = this.calculateMouthOpenness(melFrame);
    const headPose = this.estimateHeadPose(audioFeatures);

    return this.generatePlaceholderFrame(resolution, mouthOpenness, preprocessedData, headPose);
  }

  /**
   * Generate frame using Audio2Head.
   * Advanced facial animation with head motion.
   */
  private async generateAudio2HeadFrame(
    melFrame: number[],
    audioFeatures: AudioFeatures,
    preprocessedData: PreprocessedFaceData,
    resolution: Resolution
  ): Promise<Buffer> {
    // Audio2Head generates head pose from audio
    // This is a placeholder - actual implementation would use the Audio2Head model

    const mouthOpenness = this.calculateMouthOpenness(melFrame);
    const headPose = this.estimateHeadPose(audioFeatures);

    return this.generatePlaceholderFrame(resolution, mouthOpenness, preprocessedData, headPose);
  }

  /**
   * Generate static frame with animated mouth overlay.
   * Fallback when GPU resources are constrained.
   */
  private async generateStaticFrame(
    melFrame: number[],
    preprocessedData: PreprocessedFaceData,
    resolution: Resolution
  ): Promise<Buffer> {
    // Static frame with simple mouth animation overlay
    const mouthOpenness = this.calculateMouthOpenness(melFrame);

    return this.generatePlaceholderFrame(resolution, mouthOpenness, preprocessedData);
  }

  /**
   * Generate a placeholder frame for demonstration.
   * In production, this would be replaced with actual model inference.
   */
  private generatePlaceholderFrame(
    resolution: Resolution,
    mouthOpenness: number,
    preprocessedData: PreprocessedFaceData,
    _headPose?: { yaw: number; pitch: number; roll: number }
  ): Buffer {
    // Create a simple placeholder image
    // In production, this would use the actual face model and lip-sync model

    const { width, height } = resolution;

    // If we have aligned face data, use it as base
    if (preprocessedData.alignedFace && preprocessedData.alignedFace.length > 0) {
      // Return the aligned face with modifications
      // In production, this would apply lip-sync transformations
      return preprocessedData.alignedFace;
    }

    // Generate a simple placeholder (gray image with mouth indicator)
    const pixelCount = width * height * 3; // RGB
    const buffer = Buffer.alloc(pixelCount);

    // Fill with gray
    for (let i = 0; i < pixelCount; i += 3) {
      buffer[i] = 128; // R
      buffer[i + 1] = 128; // G
      buffer[i + 2] = 128; // B
    }

    // Draw mouth indicator based on openness
    const mouthY = Math.floor(height * 0.7);
    const mouthHeight = Math.floor(mouthOpenness * 20);
    const mouthWidth = Math.floor(width * 0.3);
    const mouthX = Math.floor((width - mouthWidth) / 2);

    for (let y = mouthY; y < mouthY + mouthHeight && y < height; y++) {
      for (let x = mouthX; x < mouthX + mouthWidth && x < width; x++) {
        const idx = (y * width + x) * 3;
        buffer[idx] = 200; // R
        buffer[idx + 1] = 100; // G
        buffer[idx + 2] = 100; // B
      }
    }

    return buffer;
  }

  /**
   * Calculate mouth openness from mel spectrogram frame.
   */
  private calculateMouthOpenness(melFrame: number[]): number {
    if (melFrame.length === 0) return 0;

    // Calculate energy in speech frequency range
    const speechBins = melFrame.slice(10, 40);
    const energy = speechBins.reduce((sum, v) => sum + Math.exp(v), 0) / speechBins.length;

    // Normalize to 0-1 range
    return Math.min(1, Math.max(0, energy / 10));
  }

  /**
   * Estimate head pose from audio features.
   */
  private estimateHeadPose(audioFeatures: AudioFeatures): {
    yaw: number;
    pitch: number;
    roll: number;
  } {
    // Simple head pose estimation based on audio energy and pitch
    // In production, this would use a trained model

    const energyFactor = Math.min(1, audioFeatures.energy * 10);
    const pitchFactor = (audioFeatures.pitch - 150) / 300; // Normalize around 150Hz

    return {
      yaw: pitchFactor * 5, // Slight head turn based on pitch
      pitch: energyFactor * 3, // Slight nod based on energy
      roll: 0,
    };
  }

  /**
   * Get mel spectrogram frame index for a given timestamp offset.
   */
  private getMelFrameIndex(audioFeatures: AudioFeatures, offsetMs: number): number {
    const frameCount = audioFeatures.melSpectrogram.length;
    const frameDuration = audioFeatures.duration / frameCount;
    return Math.min(frameCount - 1, Math.max(0, Math.floor(offsetMs / frameDuration)));
  }

  /**
   * Apply frame interpolation for smoother animation.
   */
  interpolateFrames(
    prevFrame: GeneratedFrame,
    nextFrame: GeneratedFrame,
    factor: number
  ): GeneratedFrame {
    // Linear interpolation between frames
    // In production, this would use more sophisticated interpolation

    const timestamp = prevFrame.timestamp + (nextFrame.timestamp - prevFrame.timestamp) * factor;

    return {
      ...prevFrame,
      timestamp,
      audioTimestamp:
        prevFrame.audioTimestamp + (nextFrame.audioTimestamp - prevFrame.audioTimestamp) * factor,
      isInterpolated: true,
    };
  }

  /**
   * Drop frames for performance optimization.
   */
  dropFramesForPerformance(frames: GeneratedFrame[], targetFps: number): GeneratedFrame[] {
    if (frames.length <= 1) return frames;

    const currentFps = this.config.targetFps;
    if (targetFps >= currentFps) return frames;

    const dropRatio = 1 - targetFps / currentFps;
    const result: GeneratedFrame[] = [];

    for (let i = 0; i < frames.length; i++) {
      if (Math.random() > dropRatio) {
        result.push(frames[i]);
      } else {
        this.metrics.framesDropped++;
      }
    }

    return result;
  }

  /**
   * Get buffered frames for a session.
   */
  getBufferedFrames(sessionId: string): FrameBuffer | null {
    return this.frameBuffer.get(sessionId) || null;
  }

  /**
   * Clear frame buffer for a session.
   */
  clearBuffer(sessionId: string): void {
    this.frameBuffer.delete(sessionId);
  }

  /**
   * Get current metrics.
   */
  getMetrics(): VideoGenerationMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset metrics.
   */
  resetMetrics(): void {
    this.metrics = this.initializeMetrics();
  }

  /**
   * Update video generation configuration.
   */
  updateConfig(config: Partial<VideoGenerationConfig>): void {
    this.config = { ...this.config, ...config };
    logger.info('Video generation config updated', { config: this.config });
  }

  /**
   * Clear frame cache.
   */
  clearCache(): void {
    this.frameCache.clear();
    logger.info('Frame cache cleared');
  }

  // ============================================================================
  // Private Methods - Buffering and Caching
  // ============================================================================

  private addToBuffer(sessionId: string, frames: GeneratedFrame[], startTimestamp: number): void {
    const existing = this.frameBuffer.get(sessionId);

    if (existing) {
      // Append to existing buffer
      existing.frames.push(...frames);
      existing.endTimestamp = frames[frames.length - 1]?.timestamp || existing.endTimestamp;
      existing.totalDurationMs = existing.endTimestamp - existing.startTimestamp;

      // Trim buffer if too large
      while (existing.frames.length > this.config.bufferSizeFrames * 2) {
        existing.frames.shift();
        existing.startTimestamp = existing.frames[0]?.timestamp || startTimestamp;
      }
    } else {
      // Create new buffer
      this.frameBuffer.set(sessionId, {
        frames,
        startTimestamp,
        endTimestamp: frames[frames.length - 1]?.timestamp || startTimestamp,
        totalDurationMs:
          frames.length > 0 ? frames[frames.length - 1].timestamp - startTimestamp : 0,
      });
    }
  }

  private generateFrameCacheKey(
    faceModelId: string,
    audioFeatures: AudioFeatures,
    frameIndex: number
  ): string {
    // Create a hash from audio features for caching
    const melHash =
      audioFeatures.melSpectrogram[frameIndex]
        ?.slice(0, 10)
        .reduce((h, v) => h + Math.floor(v * 100), 0) || 0;

    return `${faceModelId}_${melHash}_${frameIndex}`;
  }

  private addToFrameCache(key: string, frame: GeneratedFrame): void {
    // Evict old entries if cache is full
    if (this.frameCache.size >= this.maxCacheSize) {
      const firstKey = this.frameCache.keys().next().value;
      if (firstKey) {
        this.frameCache.delete(firstKey);
      }
    }

    this.frameCache.set(key, frame);
  }

  // ============================================================================
  // Private Methods - Metrics
  // ============================================================================

  private initializeMetrics(): VideoGenerationMetrics {
    return {
      framesGenerated: 0,
      framesDropped: 0,
      averageGenerationTimeMs: 0,
      averageFps: 0,
      bufferUnderruns: 0,
      modelSwitches: 0,
    };
  }

  private updateMetrics(
    framesGenerated: number,
    processingTimeMs: number,
    _lipSyncModel: LipSyncModel
  ): void {
    this.metrics.framesGenerated += framesGenerated;

    // Update average generation time
    const totalFrames = this.metrics.framesGenerated;
    const prevTotal = this.metrics.averageGenerationTimeMs * (totalFrames - framesGenerated);
    this.metrics.averageGenerationTimeMs = (prevTotal + processingTimeMs) / totalFrames;

    // Update average FPS
    if (processingTimeMs > 0) {
      const currentFps = (framesGenerated / processingTimeMs) * 1000;
      this.metrics.averageFps =
        (this.metrics.averageFps * (totalFrames - framesGenerated) + currentFps * framesGenerated) /
        totalFrames;
    }
  }
}
