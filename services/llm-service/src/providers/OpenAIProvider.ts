/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * OpenAI Provider Implementation
 * Integrates with OpenAI GPT models
 */

import OpenAI from 'openai';

import { ILLMProvider } from '../interfaces/LLMProvider';
import { logger } from '../temp-types';
import {
  LLMConfig,
  LLMContext,
  LLMResponse,
  StreamingLLMResponse,
  OpenAIConfig,
  LLMProvider,
  ProviderUnavailableError,
  RateLimitError,
  ContentFilterError,
  LLMMetrics,
  ChatMessage,
} from '../types';

export class OpenAIProvider implements ILLMProvider {
  readonly name = 'openai';
  private client: OpenAI | null = null;
  private config: OpenAIConfig | null = null;
  private metrics: LLMMetrics = {
    requestCount: 0,
    totalLatencyMs: 0,
    averageLatencyMs: 0,
    errorCount: 0,
    totalCost: 0,
    tokensGenerated: 0,
  };

  async initialize(config: any): Promise<void> {
    const openaiConfig = config as OpenAIConfig;
    try {
      this.config = openaiConfig;
      this.client = new OpenAI({
        apiKey: openaiConfig.apiKey,
        organization: openaiConfig.organization,
        baseURL: openaiConfig.baseUrl,
        timeout: openaiConfig.timeout,
        maxRetries: openaiConfig.maxRetries,
      });

      logger.info('OpenAI provider initialized', {
        model: openaiConfig.model,
        organization: openaiConfig.organization,
      });
    } catch (error) {
      logger.error('Failed to initialize OpenAI provider', { error });
      throw new ProviderUnavailableError(LLMProvider.GPT4, error as Error);
    }
  }

  async generateResponse(context: LLMContext, config: LLMConfig): Promise<LLMResponse> {
    if (!this.client || !this.config) {
      throw new ProviderUnavailableError(LLMProvider.GPT4);
    }

    const startTime = Date.now();
    this.metrics.requestCount++;

    try {
      const messages = this.buildMessages(context);

      const completion = await this.client.chat.completions.create({
        model: config.model,
        messages,
        temperature: config.temperature,
        max_tokens: config.maxTokens,
        stop: config.stopSequences,
        stream: false,
      });

      const choice = completion.choices[0];
      if (!choice) {
        throw new Error('No response choices generated');
      }

      // Handle content filtering
      if (choice.finish_reason === 'content_filter') {
        throw new ContentFilterError(config.provider, 'Content filtered by OpenAI');
      }

      const latencyMs = Date.now() - startTime;
      const usage = {
        promptTokens: completion.usage?.prompt_tokens || 0,
        completionTokens: completion.usage?.completion_tokens || 0,
        totalTokens: completion.usage?.total_tokens || 0,
      };

      const cost = this.estimateCost(usage.promptTokens, usage.completionTokens, config.model);

      // Update metrics
      this.metrics.totalLatencyMs += latencyMs;
      this.metrics.averageLatencyMs = this.metrics.totalLatencyMs / this.metrics.requestCount;
      this.metrics.totalCost += cost;
      this.metrics.tokensGenerated += usage.completionTokens;

      return {
        content: choice.message.content || '',
        finishReason: this.mapFinishReason(choice.finish_reason),
        usage,
        provider: config.provider,
        model: config.model,
        latencyMs,
        cost,
      };
    } catch (error) {
      this.metrics.errorCount++;
      const latencyMs = Date.now() - startTime;
      this.metrics.totalLatencyMs += latencyMs;

      logger.error('OpenAI generation failed', { error, context: context.sessionId });

      if (error instanceof ContentFilterError) {
        throw error;
      }

      // Handle rate limiting
      if (error instanceof OpenAI.RateLimitError) {
        throw new RateLimitError(config.provider);
      }

      // Handle API errors
      if (error instanceof OpenAI.APIError) {
        throw new ProviderUnavailableError(config.provider, error);
      }

      throw new ProviderUnavailableError(config.provider, error as Error);
    }
  }

