import { createLogger } from '@clone/logger';
import { SpeechClient, protos } from '@google-cloud/speech';
import { v4 as uuidv4 } from 'uuid';

import { ASRCacheService } from './cache';
import { asrConfig } from './config';
import { ASRMetricsService } from './metrics';
import { ASRQuotaService } from './quota';
import { ASRConfig, AudioEncoding, StreamHandle, TranscriptResult } from './types';

const logger = createLogger('asr-service');

type StreamingRecognitionConfig = protos.google.cloud.speech.v1.IStreamingRecognitionConfig;
type RecognitionConfig = protos.google.cloud.speech.v1.IRecognitionConfig;

/**
 * Google Chirp ASR Service
 * Provides streaming speech-to-text with Chirp model
 */
export class ASRService {
  private client: SpeechClient;
  private streams: Map<string, StreamHandle> = new Map();
  private cache: ASRCacheService;
  private metrics: ASRMetricsService;
  private quota: ASRQuotaService;
  private cleanupInterval?: NodeJS.Timeout;
  private metricsInterval?: NodeJS.Timeout;

  constructor() {
    this.client = new SpeechClient({
      projectId: asrConfig.gcpProjectId,
    });
    this.cache = new ASRCacheService();
    this.metrics = new ASRMetricsService();
    this.quota = new ASRQuotaService();

    logger.info('ASR Service initialized', {
      model: asrConfig.chirpModel,
      region: asrConfig.gcpRegion,
    });

    // Start periodic cleanup
    this.startCleanupInterval();
  }

  /**
   * Start a new streaming recognition session
   */
  async startStream(
    sessionId: string,
    userId: string,
    config: Partial<ASRConfig> = {}
  ): Promise<StreamHandle> {
    // Check quota
    const hasRateLimit = await this.quota.checkRateLimit(userId);
    if (!hasRateLimit) {
      throw new Error('Rate limit exceeded');
    }

    const hasDailyQuota = await this.quota.checkDailyQuota(userId);
    if (!hasDailyQuota) {
      throw new Error('Daily quota exceeded');
    }

    // Check concurrent streams limit
    if (this.streams.size >= asrConfig.maxConcurrentStreams) {
      throw new Error('Maximum concurrent streams reached');
    }

    // Merge with default config
    const fullConfig: ASRConfig = {
      sampleRate: config.sampleRate || 16000,
      encoding: config.encoding || AudioEncoding.LINEAR16,
      languageCode: config.languageCode || asrConfig.defaultLanguageCode,
      enableAutomaticPunctuation:
        config.enableAutomaticPunctuation ?? asrConfig.enableAutomaticPunctuation,
      enableWordTimeOffsets: config.enableWordTimeOffsets ?? false,
      model: config.model || (asrConfig.chirpModel as 'chirp'),
      enableInterimResults: config.enableInterimResults ?? asrConfig.enableInterimResults,
      maxAlternatives: config.maxAlternatives || 1,
      profanityFilter: config.profanityFilter ?? asrConfig.enableProfanityFilter,
      speechContexts: config.speechContexts || [],
      enableSpeakerDiarization: config.enableSpeakerDiarization ?? false,
      diarizationSpeakerCount: config.diarizationSpeakerCount,
    };

    // Create recognition config
    const recognitionConfig: RecognitionConfig = {
      encoding: fullConfig.encoding,
      sampleRateHertz: fullConfig.sampleRate,
      languageCode: fullConfig.languageCode,
      model: fullConfig.model,
      enableAutomaticPunctuation: fullConfig.enableAutomaticPunctuation,
      enableWordTimeOffsets: fullConfig.enableWordTimeOffsets,
      maxAlternatives: fullConfig.maxAlternatives,
      profanityFilter: fullConfig.profanityFilter,
      speechContexts: fullConfig.speechContexts as protos.google.cloud.speech.v1.ISpeechContext[],
    };

    // Add speaker diarization if enabled
    if (fullConfig.enableSpeakerDiarization) {
      recognitionConfig.diarizationConfig = {
        enableSpeakerDiarization: true,
        minSpeakerCount: 1,
        maxSpeakerCount: fullConfig.diarizationSpeakerCount || 2,
      };
    }

    // Add language detection if enabled
    if (asrConfig.enableLanguageDetection && !fullConfig.languageCode) {
      recognitionConfig.alternativeLanguageCodes = ['es-US', 'fr-FR', 'de-DE', 'ja-JP', 'zh-CN'];
    }

    const streamingConfig: StreamingRecognitionConfig = {
      config: recognitionConfig,
      interimResults: fullConfig.enableInterimResults,
    };

    // Create streaming recognize stream
    const stream = this.client.streamingRecognize(streamingConfig);

    const handle: StreamHandle = {
      id: uuidv4(),
      sessionId,
      stream,
      config: fullConfig,
      createdAt: new Date(),
    };

    this.streams.set(handle.id, handle);
    this.metrics.startSession(sessionId);

    logger.info('ASR stream started', {
      handleId: handle.id,
      sessionId,
      model: fullConfig.model,
      languageCode: fullConfig.languageCode,
    });

    return handle;
  }

