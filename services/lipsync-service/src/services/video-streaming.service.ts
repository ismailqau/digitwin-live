import { createLogger } from '@clone/logger';

import { GeneratedFrame, VideoStreamConfig, StreamingMetrics, SyncState } from '../types';

const logger = createLogger('VideoStreamingService');

// Default streaming configuration
const DEFAULT_STREAM_CONFIG: VideoStreamConfig = {
  codec: 'h264',
  bitrate: 500000, // 500 kbps
  keyframeInterval: 30, // Every 30 frames
  enableAdaptiveBitrate: true,
  minBitrate: 100000, // 100 kbps
  maxBitrate: 2000000, // 2 Mbps
};

// Sync tolerance in milliseconds
const SYNC_TOLERANCE_MS = 50;

/**
 * Service for streaming video frames with audio synchronization.
 */
export class VideoStreamingService {
  private config: VideoStreamConfig;
  private sessionMetrics: Map<string, StreamingMetrics> = new Map();
  private sessionSyncState: Map<string, SyncState> = new Map();
  private frameQueues: Map<string, GeneratedFrame[]> = new Map();
  private readonly maxQueueSize = 100;

  constructor(config?: Partial<VideoStreamConfig>) {
    this.config = { ...DEFAULT_STREAM_CONFIG, ...config };
    logger.info('VideoStreamingService initialized', { config: this.config });
  }

  /**
   * Prepare frames for streaming over WebSocket.
   */
  prepareFramesForStreaming(sessionId: string, frames: GeneratedFrame[]): StreamingFrame[] {
    const streamingFrames: StreamingFrame[] = [];

    for (let i = 0; i < frames.length; i++) {
      const frame = frames[i];
      const isKeyframe = i % this.config.keyframeInterval === 0;

      // Encode frame for streaming
      const encodedData = this.encodeFrame(frame, isKeyframe);

      streamingFrames.push({
        sessionId,
        sequenceNumber: frame.sequenceNumber,
        timestamp: frame.timestamp,
        audioTimestamp: frame.audioTimestamp,
        data: encodedData,
        isKeyframe,
        format: this.config.codec,
        size: encodedData.length,
      });
    }

    // Update metrics
    this.updateStreamingMetrics(sessionId, streamingFrames);

    return streamingFrames;
  }

  /**
   * Create WebSocket message for video frame.
   */
  createWebSocketMessage(frame: StreamingFrame): VideoWebSocketMessage {
    return {
      type: 'response_video',
      sessionId: frame.sessionId,
      turnId: '', // Set by caller
      frameData: frame.data.toString('base64'),
      sequenceNumber: frame.sequenceNumber,
      timestamp: frame.timestamp,
      audioTimestamp: frame.audioTimestamp,
      format: frame.format,
      isKeyframe: frame.isKeyframe,
    };
  }

  /**
   * Calculate audio-video synchronization state.
   */
  calculateSyncState(sessionId: string, audioTimestamp: number, videoTimestamp: number): SyncState {
    const offsetMs = videoTimestamp - audioTimestamp;
    const isInSync = Math.abs(offsetMs) <= SYNC_TOLERANCE_MS;

    const syncState: SyncState = {
      audioTimestamp,
      videoTimestamp,
      offsetMs,
      isInSync,
      correctionApplied: false,
    };

    // Store sync state
    this.sessionSyncState.set(sessionId, syncState);

    // Log if out of sync
    if (!isInSync) {
      logger.warn('Audio-video sync drift detected', {
        sessionId,
        offsetMs,
        tolerance: SYNC_TOLERANCE_MS,
      });
    }

    return syncState;
  }

  /**
   * Apply sync correction to frames.
   */
  applySyncCorrection(frames: GeneratedFrame[], syncState: SyncState): GeneratedFrame[] {
    if (syncState.isInSync) return frames;

    const correction = -syncState.offsetMs;

    return frames.map((frame) => ({
      ...frame,
      timestamp: frame.timestamp + correction,
    }));
  }

  /**
   * Adapt bitrate based on network conditions.
   */
  adaptBitrate(sessionId: string, networkBandwidthKbps: number, packetLossPercent: number): number {
    if (!this.config.enableAdaptiveBitrate) {
      return this.config.bitrate;
    }

    let targetBitrate = this.config.bitrate;

    // Reduce bitrate if bandwidth is limited
    const availableBandwidth = networkBandwidthKbps * 1000 * 0.8; // Use 80% of available
    if (availableBandwidth < targetBitrate) {
      targetBitrate = availableBandwidth;
    }

    // Further reduce if packet loss is high
    if (packetLossPercent > 5) {
      targetBitrate *= 0.7;
    } else if (packetLossPercent > 2) {
      targetBitrate *= 0.85;
    }

    // Clamp to min/max
    targetBitrate = Math.max(
      this.config.minBitrate,
      Math.min(this.config.maxBitrate, targetBitrate)
    );

    logger.debug('Bitrate adapted', {
      sessionId,
      networkBandwidthKbps,
      packetLossPercent,
      targetBitrate,
    });

    return targetBitrate;
  }

  /**
   * Handle frame skipping for network congestion.
   */
  skipFramesForCongestion(
    frames: GeneratedFrame[],
    congestionLevel: number // 0-1, higher = more congestion
  ): GeneratedFrame[] {
    if (congestionLevel < 0.3) return frames;

    const skipRatio = Math.min(0.5, congestionLevel);
    const result: GeneratedFrame[] = [];

    for (let i = 0; i < frames.length; i++) {
      // Always keep keyframes
      if (i % this.config.keyframeInterval === 0) {
        result.push(frames[i]);
        continue;
      }

      // Skip non-keyframes based on congestion
      if (Math.random() > skipRatio) {
        result.push(frames[i]);
      }
    }

    logger.debug('Frames skipped for congestion', {
      original: frames.length,
      remaining: result.length,
      congestionLevel,
    });

    return result;
  }

