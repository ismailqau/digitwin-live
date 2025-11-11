/**
 * Gemini Provider Implementation
 * Integrates with Google Vertex AI Gemini models
 */

import { VertexAI } from '@google-cloud/vertexai';

import { ILLMProvider } from '../interfaces/LLMProvider';
import { logger } from '../temp-types';
import {
  LLMConfig,
  LLMContext,
  LLMResponse,
  StreamingLLMResponse,
  GeminiConfig,
  LLMProvider,
  ProviderUnavailableError,
  RateLimitError,
  ContentFilterError,
  LLMMetrics,
} from '../types';

export class GeminiProvider implements ILLMProvider {
  readonly name = 'gemini';
  private vertexAI: VertexAI | null = null;
  private config: GeminiConfig | null = null;
  private metrics: LLMMetrics = {
    requestCount: 0,
    totalLatencyMs: 0,
    averageLatencyMs: 0,
    errorCount: 0,
    totalCost: 0,
    tokensGenerated: 0,
  };

  async initialize(config: any): Promise<void> {
    const geminiConfig = config as GeminiConfig;
    try {
      this.config = geminiConfig;
      this.vertexAI = new VertexAI({
        project: geminiConfig.projectId,
        location: geminiConfig.location,
      });

      logger.info('Gemini provider initialized', {
        projectId: geminiConfig.projectId,
        location: geminiConfig.location,
        model: geminiConfig.model,
      });
    } catch (error) {
      logger.error('Failed to initialize Gemini provider', { error });
      throw new ProviderUnavailableError(LLMProvider.GEMINI_FLASH, error as Error);
    }
  }

  async generateResponse(context: LLMContext, config: LLMConfig): Promise<LLMResponse> {
    if (!this.vertexAI || !this.config) {
      throw new ProviderUnavailableError(LLMProvider.GEMINI_FLASH);
    }

    const startTime = Date.now();
    this.metrics.requestCount++;

    try {
      const model = this.vertexAI.getGenerativeModel({
        model: config.model,
        generationConfig: {
          temperature: config.temperature,
          maxOutputTokens: config.maxTokens,
          stopSequences: config.stopSequences,
        },
      });

      const prompt = this.buildPrompt(context);
      const result = await model.generateContent(prompt);
      const response = result.response;

      if (!response.candidates || response.candidates.length === 0) {
        throw new Error('No response candidates generated');
      }

      const candidate = response.candidates[0];
      const content = candidate.content?.parts?.[0]?.text || '';

      // Handle safety ratings and content filtering
      if (candidate.finishReason === 'SAFETY') {
        throw new ContentFilterError(
          config.provider,
          `Content filtered due to safety concerns: ${candidate.safetyRatings?.map((r: any) => r.category).join(', ')}`
        );
      }

      const latencyMs = Date.now() - startTime;
      const usage = {
        promptTokens: response.usageMetadata?.promptTokenCount || 0,
        completionTokens: response.usageMetadata?.candidatesTokenCount || 0,
        totalTokens: response.usageMetadata?.totalTokenCount || 0,
      };

      const cost = this.estimateCost(usage.promptTokens, usage.completionTokens, config.model);

      // Update metrics
      this.metrics.totalLatencyMs += latencyMs;
      this.metrics.averageLatencyMs = this.metrics.totalLatencyMs / this.metrics.requestCount;
      this.metrics.totalCost += cost;
      this.metrics.tokensGenerated += usage.completionTokens;

      return {
        content,
        finishReason: this.mapFinishReason(candidate.finishReason),
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

      logger.error('Gemini generation failed', { error, context: context.sessionId });

      if (error instanceof ContentFilterError) {
        throw error;
      }

      // Handle rate limiting
      if (error instanceof Error && error.message.includes('quota')) {
        throw new RateLimitError(config.provider);
      }

      throw new ProviderUnavailableError(config.provider, error as Error);
    }
  }

  async *generateStreamingResponse(
    context: LLMContext,
    config: LLMConfig
  ): AsyncGenerator<StreamingLLMResponse> {
    if (!this.vertexAI || !this.config) {
      throw new ProviderUnavailableError(LLMProvider.GEMINI_FLASH);
    }

    const startTime = Date.now();
    this.metrics.requestCount++;

    try {
      const model = this.vertexAI.getGenerativeModel({
        model: config.model,
        generationConfig: {
          temperature: config.temperature,
          maxOutputTokens: config.maxTokens,
          stopSequences: config.stopSequences,
        },
      });

      const prompt = this.buildPrompt(context);
      const streamingResult = await model.generateContentStream(prompt);

      const totalTokens = 0;
      let completionTokens = 0;

      for await (const chunk of streamingResult.stream) {
        const candidate = chunk.candidates?.[0];
        if (!candidate) continue;

        const content = candidate.content?.parts?.[0]?.text || '';
        if (content) {
          completionTokens += content.split(' ').length; // Rough token estimation
          yield {
            token: content,
            isComplete: false,
          };
        }

        // Handle safety filtering
        if (candidate.finishReason === 'SAFETY') {
          throw new ContentFilterError(
            config.provider,
            `Content filtered: ${candidate.safetyRatings?.map((r: any) => r.category).join(', ')}`
          );
        }
      }

      // Get final response for usage metadata
      const finalResponse = await streamingResult.response;
      const usage = {
        promptTokens: finalResponse.usageMetadata?.promptTokenCount || 0,
        completionTokens: finalResponse.usageMetadata?.candidatesTokenCount || completionTokens,
        totalTokens: finalResponse.usageMetadata?.totalTokenCount || totalTokens,
      };

      const latencyMs = Date.now() - startTime;
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
        finishReason: this.mapFinishReason(finalResponse.candidates?.[0]?.finishReason),
      };
    } catch (error) {
      this.metrics.errorCount++;
      logger.error('Gemini streaming failed', { error, context: context.sessionId });

      if (error instanceof ContentFilterError) {
        throw error;
      }

      if (error instanceof Error && error.message.includes('quota')) {
        throw new RateLimitError(config.provider);
      }

      throw new ProviderUnavailableError(config.provider, error as Error);
    }
  }

