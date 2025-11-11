import { createLogger } from '@clone/logger';
import { TTSProvider } from '@clone/shared-types';
import winston from 'winston';

import { ITTSProvider } from '../interfaces/ITTSProvider';
import { ElevenLabsProvider } from '../providers/ElevenLabsProvider';
import { GoogleCloudTTSProvider } from '../providers/GoogleCloudTTSProvider';
import { OpenAITTSProvider } from '../providers/OpenAITTSProvider';
import { XTTSProvider } from '../providers/XTTSProvider';
import {
  TTSRequest,
  TTSResponse,
  TTSStreamChunk,
  VoiceModelMetadata,
  TTSProviderConfig,
  ProviderSelectionCriteria,
} from '../types';

import { ProviderSelectionService } from './ProviderSelectionService';

export class TTSService {
  private providers: Map<TTSProvider, ITTSProvider> = new Map();
  private logger: winston.Logger;
  private providerSelection: ProviderSelectionService;
  private fallbackOrder: TTSProvider[] = [
    TTSProvider.XTTS_V2,
    TTSProvider.OPENAI_TTS,
    TTSProvider.GOOGLE_CLOUD_TTS,
    TTSProvider.ELEVENLABS,
  ];

  constructor(logger?: winston.Logger) {
    this.logger = logger || createLogger('tts-service');
    this.initializeProviders();
    this.providerSelection = new ProviderSelectionService(this.providers, this.logger);
  }

  private initializeProviders(): void {
    // Initialize all providers
    this.providers.set(TTSProvider.GOOGLE_CLOUD_TTS, new GoogleCloudTTSProvider(this.logger));
    this.providers.set(TTSProvider.OPENAI_TTS, new OpenAITTSProvider(this.logger));
    this.providers.set(TTSProvider.XTTS_V2, new XTTSProvider(this.logger));
    this.providers.set(TTSProvider.ELEVENLABS, new ElevenLabsProvider(this.logger));
  }

  async initializeProvider(config: TTSProviderConfig): Promise<void> {
    const provider = this.providers.get(config.provider);
    if (!provider) {
      throw new Error(`Provider ${config.provider} not found`);
    }

    await provider.initialize(config.options || {});
    this.logger.info(`Provider ${config.provider} initialized successfully`);
  }

  async synthesize(
    request: TTSRequest,
    criteria?: ProviderSelectionCriteria
  ): Promise<TTSResponse> {
    const startTime = Date.now();
    let selectedProvider: ITTSProvider;

    try {
      selectedProvider = await this.providerSelection.selectProvider(request, criteria);
    } catch (error) {
      this.logger.error('Failed to select provider', { error });
      selectedProvider = await this.selectProvider(request.provider);
    }

    try {
      const response = await selectedProvider.synthesize(request);

      // Update provider metrics
      const latency = Date.now() - startTime;
      await this.providerSelection.updateProviderMetrics(
        selectedProvider.provider,
        latency,
        true,
        response.metadata.cost
      );

      return response;
    } catch (error) {
      const latency = Date.now() - startTime;
      await this.providerSelection.updateProviderMetrics(
        selectedProvider.provider,
        latency,
        false,
        0
      );

      this.logger.error(`Synthesis failed with provider ${selectedProvider.provider}`, { error });

      // Try fallback providers
      return await this.synthesizeWithFallback(request, selectedProvider.provider, criteria);
    }
  }

  async *synthesizeStream(request: TTSRequest): AsyncGenerator<TTSStreamChunk, void, unknown> {
    const provider = await this.selectProvider(request.provider);

    try {
      yield* provider.synthesizeStream(request);
    } catch (error) {
      this.logger.error(`Stream synthesis failed with provider ${provider.provider}`, { error });

      // For streaming, we'll fall back to regular synthesis and chunk it
      const response = await this.synthesizeWithFallback(request, provider.provider, undefined);
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

  /**
   * Get provider performance metrics from selection service
   */
  getProviderPerformanceMetrics(): Map<TTSProvider, any> {
    return this.providerSelection.getProviderMetrics();
  }

  /**
   * Compare costs across all providers
   */
  async compareCosts(text: string): Promise<Map<TTSProvider, number>> {
    return await this.providerSelection.compareCosts(text);
  }

  /**
   * Validate voice model compatibility across providers
   */
  async validateVoiceModelCompatibility(
    voiceModel: VoiceModelMetadata
  ): Promise<Map<TTSProvider, boolean>> {
    return await this.providerSelection.validateVoiceModelCompatibility(voiceModel);
  }

  /**
   * Get quota usage for all providers
   */
  async getQuotaUsage(): Promise<Record<TTSProvider, any>> {
    const quotas: Record<TTSProvider, any> = {} as any;

    for (const [providerType, provider] of this.providers) {
      try {
        if (provider.getQuotaUsage) {
          quotas[providerType] = await provider.getQuotaUsage();
        } else {
          quotas[providerType] = { error: 'Quota tracking not supported' };
        }
      } catch (error) {
        this.logger.error(`Failed to get quota usage for ${providerType}`, { error });
        quotas[providerType] = { error: (error as Error).message };
      }
    }

    return quotas;
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
    failedProvider: TTSProvider,
    criteria?: ProviderSelectionCriteria
  ): Promise<TTSResponse> {
    try {
      // Use provider selection service for intelligent fallback
      const fallbackProviders = await this.providerSelection.getFallbackProviders(
        failedProvider,
        request,
        criteria
      );

      for (const provider of fallbackProviders) {
        try {
          this.logger.info(`Falling back to provider ${provider.provider}`);
          const response = await provider.synthesize(request);

          // Update metrics for successful fallback
          await this.providerSelection.updateProviderMetrics(
            provider.provider,
            response.metadata.latency,
            true,
            response.metadata.cost
          );

          return response;
        } catch (error) {
          this.logger.error(`Fallback provider ${provider.provider} also failed`, { error });

          // Update metrics for failed fallback
          await this.providerSelection.updateProviderMetrics(
            provider.provider,
            1000, // Default latency for failed requests
            false,
            0
          );
          continue;
        }
      }
    } catch (error) {
      this.logger.error('Provider selection service fallback failed, using default fallback', {
        error,
      });
    }

    // Fallback to original logic if provider selection fails
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
