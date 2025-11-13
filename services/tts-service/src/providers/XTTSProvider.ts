import { TTSProvider } from '@clone/shared-types';
import winston from 'winston';

import { TTSRequest, TTSResponse, TTSStreamChunk, TTSOptions } from '../types';

import { BaseProvider } from './BaseProvider';

interface XTTSConfig {
  serviceUrl?: string;
  gpuEnabled?: boolean;
}

interface XTTSHealthResponse {
  status: string;
  device?: string;
  platform?: string;
  model_loaded?: boolean;
}

interface XTTSSynthesizeResponse {
  audio_data: string;
  sample_rate?: number;
  duration: number;
  device_used?: string;
}

interface XTTSLanguage {
  code: string;
  name: string;
}

interface XTTSLanguagesResponse {
  languages: XTTSLanguage[];
}

export class XTTSProvider extends BaseProvider {
  private initialized = false;
  private serviceUrl: string;
  private gpuEnabled: boolean;

  constructor(logger?: winston.Logger, config: XTTSConfig = {}) {
    super(TTSProvider.XTTS_V2, logger);
    this.serviceUrl = config.serviceUrl || process.env.XTTS_SERVICE_URL || 'http://localhost:8000';
    this.gpuEnabled =
      config.gpuEnabled !== undefined
        ? config.gpuEnabled
        : (process.env.XTTS_GPU_ENABLED || 'true').toLowerCase() === 'true';
  }

  get isAvailable(): boolean {
    return this.initialized;
  }

  async initialize(config: Record<string, unknown> = {}): Promise<void> {
    try {
      // Test connection to XTTS service
      const healthResponse = await fetch(`${this.serviceUrl}/health`);

      if (!healthResponse.ok) {
        throw new Error(`XTTS service health check failed: ${healthResponse.status}`);
      }

      const healthData = (await healthResponse.json()) as XTTSHealthResponse;
      this.initialized = healthData.status === 'healthy' || healthData.status === 'initializing';

      this.logger.info('XTTS-v2 provider initialized', {
        available: this.initialized,
        serviceUrl: this.serviceUrl,
        device: healthData.device,
        platform: healthData.platform,
        modelLoaded: healthData.model_loaded,
        config,
      });
    } catch (error) {
      this.logger.error('Failed to initialize XTTS-v2 provider', { error });
      this.initialized = false;
      // Don't throw error - allow service to start without XTTS
    }
  }

