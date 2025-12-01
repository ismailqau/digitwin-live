/* eslint-disable @typescript-eslint/no-explicit-any */
import { createLogger } from '@clone/logger';
import { TTSProvider } from '@clone/shared-types';
import winston from 'winston';

import { ITTSProvider } from '../interfaces/ITTSProvider';
import { TTSMetrics, VoiceModelMetadata, VoiceQualityMetrics, ProviderQuota } from '../types';

export abstract class BaseProvider implements ITTSProvider {
  protected logger: winston.Logger;
  protected metrics: TTSMetrics;
  protected config: Record<string, any> = {};
  protected quotaUsage: ProviderQuota;

  constructor(
    public readonly provider: TTSProvider,
    logger?: winston.Logger
  ) {
    this.logger = logger || createLogger(`tts-${provider}`);
    this.metrics = {
      requestCount: 0,
      totalLatency: 0,
      averageLatency: 0,
      errorCount: 0,
      totalCost: 0,
      lastUsed: new Date(),
      successRate: 1.0,
      averageQualityScore: 0.85,
      quotaUsed: 0,
      quotaLimit: 1000000, // Default 1M characters
    };

    this.quotaUsage = {
      provider: this.provider,
      charactersUsed: 0,
      charactersLimit: 1000000,
      requestsUsed: 0,
      requestsLimit: 10000,
      resetDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
      isExceeded: false,
    };
  }

  abstract get isAvailable(): boolean;
  abstract initialize(config: Record<string, any>): Promise<void>;
  abstract synthesize(request: any): Promise<any>;
  abstract synthesizeStream(request: any): AsyncGenerator<any, void, unknown>;
  abstract getAvailableVoices(): Promise<string[]>;
  abstract estimateCost(text: string, options?: any): Promise<number>;

  async validateVoiceModel(voiceModel: VoiceModelMetadata): Promise<boolean> {
    try {
      return voiceModel.provider === this.provider && voiceModel.isActive;
    } catch (error) {
      this.logger.error('Voice model validation failed', { error, voiceModel });
      return false;
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      // Basic health check - can be overridden by providers
      return this.isAvailable;
    } catch (error) {
      this.logger.error('Health check failed', { error });
      return false;
    }
  }

  async getMetrics(): Promise<Record<string, any>> {
    return {
      ...this.metrics,
      provider: this.provider,
    };
  }

  async validateVoiceQuality(
    referenceAudio: Buffer,
    generatedAudio: Buffer
  ): Promise<VoiceQualityMetrics> {
    // Basic implementation - can be overridden by providers with more sophisticated analysis
    try {
      // Simple heuristic based on audio length similarity
      const lengthSimilarity =
        Math.min(referenceAudio.length, generatedAudio.length) /
        Math.max(referenceAudio.length, generatedAudio.length);

      return {
        similarity: lengthSimilarity,
        naturalness: 0.8, // Default score
        clarity: 0.8, // Default score
        overall: lengthSimilarity * 0.8, // Combined score
      };
    } catch (error) {
      this.logger.error('Voice quality validation failed', { error });
      return {
        similarity: 0.5,
        naturalness: 0.5,
        clarity: 0.5,
        overall: 0.5,
      };
    }
  }

  async getQuotaUsage(): Promise<ProviderQuota> {
    return this.quotaUsage;
  }

  async canHandleRequest(text: string): Promise<boolean> {
    const characterCount = text.length;
    return (
      !this.quotaUsage.isExceeded &&
      this.quotaUsage.charactersUsed + characterCount <= this.quotaUsage.charactersLimit &&
      this.quotaUsage.requestsUsed < this.quotaUsage.requestsLimit
    );
  }

  mapVoiceModel(voiceModelId: string): string {
    // Default implementation - can be overridden by providers
    return voiceModelId;
  }

  protected updateMetrics(latency: number, cost: number, isError = false): void {
    this.metrics.requestCount++;
    this.metrics.totalLatency += latency;
    this.metrics.averageLatency = this.metrics.totalLatency / this.metrics.requestCount;
    this.metrics.totalCost += cost;
    this.metrics.lastUsed = new Date();

    // Update success rate
    if (isError) {
      this.metrics.errorCount++;
    }
    this.metrics.successRate =
      (this.metrics.requestCount - this.metrics.errorCount) / this.metrics.requestCount;

    // Update quota usage
    this.quotaUsage.requestsUsed++;
    this.quotaUsage.isExceeded =
      this.quotaUsage.requestsUsed >= this.quotaUsage.requestsLimit ||
      this.quotaUsage.charactersUsed >= this.quotaUsage.charactersLimit;
  }

  protected updateQuotaUsage(characterCount: number): void {
    this.quotaUsage.charactersUsed += characterCount;
    this.quotaUsage.requestsUsed++;
    this.quotaUsage.isExceeded =
      this.quotaUsage.requestsUsed >= this.quotaUsage.requestsLimit ||
      this.quotaUsage.charactersUsed >= this.quotaUsage.charactersLimit;
  }

  protected generateCacheKey(text: string, voiceModelId?: string, options?: any): string {
    const key = `${this.provider}:${text}:${voiceModelId || 'default'}:${JSON.stringify(options || {})}`;
    return Buffer.from(key).toString('base64');
  }
}