  /**
   * Queue frames for buffered delivery.
   */
  queueFrames(sessionId: string, frames: GeneratedFrame[]): void {
    let queue = this.frameQueues.get(sessionId);

    if (!queue) {
      queue = [];
      this.frameQueues.set(sessionId, queue);
    }

    queue.push(...frames);

    // Trim queue if too large
    while (queue.length > this.maxQueueSize) {
      queue.shift();
    }
  }

  /**
   * Get queued frames for delivery.
   */
  dequeueFrames(sessionId: string, count: number): GeneratedFrame[] {
    const queue = this.frameQueues.get(sessionId);
    if (!queue || queue.length === 0) return [];

    return queue.splice(0, Math.min(count, queue.length));
  }

  /**
   * Get queue status for a session.
   */
  getQueueStatus(sessionId: string): {
    size: number;
    oldestTimestamp: number | null;
    newestTimestamp: number | null;
  } {
    const queue = this.frameQueues.get(sessionId);

    if (!queue || queue.length === 0) {
      return { size: 0, oldestTimestamp: null, newestTimestamp: null };
    }

    return {
      size: queue.length,
      oldestTimestamp: queue[0].timestamp,
      newestTimestamp: queue[queue.length - 1].timestamp,
    };
  }

  /**
   * Get streaming metrics for a session.
   */
  getMetrics(sessionId: string): StreamingMetrics | null {
    return this.sessionMetrics.get(sessionId) || null;
  }

  /**
   * Get sync state for a session.
   */
  getSyncState(sessionId: string): SyncState | null {
    return this.sessionSyncState.get(sessionId) || null;
  }

  /**
   * Clear session data.
   */
  clearSession(sessionId: string): void {
    this.sessionMetrics.delete(sessionId);
    this.sessionSyncState.delete(sessionId);
    this.frameQueues.delete(sessionId);
    logger.debug('Session data cleared', { sessionId });
  }

  /**
   * Handle streaming error and attempt recovery.
   */
  handleStreamingError(sessionId: string, error: Error): StreamingRecoveryAction {
    logger.error('Streaming error', { sessionId, error: error.message });

    const metrics = this.sessionMetrics.get(sessionId);

    if (!metrics) {
      return { action: 'reconnect', reason: 'No session metrics' };
    }

    // High packet loss - reduce quality
    if (metrics.packetsLost / (metrics.bytesSent / 1000) > 0.1) {
      return {
        action: 'reduce_quality',
        reason: 'High packet loss',
        newBitrate: this.config.minBitrate,
      };
    }

    // High latency - skip frames
    if (metrics.latencyMs > 500) {
      return {
        action: 'skip_frames',
        reason: 'High latency',
        skipRatio: 0.3,
      };
    }

    // Default - attempt reconnect
    return { action: 'reconnect', reason: 'Unknown error' };
  }

  /**
   * Update streaming configuration.
   */
  updateConfig(config: Partial<VideoStreamConfig>): void {
    this.config = { ...this.config, ...config };
    logger.info('Streaming config updated', { config: this.config });
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private encodeFrame(frame: GeneratedFrame, isKeyframe: boolean): Buffer {
    // In production, this would use actual H.264 encoding
    // For now, we'll use the raw frame data with a simple header

    const header = Buffer.alloc(16);
    header.writeUInt32BE(frame.sequenceNumber, 0);
    header.writeUInt32BE(Math.floor(frame.timestamp), 4);
    header.writeUInt16BE(frame.width, 8);
    header.writeUInt16BE(frame.height, 10);
    header.writeUInt8(isKeyframe ? 1 : 0, 12);
    header.writeUInt8(frame.format === 'h264' ? 1 : 0, 13);

    return Buffer.concat([header, frame.data]);
  }

  private updateStreamingMetrics(sessionId: string, frames: StreamingFrame[]): void {
    let metrics = this.sessionMetrics.get(sessionId);

    if (!metrics) {
      metrics = {
        bytesSent: 0,
        packetsLost: 0,
        latencyMs: 0,
        jitterMs: 0,
        currentBitrate: this.config.bitrate,
      };
      this.sessionMetrics.set(sessionId, metrics);
    }

    // Update bytes sent
    const totalBytes = frames.reduce((sum, f) => sum + f.size, 0);
    metrics.bytesSent += totalBytes;

    // Calculate current bitrate
    if (frames.length > 1) {
      const duration = frames[frames.length - 1].timestamp - frames[0].timestamp;
      if (duration > 0) {
        metrics.currentBitrate = (totalBytes * 8 * 1000) / duration;
      }
    }
  }
}

// ============================================================================
// Supporting Types
// ============================================================================

export interface StreamingFrame {
  sessionId: string;
  sequenceNumber: number;
  timestamp: number;
  audioTimestamp: number;
  data: Buffer;
  isKeyframe: boolean;
  format: string;
  size: number;
}

export interface VideoWebSocketMessage {
  type: 'response_video';
  sessionId: string;
  turnId: string;
  frameData: string; // base64 encoded
  sequenceNumber: number;
  timestamp: number;
  audioTimestamp: number;
  format: string;
  isKeyframe: boolean;
}

export interface StreamingRecoveryAction {
  action: 'reconnect' | 'reduce_quality' | 'skip_frames' | 'audio_only';
  reason: string;
  newBitrate?: number;
  skipRatio?: number;
}