  async synthesize(request: TTSRequest): Promise<TTSResponse> {
    if (!this.initialized) {
      throw new Error('XTTS-v2 provider not initialized');
    }

    const startTime = Date.now();

    try {
      this.logger.debug('Starting XTTS-v2 synthesis', {
        textLength: request.text.length,
        voiceModelId: request.voiceModelId,
      });

      // Prepare request for XTTS service
      const xttsRequest = {
        text: request.text,
        language: request.options?.languageCode || 'en',
        speed: request.options?.speed || 1.0,
        speaker_wav: request.voiceModelId
          ? await this.getVoiceModelAudio(request.voiceModelId)
          : undefined,
      };

      // Call XTTS service
      const response = await fetch(`${this.serviceUrl}/synthesize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(xttsRequest),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`XTTS service error: ${response.status} - ${JSON.stringify(errorData)}`);
      }

      const data = (await response.json()) as XTTSSynthesizeResponse;
      const duration = Date.now() - startTime;
      const cost = this.calculateCost(request.text.length);

      this.logger.debug('XTTS-v2 synthesis completed', {
        duration,
        cost,
        audioSize: data.audio_data?.length || 0,
        deviceUsed: data.device_used,
      });

      // Update metrics
      this.updateMetrics(duration, cost, false);
      this.updateQuotaUsage(request.text.length);

      return {
        audioData: Buffer.from(data.audio_data, 'base64'),
        format: 'wav',
        sampleRate: data.sample_rate || 24000,
        duration: data.duration * 1000, // Convert to milliseconds
        metadata: {
          provider: TTSProvider.XTTS_V2,
          voiceModelId: request.voiceModelId,
          cost,
          latency: duration,
        },
      };
    } catch (error) {
      const _latency = Date.now() - startTime;
      this.updateMetrics(_latency, 0, true);
      this.logger.error('XTTS-v2 synthesis failed', { error, request });
      throw new Error(`XTTS-v2 synthesis failed: ${(error as Error).message}`);
    }
  }

  async *synthesizeStream(request: TTSRequest): AsyncGenerator<TTSStreamChunk, void, unknown> {
    try {
      this.logger.debug('Starting XTTS-v2 streaming synthesis');

      // For streaming, we'll chunk the text and synthesize each chunk
      const textChunks = this.chunkText(request.text, 100);
      let sequenceNumber = 0;

      for (let i = 0; i < textChunks.length; i++) {
        const chunkRequest = { ...request, text: textChunks[i] };
        const chunkResponse = await this.synthesize(chunkRequest);

        yield {
          chunk: chunkResponse.audioData,
          isLast: i === textChunks.length - 1,
          sequenceNumber: sequenceNumber++,
          timestamp: Date.now(),
        };

        // Small delay between chunks for realistic streaming
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    } catch (error) {
      this.logger.error('XTTS-v2 streaming failed', { error });
      throw error;
    }
  }

  async getAvailableVoices(): Promise<string[]> {
    try {
      // Get supported languages from XTTS service
      const response = await fetch(`${this.serviceUrl}/languages`);

      if (!response.ok) {
        this.logger.warn('Failed to get XTTS languages, using defaults');
        return this.getDefaultVoiceIds();
      }

      const data = (await response.json()) as XTTSLanguagesResponse;

      return data.languages.map((lang: XTTSLanguage) => `xtts-${lang.code}`);
    } catch (error) {
      this.logger.error('Failed to get available voices', { error });
      return this.getDefaultVoiceIds();
    }
  }

  async estimateCost(text: string, _options?: TTSOptions): Promise<number> {
    // XTTS-v2 cost is primarily compute time
    // Lower cost for self-hosted solution
    const charactersPerSecond = this.gpuEnabled ? 200 : 50; // GPU is faster
    const computeCostPerSecond = this.gpuEnabled ? 0.001 : 0.0001; // GPU costs more
    const estimatedSeconds = text.length / charactersPerSecond;
    return estimatedSeconds * computeCostPerSecond;
  }

  async healthCheck(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${this.serviceUrl}/health`, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return false;
      }

      const data = (await response.json()) as XTTSHealthResponse;
      return data.status === 'healthy';
    } catch (error) {
      this.logger.error('XTTS health check failed', { error });
      return false;
    }
  }

  // Private methods

  private async getVoiceModelAudio(voiceModelId: string): Promise<string | undefined> {
    // TODO: Implement voice model retrieval from database
    // For now, return undefined to use default voice
    this.logger.debug('Voice model requested but not implemented yet', { voiceModelId });
    return undefined;
  }

  private calculateCost(characterCount: number): number {
    // XTTS-v2 cost estimation
    const computeTimeSeconds = characterCount / (this.gpuEnabled ? 200 : 50);
    const costPerSecond = this.gpuEnabled ? 0.001 : 0.0001;
    return computeTimeSeconds * costPerSecond;
  }

  private chunkText(text: string, maxChunkSize: number): string[] {
    const chunks: string[] = [];
    const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);

    let currentChunk = '';

    for (const sentence of sentences) {
      const trimmedSentence = sentence.trim();
      if (currentChunk.length + trimmedSentence.length + 1 <= maxChunkSize) {
        currentChunk += (currentChunk ? '. ' : '') + trimmedSentence;
      } else {
        if (currentChunk) {
          chunks.push(currentChunk + '.');
        }
        currentChunk = trimmedSentence;
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk + '.');
    }

    return chunks.length > 0 ? chunks : [text];
  }

  private getDefaultVoiceIds(): string[] {
    return [
      'xtts-en',
      'xtts-es',
      'xtts-fr',
      'xtts-de',
      'xtts-it',
      'xtts-pt',
      'xtts-pl',
      'xtts-tr',
      'xtts-ru',
      'xtts-nl',
      'xtts-cs',
      'xtts-ar',
      'xtts-zh-cn',
      'xtts-ja',
      'xtts-hu',
      'xtts-ko',
    ];
  }
}
