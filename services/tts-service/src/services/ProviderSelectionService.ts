import { createLogger } from '@clone/logger';
import { TTSProvider } from '@clone/shared-types';
import winston from 'winston';

import { ITTSProvider } from '../interfaces/ITTSProvider';
import {
  ProviderSelectionCriteria,
  ProviderPerformanceMetrics,
  TTSRequest,
  VoiceModelMetadata,
} from '../types';

export class ProviderSelectionService {
  private logger: winston.Logger;
  private providers: Map<TTSProvider, ITTSProvider>;
  private performanceHistory: Map<TTSProvider, ProviderPerformanceMetrics> = new Map();

  constructor(providers: Map<TTSProvider, ITTSProvider>, logger?: winston.Logger) {
    this.logger = logger || createLogger('provider-selection');
    this.providers = providers;
    this.initializePerformanceMetrics();
  }

  /**
   * Select the best provider based on criteria
   */
  async selectProvider(
    request: TTSRequest,
    criteria?: ProviderSelectionCriteria
  ): Promise<ITTSProvider> {
    const availableProviders = await this.getAvailableProviders();

    if (availableProviders.length === 0) {
      throw new Error('No TTS providers available');
    }

    // If a specific provider is requested and available, use it
    if (criteria?.preferredProvider) {
      const preferredProvider = this.providers.get(criteria.preferredProvider);
      if (preferredProvider && preferredProvider.isAvailable) {
        const canHandle = await this.canProviderHandleRequest(preferredProvider, request);
        if (canHandle) {
          return preferredProvider;
        }
      }
    }

    // Score and rank providers
    const scoredProviders = await this.scoreProviders(availableProviders, request, criteria);

    if (scoredProviders.length === 0) {
      throw new Error('No suitable TTS providers found for the request');
    }

    // Return the highest scoring provider
    return scoredProviders[0].provider;
  }

  /**
   * Get fallback providers in order of preference
   */
  async getFallbackProviders(
    failedProvider: TTSProvider,
    request: TTSRequest,
    criteria?: ProviderSelectionCriteria
  ): Promise<ITTSProvider[]> {
    const availableProviders = await this.getAvailableProviders();
    const fallbackProviders = availableProviders.filter((p) => p.provider !== failedProvider);

    const scoredProviders = await this.scoreProviders(fallbackProviders, request, criteria);
    return scoredProviders.map((sp) => sp.provider);
  }

  /**
   * Update provider performance metrics
   */
  async updateProviderMetrics(
    provider: TTSProvider,
    latency: number,
    success: boolean,
    cost: number
  ): Promise<void> {
    const metrics = this.performanceHistory.get(provider);
    if (!metrics) return;

    // Update metrics
    const totalRequests = metrics.successRate * 100; // Approximate request count
    const successfulRequests = success ? totalRequests + 1 : totalRequests;
    const newTotalRequests = totalRequests + 1;

    metrics.averageLatency = (metrics.averageLatency * totalRequests + latency) / newTotalRequests;
    metrics.successRate = successfulRequests / newTotalRequests;
    metrics.averageCost = (metrics.averageCost * totalRequests + cost) / newTotalRequests;
    metrics.lastHealthCheck = new Date();

    this.performanceHistory.set(provider, metrics);
  }

  /**
   * Get provider performance metrics
   */
  getProviderMetrics(): Map<TTSProvider, ProviderPerformanceMetrics> {
    return new Map(this.performanceHistory);
  }

  /**
   * Compare costs across providers
   */
  async compareCosts(text: string): Promise<Map<TTSProvider, number>> {
    const costs = new Map<TTSProvider, number>();

    for (const [providerType, provider] of this.providers) {
      if (provider.isAvailable) {
        try {
          const cost = await provider.estimateCost(text);
          costs.set(providerType, cost);
        } catch (error) {
          this.logger.warn(`Failed to estimate cost for ${providerType}`, { error });
          costs.set(providerType, Infinity);
        }
      }
    }

    return costs;
  }

  /**
   * Validate voice model compatibility across providers
   */
  async validateVoiceModelCompatibility(
    voiceModel: VoiceModelMetadata
  ): Promise<Map<TTSProvider, boolean>> {
    const compatibility = new Map<TTSProvider, boolean>();

    for (const [providerType, provider] of this.providers) {
      if (provider.isAvailable) {
        try {
          const isCompatible = await provider.validateVoiceModel(voiceModel);
          compatibility.set(providerType, isCompatible);
        } catch (error) {
          this.logger.warn(`Failed to validate voice model for ${providerType}`, { error });
          compatibility.set(providerType, false);
        }
      }
    }

    return compatibility;
  }

