/**
 * LLM Provider Factory
 * Creates and manages LLM provider instances
 */

import { ILLMProvider, ILLMProviderFactory } from '../interfaces/LLMProvider';
import { logger } from '../temp-types';
import { LLMProvider } from '../types';

import { GeminiProvider } from './GeminiProvider';
import { GroqProvider } from './GroqProvider';
import { OpenAIProvider } from './OpenAIProvider';

export class ProviderFactory implements ILLMProviderFactory {
  private providers = new Map<string, ILLMProvider>();

  constructor() {
    // Register default providers
    this.registerProvider(LLMProvider.GEMINI_FLASH, new GeminiProvider());
    this.registerProvider(LLMProvider.GEMINI_PRO, new GeminiProvider());
    this.registerProvider(LLMProvider.GPT4, new OpenAIProvider());
    this.registerProvider(LLMProvider.GPT4_TURBO, new OpenAIProvider());
    this.registerProvider(LLMProvider.GROQ_LLAMA, new GroqProvider());

    logger.info('LLM Provider Factory initialized', {
      availableProviders: this.getAvailableProviders(),
    });
  }

  createProvider(providerName: string): ILLMProvider {
    const provider = this.providers.get(providerName);
    if (!provider) {
      throw new Error(`Unknown provider: ${providerName}`);
    }

    // Return a new instance to avoid shared state
    switch (providerName) {
      case LLMProvider.GEMINI_FLASH:
      case LLMProvider.GEMINI_PRO:
        return new GeminiProvider();
      case LLMProvider.GPT4:
      case LLMProvider.GPT4_TURBO:
        return new OpenAIProvider();
      case LLMProvider.GROQ_LLAMA:
        return new GroqProvider();
      default:
        throw new Error(`Cannot create instance for provider: ${providerName}`);
    }
  }

  getAvailableProviders(): string[] {
    return Array.from(this.providers.keys());
  }

  registerProvider(name: string, provider: ILLMProvider): void {
    this.providers.set(name, provider);
    logger.debug('Registered LLM provider', { name, providerName: provider.name });
  }

  /**
   * Check which providers are currently available
   */
  async getHealthyProviders(): Promise<string[]> {
    const healthChecks = await Promise.allSettled(
      Array.from(this.providers.entries()).map(async ([name, provider]) => {
        const isAvailable = await provider.isAvailable();
        return { name, isAvailable };
      })
    );

    return healthChecks
      .filter(
        (result): result is PromiseFulfilledResult<{ name: string; isAvailable: boolean }> =>
          result.status === 'fulfilled' && result.value.isAvailable
      )
      .map((result) => result.value.name);
  }

  /**
   * Get provider metrics for all registered providers
   */
  getAllMetrics(): Record<string, unknown> {
    const metrics: Record<string, unknown> = {};

    for (const [name, provider] of this.providers.entries()) {
      try {
        metrics[name] = provider.getMetrics();
      } catch (error) {
        logger.warn('Failed to get metrics for provider', { name, error });
        metrics[name] = { error: 'Failed to get metrics' };
      }
    }

    return metrics;
  }
}
