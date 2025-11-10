import { CacheService } from '../services/CacheService';
import { ContextAssembler } from '../services/ContextAssembler';
import { EmbeddingService } from '../services/EmbeddingService';
import { RAGOrchestrator } from '../services/RAGOrchestrator';
import { VectorSearchService } from '../services/VectorSearchService';

// Mock dependencies
jest.mock('../services/EmbeddingService');
jest.mock('../services/VectorSearchService');
jest.mock('../services/ContextAssembler');
jest.mock('../services/CacheService');

describe('RAGOrchestrator', () => {
  let ragOrchestrator: RAGOrchestrator;
  let mockEmbeddingService: jest.Mocked<EmbeddingService>;
  let mockVectorSearchService: {
    search: jest.Mock;
    upsert: jest.Mock;
    delete: jest.Mock;
  };
  let mockContextAssembler: {
    assembleContext: jest.Mock;
    buildPrompt: jest.Mock;
  };
  let mockCacheService: {
    getCachedEmbedding: jest.Mock;
    cacheEmbedding: jest.Mock;
    getCachedSearchResults: jest.Mock;
    cacheSearchResults: jest.Mock;
    cleanup: jest.Mock;
  };

  beforeEach(() => {
    // Create mocked instances
    mockEmbeddingService = new EmbeddingService({
      model: 'text-embedding-004',
      projectId: 'test-project',
      location: 'us-central1',
    }) as jest.Mocked<EmbeddingService>;

    mockVectorSearchService = {
      search: jest.fn(),
      upsert: jest.fn(),
      delete: jest.fn(),
    };

    mockContextAssembler = {
      assembleContext: jest.fn(),
      buildPrompt: jest.fn(),
    };

    mockCacheService = {
      getCachedEmbedding: jest.fn(),
      cacheEmbedding: jest.fn(),
      getCachedSearchResults: jest.fn(),
      cacheSearchResults: jest.fn(),
      cleanup: jest.fn(),
    };

    ragOrchestrator = new RAGOrchestrator(
      mockEmbeddingService,
      mockVectorSearchService as unknown as VectorSearchService,
      mockContextAssembler as unknown as ContextAssembler,
      mockCacheService as unknown as CacheService,
      {
        topK: 5,
        similarityThreshold: 0.7,
        maxConversationTurns: 5,
      }
    );
  });

  describe('processQuery', () => {
    it('should process query successfully with cache miss', async () => {
      // Arrange
      const mockEmbedding = new Array(768).fill(0.1);
      const mockSearchResults = [
        {
          id: '1',
          score: 0.9,
          content: 'Test content',
          metadata: { title: 'Test Doc' },
        },
      ];
      const mockContext = {
        systemPrompt: 'Test prompt',
        userPersonality: 'friendly',
        relevantKnowledge: ['Test knowledge'],
        conversationHistory: '',
        currentQuery: 'Test query',
      };
      const mockPrompt = 'Full test prompt';

      mockCacheService.getCachedSearchResults.mockResolvedValue(null);
      mockCacheService.getCachedEmbedding.mockResolvedValue(null);
      mockEmbeddingService.embedQuery = jest.fn().mockResolvedValue(mockEmbedding);
      mockVectorSearchService.search.mockResolvedValue(mockSearchResults);
      mockContextAssembler.assembleContext.mockReturnValue(mockContext);
      mockContextAssembler.buildPrompt.mockReturnValue(mockPrompt);

      // Act
      const result = await ragOrchestrator.processQuery({
        query: 'Test query',
        userId: 'user-123',
        userProfile: {
          name: 'Test User',
          personalityTraits: ['friendly'],
        },
      });

      // Assert
      expect(result.context).toEqual(mockContext);
      expect(result.prompt).toEqual(mockPrompt);
      expect(result.searchResults).toEqual(mockSearchResults);
      expect(result.metrics.cacheHit).toBe(false);
      expect(result.metrics.totalLatencyMs).toBeGreaterThanOrEqual(0);
      expect(mockEmbeddingService.embedQuery).toHaveBeenCalledWith('Test query');
      expect(mockVectorSearchService.search).toHaveBeenCalled();
      expect(mockCacheService.cacheEmbedding).toHaveBeenCalled();
      expect(mockCacheService.cacheSearchResults).toHaveBeenCalled();
    });

    it('should use cached search results when available', async () => {
      // Arrange
      const mockSearchResults = [
        {
          id: '1',
          score: 0.9,
          content: 'Cached content',
          metadata: { title: 'Cached Doc' },
        },
      ];
      const mockContext = {
        systemPrompt: 'Test prompt',
        userPersonality: 'friendly',
        relevantKnowledge: ['Cached knowledge'],
        conversationHistory: '',
        currentQuery: 'Test query',
      };

      mockCacheService.getCachedSearchResults.mockResolvedValue(mockSearchResults);
      mockContextAssembler.assembleContext.mockReturnValue(mockContext);
      mockContextAssembler.buildPrompt.mockReturnValue('Cached prompt');

      // Act
      const result = await ragOrchestrator.processQuery({
        query: 'Test query',
        userId: 'user-123',
        userProfile: {
          name: 'Test User',
          personalityTraits: ['friendly'],
        },
      });

      // Assert
      expect(result.metrics.cacheHit).toBe(true);
      expect(mockEmbeddingService.embedQuery).not.toHaveBeenCalled();
      expect(mockVectorSearchService.search).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      // Arrange
      mockCacheService.getCachedSearchResults.mockResolvedValue(null);
      mockCacheService.getCachedEmbedding.mockResolvedValue(null);
      mockEmbeddingService.embedQuery = jest.fn().mockRejectedValue(new Error('Embedding failed'));

      // Act & Assert
      await expect(
        ragOrchestrator.processQuery({
          query: 'Test query',
          userId: 'user-123',
          userProfile: {
            name: 'Test User',
            personalityTraits: ['friendly'],
          },
        })
      ).rejects.toThrow();
    });
  });

  describe('healthCheck', () => {
    it('should return healthy status when all components are working', async () => {
      // Arrange
      mockEmbeddingService.embedQuery = jest.fn().mockResolvedValue([0.1]);
      mockVectorSearchService.search.mockResolvedValue([]);
      mockCacheService.getCachedEmbedding.mockResolvedValue(null);

      // Act
      const result = await ragOrchestrator.healthCheck();

      // Assert
      expect(result.status).toBe('healthy');
      expect(result.components.embedding).toBe(true);
      expect(result.components.vectorSearch).toBe(true);
      expect(result.components.cache).toBe(true);
    });

    it('should return unhealthy status when a component fails', async () => {
      // Arrange
      mockEmbeddingService.embedQuery = jest.fn().mockRejectedValue(new Error('Service down'));
      mockVectorSearchService.search.mockResolvedValue([]);
      mockCacheService.getCachedEmbedding.mockResolvedValue(null);

      // Act
      const result = await ragOrchestrator.healthCheck();

      // Assert
      expect(result.status).toBe('unhealthy');
      expect(result.components.embedding).toBe(false);
    });
  });
});