  async *generateStreamingResponse(
    context: LLMContext,
    config: LLMConfig
  ): AsyncGenerator<StreamingLLMResponse> {
    if (!this.client || !this.config) {
      throw new ProviderUnavailableError(LLMProvider.GPT4);
    }

    const startTime = Date.now();
    this.metrics.requestCount++;

    try {
      const messages = this.buildMessages(context);

      const stream = await this.client.chat.completions.create({
        model: config.model,
        messages,
        temperature: config.temperature,
        max_tokens: config.maxTokens,
        stop: config.stopSequences,
        stream: true,
      });

      let completionTokens = 0;
      let finishReason: LLMResponse['finishReason'] = 'stop';

      for await (const chunk of stream) {
        const choice = chunk.choices[0];
        if (!choice) continue;

        const content = choice.delta.content || '';
        if (content) {
          completionTokens += content.split(' ').length; // Rough estimation
          yield {
            token: content,
            isComplete: false,
          };
        }

        if (choice.finish_reason) {
          finishReason = this.mapFinishReason(choice.finish_reason);

          // Handle content filtering
          if (choice.finish_reason === 'content_filter') {
            throw new ContentFilterError(config.provider, 'Content filtered by OpenAI');
          }
        }
      }

      const latencyMs = Date.now() - startTime;
      const usage = {
        promptTokens: 0, // Not available in streaming
        completionTokens,
        totalTokens: completionTokens,
      };

      const cost = this.estimateCost(usage.promptTokens, usage.completionTokens, config.model);

      // Update metrics
      this.metrics.totalLatencyMs += latencyMs;
      this.metrics.averageLatencyMs = this.metrics.totalLatencyMs / this.metrics.requestCount;
      this.metrics.totalCost += cost;
      this.metrics.tokensGenerated += usage.completionTokens;

      // Final chunk with metadata
      yield {
        token: '',
        isComplete: true,
        usage,
        finishReason,
      };
    } catch (error) {
      this.metrics.errorCount++;
      logger.error('OpenAI streaming failed', { error, context: context.sessionId });

      if (error instanceof ContentFilterError) {
        throw error;
      }

      if (error instanceof OpenAI.RateLimitError) {
        throw new RateLimitError(config.provider);
      }

      if (error instanceof OpenAI.APIError) {
        throw new ProviderUnavailableError(config.provider, error);
      }

      throw new ProviderUnavailableError(config.provider, error as Error);
    }
  }

  async isAvailable(): Promise<boolean> {
    if (!this.client || !this.config) {
      return false;
    }

    try {
      // Simple health check - list models
      await this.client.models.list();
      return true;
    } catch {
      return false;
    }
  }

  getMetrics(): LLMMetrics {
    return { ...this.metrics };
  }

  estimateCost(promptTokens: number, completionTokens: number, model: string): number {
    // OpenAI pricing (approximate, as of 2024)
    const pricing = {
      'gpt-4-turbo': { input: 0.01, output: 0.03 }, // per 1K tokens
      'gpt-4': { input: 0.03, output: 0.06 },
      'gpt-3.5-turbo': { input: 0.0015, output: 0.002 },
    };

    const modelPricing = pricing[model as keyof typeof pricing] || pricing['gpt-4-turbo'];

    return (
      (promptTokens / 1000) * modelPricing.input + (completionTokens / 1000) * modelPricing.output
    );
  }

  validateConfig(config: unknown): boolean {
    const openaiConfig = config as OpenAIConfig;
    return !!(openaiConfig.apiKey && openaiConfig.model);
  }

  getSupportedModels(): string[] {
    return ['gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo'];
  }

  private buildMessages(context: LLMContext): ChatMessage[] {
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `${context.systemPrompt}

Personality: ${context.userPersonality}

Relevant Knowledge:
${context.relevantKnowledge.join('\n')}`,
      },
    ];

    // Add conversation history if available
    if (context.conversationHistory) {
      messages.push({
        role: 'assistant',
        content: `Previous conversation: ${context.conversationHistory}`,
      });
    }

    // Add current query
    messages.push({
      role: 'user',
      content: context.currentQuery,
    });

    return messages;
  }

  private mapFinishReason(reason: string | null): LLMResponse['finishReason'] {
    switch (reason) {
      case 'stop':
        return 'stop';
      case 'length':
        return 'length';
      case 'content_filter':
        return 'content_filter';
      case 'function_call':
        return 'function_call';
      default:
        return 'stop';
    }
  }
}