  /**
   * Send audio chunk to stream
   */
  async sendAudioChunk(handleId: string, audioData: Buffer): Promise<void> {
    const handle = this.streams.get(handleId);
    if (!handle) {
      throw new Error(`Stream handle not found: ${handleId}`);
    }

    try {
      // Write audio content to the stream
      // The stream expects an object with audioContent property
      (handle.stream as unknown as { write: (data: { audioContent: Buffer }) => void }).write({
        audioContent: audioData,
      });
      this.metrics.recordAudioDuration(handle.sessionId, audioData.length / (16000 * 2)); // Approximate duration
    } catch (error) {
      logger.error('Error sending audio chunk', { handleId, error });
      this.metrics.recordError(handle.sessionId);
      throw error;
    }
  }

  /**
   * End streaming recognition
   */
  async endStream(handleId: string): Promise<void> {
    const handle = this.streams.get(handleId);
    if (!handle) {
      logger.warn('Attempted to end non-existent stream', { handleId });
      return;
    }

    try {
      handle.stream.end();
      this.streams.delete(handleId);

      const metrics = this.metrics.endSession(handle.sessionId);
      if (metrics) {
        // Record usage for quota tracking
        const audioMinutes = metrics.totalAudioDuration / 60000;
        await this.quota.recordUsage(handle.sessionId, audioMinutes);
      }

      logger.info('ASR stream ended', {
        handleId,
        sessionId: handle.sessionId,
      });
    } catch (error) {
      logger.error('Error ending stream', { handleId, error });
      throw error;
    }
  }

