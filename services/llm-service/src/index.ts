/**
 * LLM Service - Multi-provider LLM integration
 * Provides unified interface for Gemini, OpenAI, and Groq models
 */

export const LLM_SERVICE_VERSION = '1.0.0';

// Main service
export { LLMService, type LLMServiceConfig } from './services/LLMService';

// Supporting services
export { LLMCacheService } from './cache/LLMCacheService';
export { CostTracker } from './services/CostTracker';
export { ContextManager } from './services/ContextManager';
export { PromptTemplateService } from './services/PromptTemplateService';
export { SentenceBuffer } from './services/SentenceBuffer';

// Provider interfaces and factory
export { type ILLMProvider, type ILLMProviderFactory } from './interfaces/LLMProvider';
export { ProviderFactory } from './providers/ProviderFactory';

// Individual providers
export { GeminiProvider } from './providers/GeminiProvider';
export { OpenAIProvider } from './providers/OpenAIProvider';
export { GroqProvider } from './providers/GroqProvider';

// Circuit breaker
export { CircuitBreaker, CircuitState, type CircuitBreakerConfig } from './utils/CircuitBreaker';

// Types and enums
export * from './types';
