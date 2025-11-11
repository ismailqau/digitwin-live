import { createLogger } from '@clone/logger';
import { TTSProvider } from '@clone/shared-types';
import winston from 'winston';

import { ITTSProvider } from '../interfaces/ITTSProvider';
import { GoogleCloudTTSProvider } from '../providers/GoogleCloudTTSProvider';
import { OpenAITTSProvider } from '../providers/OpenAITTSProvider';
import { XTTSProvider } from '../providers/XTTSProvider';
import {
  TTSRequest,
  TTSResponse,
  TTSStreamChunk,
  VoiceModelMetadata,
  TTSProviderConfig,
} from '../types';

export class TTSService {
  private providers: Map<TTSProvider, ITTSProvider> = new Map();
  private logger: winston.Logger;
  private fallbackOrder: TTSProvider[] = [
    TTSProvider.XTTS_V2,
    TTSProvider.OPENAI_TTS,
    TTSProvider.GOOGLE_CLOUD_TTS,
  ];

  constructor(logger?: winston.Logger) {
    this.logger = logger || createLogger('tts-service');
    this.initializeProviders();
  }

  private initializeProviders(): void {
    // Initialize all providers
    this.providers.set(TTSProvider.GOOGLE_CLOUD_TTS, new GoogleCloudTTSProvider(this.logger));
    this.providers.set(TTSProvider.OPENAI_TTS, new OpenAITTSProvider(this.logger));
    this.providers.set(TTSProvider.XTTS_V2, new XTTSProvider(this.logger));
  }

  async initializeProvider(config: TTSProviderConfig): Promise<void> {
    const provider = this.providers.get(config.provider);
    if (!provider) {
      throw new Error(`Provider ${config.provider} not found`);
    }

    await provider.initialize(config.options || {});
    this.logger.info(`Provider ${config.provider} initialized successfully`);
  }

  async synthesize(request: TTSRequest): Promise<TTSResponse> {
    const provider = await this.selectProvider(request.provider);

    try {
      return await provider.synthesize(request);
    } catch (error) {
      this.logger.error(`Synthesis failed with provider ${provider.provider}`, { error });

      // Try fallback providers
      return await this.synthesizeWithFallback(request, provider.provider);
    }
  }

  async *synthesizeStream(request: TTSRequest): AsyncGenerator<TTSStreamChunk, void, unknown> {
    const provider = await this.selectProvider(request.provider);

    try {
      yield* provider.synthesizeStream(request);
    } catch (error) {
      this.logger.error(`Stream synthesis failed with provider ${provider.provider}`, { error });

      // For streaming, we'll fall back to regular synthesis and chunk it
      const response = await this.synthesizeWithFallback(request, provider.provider);
      yield* this.chunkAudioData(response.audioData);
    }
  }

  async getAvailableVoices(provider?: TTSProvider): Promise<Record<TTSProvider, string[]>> {
    const voices: Record<TTSProvider, string[]> = {} as any;

    const providersToCheck = provider ? [provider] : Array.from(this.providers.keys());

    for (const providerType of providersToCheck) {
      const providerInstance = this.providers.get(providerType);
      if (providerInstance && providerInstance.isAvailable) {
        try {
          voices[providerType] = await providerInstance.getAvailableVoices();
        } catch (error) {
          this.logger.error(`Failed to get voices for ${providerType}`, { error });
          voices[providerType] = [];
        }
      } else {
        voices[providerType] = [];
      }
    }

    return voices;
  }

  async validateVoiceModel(voiceModel: VoiceModelMetadata): Promise<boolean> {
    const provider = this.providers.get(voiceModel.provider as TTSProvider);
    if (!provider) {
      return false;
    }

    return await provider.validateVoiceModel(voiceModel);
  }

  async estimateCost(text: string, provider?: TTSProvider): Promise<Record<TTSProvider, number>> {
    const costs: Record<TTSProvider, number> = {} as any;

    const providersToCheck = provider ? [provider] : Array.from(this.providers.keys());

    for (const providerType of providersToCheck) {
      const providerInstance = this.providers.get(providerType);
      if (providerInstance && providerInstance.isAvailable) {
        try {
          costs[providerType] = await providerInstance.estimateCost(text);
        } catch (error) {
          this.logger.error(`Failed to estimate cost for ${providerType}`, { error });
          costs[providerType] = 0;
        }
      } else {
        costs[providerType] = 0;
      }
    }

    return costs;
  }

  async getProviderMetrics(): Promise<Record<TTSProvider, any>> {
    const metrics: Record<TTSProvider, any> = {} as any;

    for (const [providerType, provider] of this.providers) {
      try {
        metrics[providerType] = await provider.getMetrics();
      } catch (error) {
        this.logger.error(`Failed to get metrics for ${providerType}`, { error });
        metrics[providerType] = { error: (error as Error).message };
      }
    }

    return metrics;
  }

  async healthCheck(): Promise<Record<TTSProvider, boolean>> {
    const health: Record<TTSProvider, boolean> = {} as Record<TTSProvider, boolean>;

    for (const [providerType, provider] of this.providers) {
      try {
        health[providerType] = await provider.healthCheck();
      } catch (error) {
        this.logger.error(`Health check failed for ${providerType}`, { error });
        health[providerType] = false;
      }
    }

    return health;
  }

  private async selectProvider(preferredProvider?: TTSProvider): Promise<ITTSProvider> {
    // If a specific provider is requested, try it first
    if (preferredProvider) {
      const provider = this.providers.get(preferredProvider);
      if (provider && provider.isAvailable) {
        return provider;
      }
    }

    // Fall back to the first available provider in fallback order
    for (const providerType of this.fallbackOrder) {
      const provider = this.providers.get(providerType);
      if (provider && provider.isAvailable) {
        return provider;
      }
    }

    throw new Error('No TTS providers available');
  }

  private async synthesizeWithFallback(
    request: TTSRequest,
    failedProvider: TTSProvider
  ): Promise<TTSResponse> {
    const remainingProviders = this.fallbackOrder.filter((p) => p !== failedProvider);

    for (const providerType of remainingProviders) {
      const provider = this.providers.get(providerType);
      if (provider && provider.isAvailable) {
        try {
          this.logger.info(`Falling back to provider ${providerType}`);
          return await provider.synthesize(request);
        } catch (error) {
          this.logger.error(`Fallback provider ${providerType} also failed`, { error });
          continue;
        }
      }
    }

    throw new Error('All TTS providers failed');
  }

  private async *chunkAudioData(audioData: Buffer): AsyncGenerator<TTSStreamChunk, void, unknown> {
    const chunkSize = 4096; // 4KB chunks
    let sequenceNumber = 0;

    for (let i = 0; i < audioData.length; i += chunkSize) {
      const chunk = audioData.slice(i, i + chunkSize);
      const isLast = i + chunkSize >= audioData.length;

      yield {
        chunk,
        isLast,
        sequenceNumber: sequenceNumber++,
        timestamp: Date.now(),
      };
    }
  }
}