  /**
   * Set up event handlers for stream
   */
  onStreamEvents(
    handleId: string,
    callbacks: {
      onInterimResult?: (result: TranscriptResult) => void;
      onFinalResult?: (result: TranscriptResult) => void;
      onError?: (error: Error) => void;
      onEnd?: () => void;
    }
  ): void {
    const handle = this.streams.get(handleId);
    if (!handle) {
      throw new Error(`Stream handle not found: ${handleId}`);
    }

    const startTime = Date.now();

    handle.stream.on('data', (data: protos.google.cloud.speech.v1.IStreamingRecognizeResponse) => {
      const results = data.results;
      if (!results || results.length === 0) {
        return;
      }

      const result = results[0];
      if (!result.alternatives || result.alternatives.length === 0) {
        return;
      }

      const alternative = result.alternatives[0];
      if (!alternative || !alternative.transcript) {
        return;
      }

      const transcriptResult: TranscriptResult = {
        transcript: alternative.transcript,
        confidence: alternative.confidence || 0,
        isFinal: result.isFinal || false,
        languageCode: result.languageCode || undefined,
      };

      // Add word time offsets if available
      if (alternative.words && alternative.words.length > 0) {
        transcriptResult.words = alternative.words
          .filter((word) => word.word)
          .map((word) => ({
            word: word.word || '',
            startTime: (word.startTime?.seconds as number) || 0,
            endTime: (word.endTime?.seconds as number) || 0,
            confidence: word.confidence || 0,
            speakerTag: word.speakerTag || undefined,
          }));
      }

      // Add alternatives if available
      if (result.alternatives && result.alternatives.length > 1) {
        transcriptResult.alternatives = result.alternatives
          .slice(1)
          .filter((alt) => alt.transcript)
          .map((alt) => ({
            transcript: alt.transcript || '',
            confidence: alt.confidence || 0,
          }));
      }

      const latency = Date.now() - startTime;
      this.metrics.recordLatency(handle.sessionId, latency);

      if (result.isFinal) {
        this.metrics.recordFinalResult(handle.sessionId, alternative.confidence || 0);
        callbacks.onFinalResult?.(transcriptResult);

        // Cache final result if enabled
        if (asrConfig.enableCaching && (alternative.confidence || 0) > 0.8) {
          // Note: In production, we'd cache based on audio hash
          // For now, we skip caching in streaming mode
        }
      } else {
        this.metrics.recordInterimResult(handle.sessionId);
        callbacks.onInterimResult?.(transcriptResult);
      }
    });

    handle.stream.on('error', (error: Error) => {
      logger.error('ASR stream error', {
        handleId,
        sessionId: handle.sessionId,
        error: error.message,
      });
      this.metrics.recordError(handle.sessionId);
      callbacks.onError?.(error);
    });

    handle.stream.on('end', () => {
      logger.debug('ASR stream ended', { handleId });
      callbacks.onEnd?.();
    });
  }

  /**
   * Get active stream count
   */
  getActiveStreamCount(): number {
    return this.streams.size;
  }

  /**
   * Get stream handle
   */
  getStreamHandle(handleId: string): StreamHandle | undefined {
    return this.streams.get(handleId);
  }

  /**
   * Get metrics service
   */
  getMetrics(): ASRMetricsService {
    return this.metrics;
  }

  /**
   * Get quota service
   */
  getQuota(): ASRQuotaService {
    return this.quota;
  }

  /**
   * Get cache service
   */
  getCache(): ASRCacheService {
    return this.cache;
  }

  /**
   * Start periodic cleanup
   */
  private startCleanupInterval(): void {
    // Clean up expired streams every minute
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      const maxAge = asrConfig.maxStreamDuration;

      for (const [handleId, handle] of this.streams.entries()) {
        const age = now - handle.createdAt.getTime();
        if (age > maxAge) {
          logger.warn('Cleaning up expired stream', {
            handleId,
            sessionId: handle.sessionId,
            age,
          });
          this.endStream(handleId).catch((error) => {
            logger.error('Error cleaning up stream', { handleId, error });
          });
        }
      }

      // Clean up cache and quota data
      this.cache.cleanup();
      this.quota.cleanup();
    }, 60000);

    // Unref the interval so it doesn't keep the process alive
    this.cleanupInterval.unref();

    // Log metrics periodically
    if (asrConfig.monitoring.enableMetrics) {
      this.metricsInterval = setInterval(() => {
        this.metrics.logMetrics();
      }, asrConfig.monitoring.metricsInterval);

      // Unref the interval so it doesn't keep the process alive
      this.metricsInterval.unref();
    }
  }

  /**
   * Shutdown service gracefully
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down ASR service', {
      activeStreams: this.streams.size,
    });

    // Clear intervals
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = undefined;
    }

    // End all active streams
    const promises = Array.from(this.streams.keys()).map((handleId) => this.endStream(handleId));

    await Promise.all(promises);

    logger.info('ASR service shutdown complete');
  }
}
