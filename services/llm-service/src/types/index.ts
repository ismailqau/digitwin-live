/**
 * LLM Service Types
 * Defines interfaces and types for multi-provider LLM integration
 */

export enum LLMProvider {
  GEMINI_FLASH = 'gemini-flash',
  GEMINI_PRO = 'gemini-pro',
  GPT4_TURBO = 'gpt4-turbo',
  GPT4 = 'gpt4',
  GROQ_LLAMA = 'groq-llama',
}

export interface LLMConfig {
  provider: LLMProvider;
  model: string;
  temperature: number;
  maxTokens: number;
  stopSequences?: string[];
  streamingEnabled: boolean;
}

export interface LLMContext {
  systemPrompt: string;
  userPersonality: string;
  relevantKnowledge: string[];
  conversationHistory: string;
  currentQuery: string;
  userId: string;
  sessionId: string;
}

export interface LLMResponse {
  content: string;
  finishReason: 'stop' | 'length' | 'content_filter' | 'function_call';
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  provider: LLMProvider;
  model: string;
  latencyMs: number;
  cost: number;
}

export interface StreamingLLMResponse {
  token: string;
  isComplete: boolean;
  usage?: LLMResponse['usage'];
  finishReason?: LLMResponse['finishReason'];
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ProviderConfig {
  apiKey: string;
  baseUrl?: string;
  model: string;
  maxRetries: number;
  timeout: number;
}

export interface GeminiConfig extends ProviderConfig {
  projectId: string;
  location: string;
}

export interface OpenAIConfig extends ProviderConfig {
  organization?: string;
}

export interface GroqConfig extends ProviderConfig {
  // Groq-specific configuration (extends base config for now)
  model: string;
}

export interface LLMMetrics {
  requestCount: number;
  totalLatencyMs: number;
  averageLatencyMs: number;
  errorCount: number;
  totalCost: number;
  tokensGenerated: number;
  [key: string]: any;
}

export interface CacheEntry {
  key: string;
  response: string;
  usage: LLMResponse['usage'];
  createdAt: Date;
  expiresAt: Date;
}

export class LLMError extends Error {
  constructor(
    message: string,
    public provider: LLMProvider,
    public code: string,
    public retryable: boolean = false
  ) {
    super(message);
    this.name = 'LLMError';
  }
}

export class ProviderUnavailableError extends LLMError {
  constructor(provider: LLMProvider, originalError?: Error) {
    super(
      `Provider ${provider} is currently unavailable: ${originalError?.message || 'Unknown error'}`,
      provider,
      'PROVIDER_UNAVAILABLE',
      true
    );
  }
}

export class RateLimitError extends LLMError {
  constructor(provider: LLMProvider, retryAfter?: number) {
    super(
      `Rate limit exceeded for provider ${provider}${retryAfter ? `, retry after ${retryAfter}s` : ''}`,
      provider,
      'RATE_LIMIT_EXCEEDED',
      true
    );
  }
}

export class ContentFilterError extends LLMError {
  constructor(provider: LLMProvider, reason: string) {
    super(
      `Content filtered by provider ${provider}: ${reason}`,
      provider,
      'CONTENT_FILTERED',
      false
    );
  }
}
