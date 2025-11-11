/**
 * LLM Provider Interface
 * Abstract interface for all LLM providers
 */

import { LLMConfig, LLMContext, LLMResponse, StreamingLLMResponse } from '../types';

export interface ILLMProvider {
  /**
   * Provider name
   */
  readonly name: string;

  /**
   * Initialize the provider with configuration
   */
  initialize(config: any): Promise<void>;

  /**
   * Generate a complete response (non-streaming)
   */
  generateResponse(context: LLMContext, config: LLMConfig): Promise<LLMResponse>;

  /**
   * Generate a streaming response
   */
  generateStreamingResponse(
    context: LLMContext,
    config: LLMConfig
  ): AsyncGenerator<StreamingLLMResponse>;

  /**
   * Check if the provider is available
   */
  isAvailable(): Promise<boolean>;

  /**
   * Get provider-specific metrics
   */
  getMetrics(): any;

  /**
   * Estimate cost for a request
   */
  estimateCost(promptTokens: number, completionTokens: number, model: string): number;

  /**
   * Validate configuration
   */
  validateConfig(config: any): boolean;

  /**
   * Get supported models
   */
  getSupportedModels(): string[];
}

export interface ILLMProviderFactory {
  /**
   * Create a provider instance
   */
  createProvider(providerName: string): ILLMProvider;

  /**
   * Get all available providers
   */
  getAvailableProviders(): string[];

  /**
   * Register a new provider
   */
  registerProvider(name: string, provider: ILLMProvider): void;
}
