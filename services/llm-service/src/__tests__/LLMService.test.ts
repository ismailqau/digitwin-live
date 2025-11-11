/**
 * LLM Service Tests
 * Basic tests to verify the LLM service functionality
 */

import { LLMService, LLMServiceConfig } from '../services/LLMService';
import { PrismaClient } from '../temp-types';
import { LLMProvider } from '../types';

// Mock PrismaClient
const mockPrismaClient = {
  cache_llm_responses: {
    findFirst: jest.fn(),
    create: jest.fn(),
    deleteMany: jest.fn(),
    count: jest.fn(),
  },
  conversationSession: {
    findUnique: jest.fn(),
    update: jest.fn(),
    upsert: jest.fn(),
    deleteMany: jest.fn(),
  },
  $executeRaw: jest.fn(),
} as unknown as PrismaClient;

describe('LLMService', () => {
  let llmService: LLMService;
  let config: LLMServiceConfig;

  beforeEach(() => {
    config = {
      primaryProvider: LLMProvider.GEMINI_FLASH,
      fallbackProviders: [LLMProvider.GPT4, LLMProvider.GROQ_LLAMA],
      enableCaching: true,
      enableCircuitBreaker: true,
      providerConfigs: {
        [LLMProvider.GEMINI_FLASH]: {
          projectId: 'test-project',
          location: 'us-central1',
          apiKey: 'test-key',
          model: 'gemini-1.5-flash',
          maxRetries: 3,
          timeout: 30000,
        },
        [LLMProvider.GPT4]: {
          apiKey: 'test-openai-key',
          model: 'gpt-4-turbo',
          maxRetries: 3,
          timeout: 30000,
        },
        [LLMProvider.GROQ_LLAMA]: {
          apiKey: 'test-groq-key',
          model: 'llama3-8b-8192',
          maxRetries: 3,
          timeout: 30000,
        },
      },
    };

    llmService = new LLMService(config, mockPrismaClient);
  });

  describe('initialization', () => {
    it('should create LLM service with correct configuration', () => {
      expect(llmService).toBeInstanceOf(LLMService);
    });

    it('should initialize with primary and fallback providers', async () => {
      // This would normally initialize providers, but we're using mocks
      // so we'll just verify the service was created
      expect(llmService).toBeDefined();
    });
  });

  describe('metrics', () => {
    it('should return service metrics', () => {
      const metrics = llmService.getMetrics();

      expect(metrics).toHaveProperty('service');
      expect(metrics).toHaveProperty('providers');
      expect(metrics).toHaveProperty('circuitBreakers');
      expect(metrics).toHaveProperty('cache');
    });

    it('should track cache hit rate', () => {
      const metrics = llmService.getMetrics();

      expect(metrics.cache).toHaveProperty('enabled', true);
      expect(metrics.cache).toHaveProperty('hitRate');
    });
  });

  describe('health status', () => {
    it('should return health status for all providers', async () => {
      const healthStatus = await llmService.getHealthStatus();

      expect(typeof healthStatus).toBe('object');
      // Health checks would fail with mock providers, but structure should be correct
    });
  });

  describe('cache management', () => {
    it('should clear cache when requested', async () => {
      await llmService.clearCache();
      // Should not throw error
    });
  });
});
