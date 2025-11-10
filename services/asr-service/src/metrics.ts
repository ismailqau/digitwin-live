import { createLogger } from '@clone/logger';

import { ASRMetrics } from './types';

const logger = createLogger('asr-metrics');

/**
 * ASR Performance Monitoring Service
 * Tracks latency, accuracy, cost, and other metrics
 */
export class ASRMetricsService {
  private metrics: Map<string, ASRMetrics> = new Map();
  private costPerMinute = 0.006; // Google Chirp pricing: $0.006/minute

  /**
   * Start tracking metrics for a session
   */
  startSession(sessionId: string): void {
    this.metrics.set(sessionId, {
      sessionId,
      startTime: new Date(),
      totalAudioDuration: 0,
      transcriptionLatency: 0,
      cost: 0,
      errorCount: 0,
      interimResultCount: 0,
      finalResultCount: 0,
    });
  }

  /**
   * Record audio duration
   */
  recordAudioDuration(sessionId: string, durationMs: number): void {
    const metrics = this.metrics.get(sessionId);
    if (metrics) {
      metrics.totalAudioDuration += durationMs;
    }
  }

  /**
   * Record transcription latency
   */
  recordLatency(sessionId: string, latencyMs: number): void {
    const metrics = this.metrics.get(sessionId);
    if (metrics) {
      metrics.transcriptionLatency = latencyMs;
    }
  }

  /**
   * Record interim result
   */
  recordInterimResult(sessionId: string): void {
    const metrics = this.metrics.get(sessionId);
    if (metrics) {
      metrics.interimResultCount++;
    }
  }

  /**
   * Record final result
   */
  recordFinalResult(sessionId: string, confidence: number): void {
    const metrics = this.metrics.get(sessionId);
    if (metrics) {
      metrics.finalResultCount++;
      metrics.accuracy = confidence;
    }
  }

  /**
   * Record error
   */
  recordError(sessionId: string): void {
    const metrics = this.metrics.get(sessionId);
    if (metrics) {
      metrics.errorCount++;
    }
  }

  /**
   * End session and calculate final metrics
   */
  endSession(sessionId: string): ASRMetrics | null {
    const metrics = this.metrics.get(sessionId);
    if (!metrics) {
      return null;
    }

    metrics.endTime = new Date();

    // Calculate cost based on audio duration
    const audioMinutes = metrics.totalAudioDuration / 60000;
    metrics.cost = audioMinutes * this.costPerMinute;

    logger.info('ASR session completed', {
      sessionId,
      duration: metrics.totalAudioDuration,
      latency: metrics.transcriptionLatency,
      accuracy: metrics.accuracy,
      cost: metrics.cost.toFixed(4),
      errors: metrics.errorCount,
    });

    // Store metrics for reporting
    // TODO: Store in database for analytics
    // await db.asr_metrics.create({ data: metrics });

    this.metrics.delete(sessionId);
    return metrics;
  }

  /**
   * Get current metrics for a session
   */
  getMetrics(sessionId: string): ASRMetrics | null {
    return this.metrics.get(sessionId) || null;
  }

  /**
   * Get aggregate metrics across all sessions
   */
  getAggregateMetrics() {
    const sessions = Array.from(this.metrics.values());

    if (sessions.length === 0) {
      return {
        activeSessions: 0,
        totalAudioDuration: 0,
        averageLatency: 0,
        averageAccuracy: 0,
        totalCost: 0,
        totalErrors: 0,
      };
    }

    const totalAudioDuration = sessions.reduce((sum, m) => sum + m.totalAudioDuration, 0);
    const averageLatency =
      sessions.reduce((sum, m) => sum + m.transcriptionLatency, 0) / sessions.length;
    const accuracySessions = sessions.filter((m) => m.accuracy !== undefined);
    const averageAccuracy =
      accuracySessions.length > 0
        ? accuracySessions.reduce((sum, m) => sum + (m.accuracy || 0), 0) / accuracySessions.length
        : 0;
    const totalCost = sessions.reduce((sum, m) => sum + m.cost, 0);
    const totalErrors = sessions.reduce((sum, m) => sum + m.errorCount, 0);

    return {
      activeSessions: sessions.length,
      totalAudioDuration,
      averageLatency,
      averageAccuracy,
      totalCost,
      totalErrors,
    };
  }

  /**
   * Log metrics periodically
   */
  logMetrics(): void {
    const aggregate = this.getAggregateMetrics();
    logger.info('ASR aggregate metrics', aggregate);
  }
}
