/**
 * LLM Service
 * Main service orchestrating multi-provider LLM integration with fallback logic
 */

import { LLMCacheService } from '../cache/LLMCacheService';
import { ILLMProvider } from '../interfaces/LLMProvider';
import { ProviderFactory } from '../providers/ProviderFactory';
import { logger } from '../temp-types';
import { PrismaClient } from '../temp-types';
import {
  LLMConfig,
  LLMContext,
  LLMResponse,
  StreamingLLMResponse,
  LLMProvider,
  GeminiConfig,
  OpenAIConfig,
  GroqConfig,
  LLMError,
} from '../types';
import { CircuitBreaker } from '../utils/CircuitBreaker';

export interface LLMServiceConfig {
  primaryProvider: LLMProvider;
  fallbackProviders: LLMProvider[];
  enableCaching: boolean;
  enableCircuitBreaker: boolean;
  providerConfigs: {
    [LLMProvider.GEMINI_FLASH]?: GeminiConfig;
    [LLMProvider.GEMINI_PRO]?: GeminiConfig;
    [LLMProvider.GPT4]?: OpenAIConfig;
    [LLMProvider.GPT4_TURBO]?: OpenAIConfig;
    [LLMProvider.GROQ_LLAMA]?: GroqConfig;
  };
}

export class LLMService {
  private providerFactory: ProviderFactory;
  private cacheService: LLMCacheService;
  private circuitBreakers = new Map<string, CircuitBreaker>();
  private providers = new Map<LLMProvider, ILLMProvider>();
  private config: LLMServiceConfig;
  private metrics = {
    totalRequests: 0,
    cacheHits: 0,
    cacheMisses: 0,
    providerFailovers: 0,
    totalLatencyMs: 0,
    averageLatencyMs: 0,
  };

  constructor(config: LLMServiceConfig, db: PrismaClient) {
    this.config = config;
    this.providerFactory = new ProviderFactory();
    this.cacheService = new LLMCacheService(db);

    logger.info('LLM Service initialized', {
      primaryProvider: config.primaryProvider,
      fallbackProviders: config.fallbackProviders,
      enableCaching: config.enableCaching,
      enableCircuitBreaker: config.enableCircuitBreaker,
    });
  }

  /**
   * Initialize all configured providers
   */
  async initialize(): Promise<void> {
    const initPromises: Promise<void>[] = [];

    // Initialize primary provider
    if (this.config.providerConfigs[this.config.primaryProvider]) {
      initPromises.push(this.initializeProvider(this.config.primaryProvider));
    }

    // Initialize fallback providers
    for (const provider of this.config.fallbackProviders) {
      if (this.config.providerConfigs[provider]) {
        initPromises.push(this.initializeProvider(provider));
      }
    }

    await Promise.allSettled(initPromises);

    logger.info('LLM Service providers initialized', {
      initializedProviders: Array.from(this.providers.keys()),
    });
  }