  async isAvailable(): Promise<boolean> {
    if (!this.vertexAI || !this.config) {
      return false;
    }

    try {
      // Simple health check - try to get model info
      const model = this.vertexAI.getGenerativeModel({ model: this.config.model });
      await model.generateContent('test');
      return true;
    } catch {
      return false;
    }
  }

  getMetrics(): LLMMetrics {
    return { ...this.metrics };
  }

  estimateCost(promptTokens: number, completionTokens: number, model: string): number {
    // Gemini pricing (approximate, as of 2024)
    const pricing = {
      'gemini-1.5-flash': { input: 0.000075, output: 0.0003 }, // per 1K tokens
      'gemini-1.5-pro': { input: 0.00125, output: 0.005 },
      'gemini-1.0-pro': { input: 0.0005, output: 0.0015 },
    };

    const modelPricing = pricing[model as keyof typeof pricing] || pricing['gemini-1.5-flash'];

    return (
      (promptTokens / 1000) * modelPricing.input + (completionTokens / 1000) * modelPricing.output
    );
  }

  validateConfig(config: unknown): boolean {
    const geminiConfig = config as GeminiConfig;
    return !!(
      geminiConfig.projectId &&
      geminiConfig.location &&
      geminiConfig.model &&
      geminiConfig.apiKey
    );
  }

  getSupportedModels(): string[] {
    return ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-1.0-pro'];
  }

  private buildPrompt(context: LLMContext): string {
    return `${context.systemPrompt}

Personality: ${context.userPersonality}

Relevant Knowledge:
${context.relevantKnowledge.join('\n')}

Conversation History:
${context.conversationHistory}

Current Question: ${context.currentQuery}

Response:`;
  }

  private mapFinishReason(reason: string | undefined): LLMResponse['finishReason'] {
    switch (reason) {
      case 'STOP':
        return 'stop';
      case 'MAX_TOKENS':
        return 'length';
      case 'SAFETY':
        return 'content_filter';
      default:
        return 'stop';
    }
  }
}
