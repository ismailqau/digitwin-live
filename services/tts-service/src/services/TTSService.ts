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
import { TTSOptimizationService, TTSQualityConfig } from './TTSOptimizationService';

export class TTSService {
  private providers: Map<TTSProvider, ITTSProvider> = new Map();
  private logger: winston.Logger;
  private providerSelection: ProviderSelectionService;
  private optimization: TTSOptimizationService;
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
    this.optimization = new TTSOptimizationService(this.logger);
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

  /**
   * Synthesize with optimization
   */
  async synthesizeOptimized(
    request: TTSRequest,
    qualityConfig: TTSQualityConfig,
    criteria?: ProviderSelectionCriteria
  ): Promise<TTSResponse & { optimizations: string[] }> {
    const startTime = Date.now();

    // Optimize the request
    const optimizationResult = await this.optimization.optimizeRequest(request, qualityConfig);

    this.logger.debug('TTS request optimized', {
      originalProvider: request.provider,
      optimizedProvider: optimizationResult.selectedProvider,
      optimizations: optimizationResult.optimizations,
    });

    // Synthesize with optimized request
    const response = await this.synthesize(optimizationResult.optimizedRequest, criteria);

    // Update optimization service with actual performance
    const actualLatency = Date.now() - startTime;
    this.optimization.updateProviderCapabilities(
      optimizationResult.selectedProvider,
      actualLatency,
      0.8, // Default quality score - would be calculated from actual audio analysis
      response.metadata.cost
    );

    return {
      ...response,
      optimizations: optimizationResult.optimizations,
    };
  }

  /**
   * Analyze text for optimization recommendations
   */
  analyzeText(text: string): {
    isShortPhrase: boolean;
    hasSpecialCharacters: boolean;
    estimatedDuration: number;
    complexity: 'low' | 'medium' | 'high';
    suggestions: string[];
    recommendedConfig: TTSQualityConfig;
  } {
    const analysis = this.optimization.analyzeTextForOptimization(text);

    // Determine recommended config based on analysis
    let recommendedConfig: TTSQualityConfig;
    if (analysis.isShortPhrase) {
      recommendedConfig = this.optimization.getRecommendedQualityConfig('conversation');
    } else if (analysis.complexity === 'high') {
      recommendedConfig = this.optimization.getRecommendedQualityConfig('narration');
    } else {
      recommendedConfig = this.optimization.getRecommendedQualityConfig('announcement');
    }

    return {
      ...analysis,
      recommendedConfig,
    };
  }

  /**
   * Get optimization service metrics
   */
  getOptimizationMetrics(): {
    providerCapabilities: Map<TTSProvider, any>;
    recommendedConfigs: Record<string, TTSQualityConfig>;
  } {
    return {
      providerCapabilities: this.optimization.getProviderMetrics(),
      recommendedConfigs: {
        conversation: this.optimization.getRecommendedQualityConfig('conversation'),
        narration: this.optimization.getRecommendedQualityConfig('narration'),
        announcement: this.optimization.getRecommendedQualityConfig('announcement'),
      },
    };
  }

  /**
   * Chunk text for streaming optimization
   */
  chunkTextForStreaming(text: string, maxChunkSize: number = 200): string[] {
    const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
    const chunks: string[] = [];
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

    return chunks;
  }

  /**
   * Stream synthesis with chunking optimization
   */
  async *synthesizeStreamOptimized(
    request: TTSRequest,
    qualityConfig: TTSQualityConfig
  ): AsyncGenerator<TTSStreamChunk & { chunkIndex: number; totalChunks: number }, void, unknown> {
    // Chunk the text for optimal streaming
    const textChunks = this.chunkTextForStreaming(request.text);
    const totalChunks = textChunks.length;

    let sequenceNumber = 0;

    for (let chunkIndex = 0; chunkIndex < textChunks.length; chunkIndex++) {
      const chunkRequest: TTSRequest = {
        ...request,
        text: textChunks[chunkIndex],
      };

      // Optimize each chunk
      const optimizationResult = await this.optimization.optimizeRequest(
        chunkRequest,
        qualityConfig
      );

      try {
        const provider = await this.selectProvider(optimizationResult.selectedProvider);

        // Stream the chunk
        for await (const chunk of provider.synthesizeStream(optimizationResult.optimizedRequest)) {
          yield {
            ...chunk,
            sequenceNumber: sequenceNumber++,
            chunkIndex,
            totalChunks,
          };
        }
      } catch (error) {
        this.logger.error(`Failed to stream chunk ${chunkIndex}`, { error });

        // Fallback to regular synthesis for this chunk
        try {
          const response = await this.synthesizeWithFallback(
            optimizationResult.optimizedRequest,
            optimizationResult.selectedProvider
          );

          // Convert to stream chunks
          for await (const chunk of this.chunkAudioData(response.audioData)) {
            yield {
              ...chunk,
              sequenceNumber: sequenceNumber++,
              chunkIndex,
              totalChunks,
            };
          }
        } catch (fallbackError) {
          this.logger.error(`Fallback also failed for chunk ${chunkIndex}`, { fallbackError });
          // Continue with next chunk
        }
      }
    }
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