  /**
   * Generate response with provider fallback logic
   */
  async generateResponse(context: LLMContext, config: LLMConfig): Promise<LLMResponse> {
    const startTime = Date.now();
    this.metrics.totalRequests++;

    // Check cache first if enabled
    if (this.config.enableCaching) {
      const cached = await this.checkCache(context, config);
      if (cached) {
        this.metrics.cacheHits++;
        logger.debug('Cache hit for LLM response', { sessionId: context.sessionId });
        return cached;
      }
      this.metrics.cacheMisses++;
    }

    // Try providers in order (primary first, then fallbacks)
    const providersToTry = [this.config.primaryProvider, ...this.config.fallbackProviders];
    let lastError: Error | null = null;

    for (const providerType of providersToTry) {
      const provider = this.providers.get(providerType);
      if (!provider) {
        logger.warn('Provider not initialized', { provider: providerType });
        continue;
      }

      try {
        const response = await this.executeWithCircuitBreaker(providerType, () =>
          provider.generateResponse(context, { ...config, provider: providerType })
        );

        // Cache successful response
        if (this.config.enableCaching) {
          await this.cacheResponse(context, config, response);
        }

        // Update metrics
        const latencyMs = Date.now() - startTime;
        this.metrics.totalLatencyMs += latencyMs;
        this.metrics.averageLatencyMs = this.metrics.totalLatencyMs / this.metrics.totalRequests;

        // Track failover if not using primary provider
        if (providerType !== this.config.primaryProvider) {
          this.metrics.providerFailovers++;
          logger.info('Provider failover successful', {
            from: this.config.primaryProvider,
            to: providerType,
            sessionId: context.sessionId,
          });
        }

        return response;
      } catch (error) {
        lastError = error as Error;
        logger.warn('Provider failed, trying next', {
          provider: providerType,
          error: error instanceof Error ? error.message : 'Unknown error',
          sessionId: context.sessionId,
        });

        // Don't try other providers for content filtering
        if (error instanceof LLMError && !error.retryable) {
          break;
        }
      }
    }

    // All providers failed
    logger.error('All LLM providers failed', {
      providers: providersToTry,
      lastError: lastError?.message,
      sessionId: context.sessionId,
    });

    throw lastError || new Error('All LLM providers unavailable');
  }

  /**
   * Generate streaming response with provider fallback logic
   */
  async *generateStreamingResponse(
    context: LLMContext,
    config: LLMConfig
  ): AsyncGenerator<StreamingLLMResponse> {
    const startTime = Date.now();
    this.metrics.totalRequests++;

    // Note: Streaming responses are not cached due to their nature
    this.metrics.cacheMisses++;

    // Try providers in order (primary first, then fallbacks)
    const providersToTry = [this.config.primaryProvider, ...this.config.fallbackProviders];
    let lastError: Error | null = null;

    for (const providerType of providersToTry) {
      const provider = this.providers.get(providerType);
      if (!provider) {
        logger.warn('Provider not initialized', { provider: providerType });
        continue;
      }

      try {
        const generator = this.executeStreamingWithCircuitBreaker(providerType, () =>
          provider.generateStreamingResponse(context, { ...config, provider: providerType })
        );

        let hasYielded = false;
        for await (const chunk of generator) {
          hasYielded = true;
          yield chunk;
        }

        // Update metrics if we successfully yielded at least one chunk
        if (hasYielded) {
          const latencyMs = Date.now() - startTime;
          this.metrics.totalLatencyMs += latencyMs;
          this.metrics.averageLatencyMs = this.metrics.totalLatencyMs / this.metrics.totalRequests;

          // Track failover if not using primary provider
          if (providerType !== this.config.primaryProvider) {
            this.metrics.providerFailovers++;
            logger.info('Streaming provider failover successful', {
              from: this.config.primaryProvider,
              to: providerType,
              sessionId: context.sessionId,
            });
          }
        }

        return; // Success, exit the function
      } catch (error) {
        lastError = error as Error;
        logger.warn('Streaming provider failed, trying next', {
          provider: providerType,
          error: error instanceof Error ? error.message : 'Unknown error',
          sessionId: context.sessionId,
        });

        // Don't try other providers for content filtering
        if (error instanceof LLMError && !error.retryable) {
          break;
        }
      }
    }

    // All providers failed
    logger.error('All streaming LLM providers failed', {
      providers: providersToTry,
      lastError: lastError?.message,
      sessionId: context.sessionId,
    });

    throw lastError || new Error('All streaming LLM providers unavailable');
  }

  /**
   * Get service metrics including provider metrics
   */
  getMetrics(): Record<string, unknown> {
    const providerMetrics = this.providerFactory.getAllMetrics();
    const circuitBreakerMetrics: Record<string, unknown> = {};

    for (const [name, breaker] of this.circuitBreakers.entries()) {
      circuitBreakerMetrics[name] = breaker.getMetrics();
    }

    return {
      service: this.metrics,
      providers: providerMetrics,
      circuitBreakers: circuitBreakerMetrics,
      cache: {
        enabled: this.config.enableCaching,
        hitRate:
          this.metrics.totalRequests > 0 ? this.metrics.cacheHits / this.metrics.totalRequests : 0,
      },
    };
  }