  private async getAvailableProviders(): Promise<ITTSProvider[]> {
    const available: ITTSProvider[] = [];

    for (const provider of this.providers.values()) {
      if (provider.isAvailable) {
        try {
          const healthCheck = await provider.healthCheck();
          if (healthCheck) {
            available.push(provider);
          }
        } catch (error) {
          this.logger.warn(`Health check failed for ${provider.provider}`, { error });
        }
      }
    }

    return available;
  }

  private async scoreProviders(
    providers: ITTSProvider[],
    request: TTSRequest,
    criteria?: ProviderSelectionCriteria
  ): Promise<Array<{ provider: ITTSProvider; score: number }>> {
    const scoredProviders: Array<{ provider: ITTSProvider; score: number }> = [];

    for (const provider of providers) {
      try {
        const canHandle = await this.canProviderHandleRequest(provider, request);
        if (!canHandle) continue;

        const score = await this.calculateProviderScore(provider, request, criteria);
        scoredProviders.push({ provider, score });
      } catch (error) {
        this.logger.warn(`Failed to score provider ${provider.provider}`, { error });
      }
    }

    // Sort by score (highest first)
    return scoredProviders.sort((a, b) => b.score - a.score);
  }

  private async calculateProviderScore(
    provider: ITTSProvider,
    _request: TTSRequest,
    criteria?: ProviderSelectionCriteria
  ): Promise<number> {
    let score = 0;
    const metrics = this.performanceHistory.get(provider.provider);

    if (!metrics) return 0;

    // Base score from success rate (0-40 points)
    score += metrics.successRate * 40;

    // Latency score (0-20 points, lower latency = higher score)
    const maxLatency = criteria?.maxLatency || 5000; // 5 seconds default
    if (metrics.averageLatency <= maxLatency) {
      score += (1 - metrics.averageLatency / maxLatency) * 20;
    }

    // Cost score (0-20 points, lower cost = higher score)
    const maxCost = criteria?.maxCost || 0.01; // $0.01 default
    if (metrics.averageCost <= maxCost) {
      score += (1 - metrics.averageCost / maxCost) * 20;
    }

    // Quality score (0-20 points)
    const minQuality = criteria?.minQualityScore || 0.7;
    if (metrics.qualityScore >= minQuality) {
      score += metrics.qualityScore * 20;
    }

    // Quota availability bonus (0-10 points)
    if (metrics.quotaUsage.used / metrics.quotaUsage.limit < 0.8) {
      score += 10;
    }

    // Streaming capability bonus
    if (criteria?.requireStreaming && this.supportsStreaming(provider)) {
      score += 5;
    }

    return Math.max(0, Math.min(100, score)); // Clamp between 0-100
  }

  private async canProviderHandleRequest(
    provider: ITTSProvider,
    request: TTSRequest
  ): Promise<boolean> {
    try {
      // Check quota limits
      if (provider.canHandleRequest) {
        const canHandle = await provider.canHandleRequest(request.text);
        if (!canHandle) return false;
      }

      // Check voice model compatibility if specified
      if (request.voiceModelId) {
        // This would need actual voice model metadata - simplified for now
        // In a real implementation, you would fetch the voice model metadata
        // and call provider.validateVoiceModel(voiceModelMetadata)
        return true;
      }

      return true;
    } catch (error) {
      this.logger.warn(`Failed to check if provider can handle request`, {
        error,
        provider: provider.provider,
      });
      return false;
    }
  }

  private supportsStreaming(provider: ITTSProvider): boolean {
    // Check if provider supports true streaming (not just chunking)
    return provider.provider === TTSProvider.ELEVENLABS; // ElevenLabs supports true streaming
  }

  private initializePerformanceMetrics(): void {
    for (const [providerType] of this.providers) {
      this.performanceHistory.set(providerType, {
        provider: providerType,
        isAvailable: true,
        averageLatency: 1000, // Default 1 second
        successRate: 0.95, // Default 95%
        averageCost: 0.001, // Default cost
        qualityScore: 0.85, // Default quality
        quotaUsage: {
          used: 0,
          limit: 1000000,
          resetDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
        lastHealthCheck: new Date(),
      });
    }
  }
}
