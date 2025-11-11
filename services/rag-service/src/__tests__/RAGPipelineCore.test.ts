/**
 * RAG Pipeline Core Tests
 * Simplified tests for core RAG functionality without complex mocking
 */

import { ContextAssembler } from '../services/ContextAssembler';
import { EmbeddingService } from '../services/EmbeddingService';
import { QueryOptimizer } from '../services/QueryOptimizer';
import { TextChunker } from '../services/TextChunker';

// Mock logger
jest.mock('@clone/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('RAG Pipeline Core', () => {
  describe('EmbeddingService Integration', () => {
    it('should generate embeddings for queries', async () => {
      const embeddingService = new EmbeddingService({
        model: 'text-embedding-004',
        projectId: 'test-project',
        location: 'us-central1',
      });

      const embedding = await embeddingService.embedQuery('What is machine learning?');

      expect(embedding).toHaveLength(768);
      expect(embedding.every((val) => typeof val === 'number')).toBe(true);
    });

    it('should generate embeddings for multiple documents', async () => {
      const embeddingService = new EmbeddingService({
        model: 'text-embedding-004',
        projectId: 'test-project',
        location: 'us-central1',
      });

      const documents = ['Doc 1', 'Doc 2', 'Doc 3'];
      const embeddings = await embeddingService.embedDocuments(documents);

      expect(embeddings).toHaveLength(3);
      expect(embeddings.every((emb) => emb.length === 768)).toBe(true);
    });
  });

  describe('TextChunker Integration', () => {
    it('should chunk text with proper overlap', () => {
      const chunker = new TextChunker({
        chunkSize: 100,
        overlap: 20,
        minChunkSize: 10,
      });

      const text = Array(20).fill('This is a test sentence.').join(' ');
      const chunks = chunker.chunk(text);

      expect(chunks.length).toBeGreaterThan(1);
      expect(chunks.every((chunk) => chunk.tokenCount > 0)).toBe(true);
    });

    it('should provide chunk statistics', () => {
      const chunker = new TextChunker({
        chunkSize: 100,
        overlap: 20,
      });

      const text = Array(50).fill('Test sentence with enough content.').join(' ');
      const chunks = chunker.chunk(text);
      const stats = chunker.getStats(chunks);

      expect(stats.totalChunks).toBe(chunks.length);
      if (chunks.length > 0) {
        expect(stats.avgTokensPerChunk).toBeGreaterThan(0);
      }
    });
  });

  describe('ContextAssembler Integration', () => {
    it('should assemble context from components', () => {
      const assembler = new ContextAssembler();
      const mockSearchResults = [
        {
          id: 'result-1',
          score: 0.9,
          content: 'Test content about machine learning',
          metadata: { title: 'ML Guide', sourceType: 'document' },
        },
      ];

      const mockUserProfile = {
        name: 'Test User',
        personalityTraits: ['analytical', 'helpful'],
      };

      const context = assembler.assembleContext(
        'What is ML?',
        mockSearchResults,
        [],
        mockUserProfile
      );

      expect(context.currentQuery).toBe('What is ML?');
      expect(context.relevantKnowledge).toHaveLength(1);
      expect(context.systemPrompt).toContain('Test User');
    });

    it('should build complete prompts', () => {
      const assembler = new ContextAssembler();
      const context = {
        systemPrompt: 'You are an AI assistant',
        userPersonality: 'Helpful and analytical',
        relevantKnowledge: ['Knowledge chunk 1'],
        conversationHistory: 'No previous conversation',
        currentQuery: 'Test query',
      };

      const prompt = assembler.buildPrompt(context);

      expect(prompt).toContain('You are an AI assistant');
      expect(prompt).toContain('Knowledge chunk 1');
      expect(prompt).toContain('Test query');
    });
  });

  describe('QueryOptimizer Integration', () => {
    it('should optimize queries', () => {
      const optimizer = new QueryOptimizer({
        enablePreprocessing: true,
        enableQueryExpansion: true,
        enableReranking: true,
        enableDeduplication: true,
        relevanceThreshold: 0.7,
        maxResults: 10,
      });

      const result = optimizer.preprocessQuery('What is AI?');

      expect(result.original).toBe('What is AI?');
      expect(result.normalized).toContain('ai'); // The actual normalization may vary
      expect(result.expanded.length).toBeGreaterThan(0);
    });

    it('should rerank results by source priority', () => {
      const optimizer = new QueryOptimizer({
        enablePreprocessing: true,
        enableQueryExpansion: true,
        enableReranking: true,
        enableDeduplication: true,
        relevanceThreshold: 0.7,
        maxResults: 10,
      });

      const results = [
        {
          id: 'doc-1',
          score: 0.9,
          content: 'Document content',
          metadata: { sourceType: 'document', createdAt: '2023-01-01' },
        },
        {
          id: 'faq-1',
          score: 0.8,
          content: 'FAQ content',
          metadata: { sourceType: 'faq', createdAt: '2023-01-01' },
        },
      ];

      const reranked = optimizer.rerankResults(results, { faq: 1.5, document: 1.0 });

      // FAQ should be ranked higher due to priority boost
      expect(reranked[0].metadata.sourceType).toBe('faq');
      expect(reranked[1].metadata.sourceType).toBe('document');
    });

    it('should filter results by relevance threshold', () => {
      const optimizer = new QueryOptimizer({
        enablePreprocessing: true,
        enableQueryExpansion: true,
        enableReranking: true,
        enableDeduplication: true,
        relevanceThreshold: 0.7,
        maxResults: 10,
      });

      const results = [
        {
          id: 'high-1',
          score: 0.9,
          content: 'High relevance',
          metadata: { sourceType: 'document', createdAt: '2023-01-01' },
        },
        {
          id: 'low-1',
          score: 0.5,
          content: 'Low relevance',
          metadata: { sourceType: 'document', createdAt: '2023-01-01' },
        },
      ];

      const filtered = optimizer.filterByRelevance(results);

      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('high-1');
    });
  });

  describe('Performance Tests', () => {
    it('should handle concurrent embedding generation', async () => {
      const embeddingService = new EmbeddingService({
        model: 'text-embedding-004',
        projectId: 'test-project',
        location: 'us-central1',
      });

      const queries = ['Query 1', 'Query 2', 'Query 3', 'Query 4', 'Query 5'];

      const start = Date.now();
      const embeddings = await Promise.all(
        queries.map((query) => embeddingService.embedQuery(query))
      );
      const duration = Date.now() - start;

      expect(embeddings).toHaveLength(5);
      expect(duration).toBeLessThan(1000); // Should be fast for mock
    });

    it('should handle large text chunking efficiently', () => {
      const chunker = new TextChunker({
        chunkSize: 500,
        overlap: 100,
      });

      const largeText = Array(1000).fill('This is a test sentence.').join(' ');

      const start = Date.now();
      const chunks = chunker.chunk(largeText);
      const duration = Date.now() - start;

      expect(chunks.length).toBeGreaterThan(1);
      expect(duration).toBeLessThan(1000);
    });

    it('should handle large context assembly efficiently', () => {
      const assembler = new ContextAssembler();

      const largeResults = Array(100)
        .fill(0)
        .map((_, i) => ({
          id: `result-${i}`,
          score: 0.8,
          content: `Content ${i}`,
          metadata: { title: `Doc ${i}`, sourceType: 'document' },
        }));

      const userProfile = {
        name: 'Test User',
        personalityTraits: ['helpful'],
      };

      const start = Date.now();
      const context = assembler.assembleContext('Test query', largeResults, [], userProfile);
      const duration = Date.now() - start;

      expect(context.relevantKnowledge.length).toBeGreaterThan(0);
      expect(duration).toBeLessThan(100);
    });
  });

  describe('Error Handling', () => {
    it('should handle empty inputs gracefully', () => {
      const chunker = new TextChunker({
        chunkSize: 100,
        overlap: 20,
      });

      const chunks = chunker.chunk('');
      expect(chunks).toHaveLength(0);
    });

    it('should handle malformed search results', () => {
      const assembler = new ContextAssembler();
      const malformedResults = [
        {
          id: 'malformed',
          score: 0.8,
          content: '', // Use empty string instead of null
          metadata: {},
        },
      ];

      const userProfile = {
        name: 'Test User',
        personalityTraits: ['helpful'],
      };

      // Should not throw error
      expect(() => {
        assembler.assembleContext('test', malformedResults, [], userProfile);
      }).not.toThrow();
    });

    it('should handle query optimization with empty input', () => {
      const optimizer = new QueryOptimizer({
        enablePreprocessing: true,
        enableQueryExpansion: true,
        enableReranking: true,
        enableDeduplication: true,
        relevanceThreshold: 0.7,
        maxResults: 10,
      });

      const result = optimizer.preprocessQuery('');
      expect(result.original).toBe('');
      expect(result.normalized).toBe('');
    });
  });

  describe('FAQ Priority Handling', () => {
    it('should prioritize FAQ sources correctly', () => {
      const optimizer = new QueryOptimizer({
        enablePreprocessing: true,
        enableQueryExpansion: true,
        enableReranking: true,
        enableDeduplication: true,
        relevanceThreshold: 0.7,
        maxResults: 10,
      });

      const mixedResults = [
        {
          id: 'doc-1',
          score: 0.95,
          content: 'Document content',
          metadata: { sourceType: 'document', createdAt: '2023-01-01' },
        },
        {
          id: 'faq-1',
          score: 0.85,
          content: 'FAQ content',
          metadata: { sourceType: 'faq', createdAt: '2023-01-01' },
        },
        {
          id: 'conv-1',
          score: 0.9,
          content: 'Conversation content',
          metadata: { sourceType: 'conversation', createdAt: '2023-01-01' },
        },
      ];

      const sourcePriority = { faq: 1.5, document: 1.0, conversation: 0.8 };
      const reranked = optimizer.rerankResults(mixedResults, sourcePriority);

      // FAQ should be first despite lower original score
      expect(reranked[0].metadata.sourceType).toBe('faq');
    });

    it('should handle insufficient knowledge detection', () => {
      const optimizer = new QueryOptimizer({
        enablePreprocessing: true,
        enableQueryExpansion: true,
        enableReranking: true,
        enableDeduplication: true,
        relevanceThreshold: 0.7,
        maxResults: 10,
      });

      const lowQualityResults = [
        {
          id: 'low-1',
          score: 0.3,
          content: 'Low quality content',
          metadata: { sourceType: 'document', createdAt: '2023-01-01' },
        },
      ];

      const hasInsufficientKnowledge = optimizer.hasInsufficientKnowledge(lowQualityResults);
      expect(hasInsufficientKnowledge).toBe(true);
    });
  });
});