  /**
   * Get health status of all providers
   */
  async getHealthStatus(): Promise<Record<string, boolean>> {
    const healthPromises = Array.from(this.providers.entries()).map(
      async ([providerType, provider]) => {
        try {
          const isHealthy = await provider.isAvailable();
          return [providerType, isHealthy] as const;
        } catch {
          return [providerType, false] as const;
        }
      }
    );

    const results = await Promise.allSettled(healthPromises);
    const healthStatus: Record<string, boolean> = {};

    results.forEach((result) => {
      if (result.status === 'fulfilled') {
        const [providerType, isHealthy] = result.value;
        healthStatus[providerType] = isHealthy;
      }
    });

    return healthStatus;
  }

  /**
   * Clear cache (for maintenance or testing)
   */
  async clearCache(): Promise<void> {
    if (this.config.enableCaching) {
      await this.cacheService.clear();
      logger.info('LLM cache cleared');
    }
  }

  private async initializeProvider(providerType: LLMProvider): Promise<void> {
    try {
      const provider = this.providerFactory.createProvider(providerType);
      const config = this.config.providerConfigs[providerType];

      if (!config) {
        throw new Error(`No configuration found for provider: ${providerType}`);
      }

      await provider.initialize(config as unknown);
      this.providers.set(providerType, provider);

      // Initialize circuit breaker if enabled
      if (this.config.enableCircuitBreaker) {
        this.circuitBreakers.set(providerType, new CircuitBreaker(providerType));
      }

      logger.info('Provider initialized successfully', { provider: providerType });
    } catch (error) {
      logger.error('Failed to initialize provider', { provider: providerType, error });
      throw error;
    }
  }

  private async executeWithCircuitBreaker<T>(
    providerType: LLMProvider,
    fn: () => Promise<T>
  ): Promise<T> {
    if (!this.config.enableCircuitBreaker) {
      return fn();
    }

    const breaker = this.circuitBreakers.get(providerType);
    if (!breaker) {
      return fn();
    }

    return breaker.execute(fn);
  }

  private async *executeStreamingWithCircuitBreaker(
    providerType: LLMProvider,
    fn: () => AsyncGenerator<StreamingLLMResponse>
  ): AsyncGenerator<StreamingLLMResponse> {
    if (!this.config.enableCircuitBreaker) {
      yield* fn();
      return;
    }

    const breaker = this.circuitBreakers.get(providerType);
    if (!breaker) {
      yield* fn();
      return;
    }

    // For streaming, we execute the generator directly within circuit breaker context
    const generator = fn();
    for await (const chunk of generator) {
      yield chunk;
    }
    breaker.getMetrics(); // Record success implicitly
  }

  private async checkCache(context: LLMContext, config: LLMConfig): Promise<LLMResponse | null> {
    try {
      const prompt = this.buildCacheKey(context);
      const cached = await this.cacheService.get(
        prompt,
        JSON.stringify(context.relevantKnowledge),
        config.model,
        config.temperature
      );

      if (cached) {
        return {
          content: cached.response,
          finishReason: 'stop',
          usage: cached.usage,
          provider: config.provider,
          model: config.model,
          latencyMs: 0, // Cached response
          cost: 0, // No cost for cached response
        };
      }

      return null;
    } catch (error) {
      logger.warn('Cache check failed', { error });
      return null;
    }
  }

  private async cacheResponse(
    context: LLMContext,
    config: LLMConfig,
    response: LLMResponse
  ): Promise<void> {
    try {
      const prompt = this.buildCacheKey(context);
      await this.cacheService.set(
        prompt,
        JSON.stringify(context.relevantKnowledge),
        config.model,
        config.temperature,
        response
      );
    } catch (error) {
      logger.warn('Failed to cache response', { error });
    }
  }

  private buildCacheKey(context: LLMContext): string {
    return `${context.systemPrompt}|${context.userPersonality}|${context.conversationHistory}|${context.currentQuery}`;
  }
}
