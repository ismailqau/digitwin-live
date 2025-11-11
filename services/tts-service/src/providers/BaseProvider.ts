import { createLogger } from '@clone/logger';
import { TTSProvider } from '@clone/shared-types';
import winston from 'winston';

import { ITTSProvider } from '../interfaces/ITTSProvider';
import { TTSMetrics, VoiceModelMetadata } from '../types';

export abstract class BaseProvider implements ITTSProvider {
  protected logger: winston.Logger;
  protected metrics: TTSMetrics;
  protected config: Record<string, any> = {};

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

  protected updateMetrics(latency: number, cost: number, isError = false): void {
    this.metrics.requestCount++;
    this.metrics.totalLatency += latency;
    this.metrics.averageLatency = this.metrics.totalLatency / this.metrics.requestCount;
    this.metrics.totalCost += cost;
    this.metrics.lastUsed = new Date();

    if (isError) {
      this.metrics.errorCount++;
    }
  }

  protected generateCacheKey(text: string, voiceModelId?: string, options?: any): string {
    const key = `${this.provider}:${text}:${voiceModelId || 'default'}:${JSON.stringify(options || {})}`;
    return Buffer.from(key).toString('base64');
  }
}
