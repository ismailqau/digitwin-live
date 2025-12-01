/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Groq Provider Implementation
 * Integrates with Groq Llama models for fast inference
 */

import Groq from 'groq-sdk';

import { ILLMProvider } from '../interfaces/LLMProvider';
import { logger } from '../temp-types';
import {
  LLMConfig,
  LLMContext,
  LLMResponse,
  StreamingLLMResponse,
  GroqConfig,
  LLMProvider,
  ProviderUnavailableError,
  RateLimitError,
  LLMMetrics,
  ChatMessage,
} from '../types';

export class GroqProvider implements ILLMProvider {
  readonly name = 'groq';
  private client: Groq | null = null;
  private config: GroqConfig | null = null;
  private metrics: LLMMetrics = {
    requestCount: 0,
    totalLatencyMs: 0,
    averageLatencyMs: 0,
    errorCount: 0,
    totalCost: 0,
    tokensGenerated: 0,
  };

  async initialize(config: any): Promise<void> {
    const groqConfig = config as GroqConfig;
    try {
      this.config = groqConfig;
      this.client = new Groq({
        apiKey: groqConfig.apiKey,
        baseURL: groqConfig.baseUrl,
        timeout: groqConfig.timeout,
        maxRetries: groqConfig.maxRetries,
      });

      logger.info('Groq provider initialized', {
        model: groqConfig.model,
      });
    } catch (error) {
      logger.error('Failed to initialize Groq provider', { error });
      throw new ProviderUnavailableError(LLMProvider.GROQ_LLAMA, error as Error);
    }
  }

  async generateResponse(context: LLMContext, config: LLMConfig): Promise<LLMResponse> {
    if (!this.client || !this.config) {
      throw new ProviderUnavailableError(LLMProvider.GROQ_LLAMA);
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

      logger.error('Groq generation failed', { error, context: context.sessionId });

      // Handle rate limiting (Groq has generous limits but still possible)
      if (error instanceof Error && error.message.includes('rate limit')) {
        throw new RateLimitError(config.provider);
      }

      throw new ProviderUnavailableError(config.provider, error as Error);
    }
  }

  async *generateStreamingResponse(
    context: LLMContext,
    config: LLMConfig
  ): AsyncGenerator<StreamingLLMResponse> {
    if (!this.client || !this.config) {
      throw new ProviderUnavailableError(LLMProvider.GROQ_LLAMA);
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
      logger.error('Groq streaming failed', { error, context: context.sessionId });

      if (error instanceof Error && error.message.includes('rate limit')) {
        throw new RateLimitError(config.provider);
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
    // Groq pricing (very competitive, as of 2024)
    const pricing = {
      'llama3-8b-8192': { input: 0.00005, output: 0.00008 }, // per 1K tokens
      'llama3-70b-8192': { input: 0.00059, output: 0.00079 },
      'mixtral-8x7b-32768': { input: 0.00024, output: 0.00024 },
    };

    const modelPricing = pricing[model as keyof typeof pricing] || pricing['llama3-8b-8192'];

    return (
      (promptTokens / 1000) * modelPricing.input + (completionTokens / 1000) * modelPricing.output
    );
  }

  validateConfig(config: unknown): boolean {
    const groqConfig = config as GroqConfig;
    return !!(groqConfig.apiKey && groqConfig.model);
  }

  getSupportedModels(): string[] {
    return ['llama3-8b-8192', 'llama3-70b-8192', 'mixtral-8x7b-32768'];
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
      default:
        return 'stop';
    }
  }
}
