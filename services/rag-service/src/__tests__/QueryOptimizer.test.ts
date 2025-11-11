import { QueryOptimizer, QueryOptimizationConfig } from '../services/QueryOptimizer';
import { SearchResult } from '../services/VectorSearchService';

describe('QueryOptimizer', () => {
  let queryOptimizer: QueryOptimizer;
  let config: QueryOptimizationConfig;

  beforeEach(() => {
    config = {
      enablePreprocessing: true,
      enableQueryExpansion: true,
      enableReranking: true,
      enableDeduplication: true,
      relevanceThreshold: 0.7,
      maxResults: 10,
    };
    queryOptimizer = new QueryOptimizer(config);
  });

  describe('preprocessQuery', () => {
    it('should normalize query text', () => {
      const result = queryOptimizer.preprocessQuery('  What is AI  ');

      expect(result.original).toBe('  What is AI  ');
      expect(result.normalized).toBe('what is artificial intelligence');
      // Keywords are extracted from original words before expansion, so no keywords > 2 chars
      expect(result.keywords).toEqual([]);
    });

    it('should expand acronyms', () => {
      const result = queryOptimizer.preprocessQuery('How does ML work?');

      expect(result.normalized).toBe('how does machine learning work?');
    });

    it('should remove stop words from keywords', () => {
      const result = queryOptimizer.preprocessQuery('What is the best API?');

      expect(result.keywords).not.toContain('what');
      expect(result.keywords).not.toContain('is');
      expect(result.keywords).not.toContain('the');
      expect(result.keywords).toContain('best');
      expect(result.keywords).toContain('api?'); // Keywords are extracted before acronym expansion
    });

    it('should generate expanded queries with synonyms', () => {
      const result = queryOptimizer.preprocessQuery('How to create a database?');

      expect(result.expanded.length).toBeGreaterThan(1);
      expect(result.expanded.some((q) => q.includes('make'))).toBe(true);
    });
  });

  describe('rerankResults', () => {
    it('should rerank results based on source priority', () => {
      const results: SearchResult[] = [
        {
          id: '1',
          score: 0.8,
          content: 'Document content',
          metadata: { sourceType: 'document', createdAt: '2023-01-01' },
        },
        {
          id: '2',
          score: 0.7,
          content: 'FAQ content',
          metadata: { sourceType: 'faq', createdAt: '2023-01-01' },
        },
      ];

      const sourcePriority = { faq: 1.5, document: 1.0 };
      const reranked = queryOptimizer.rerankResults(results, sourcePriority);

      // FAQ should be ranked higher due to priority boost
      expect(reranked[0].metadata.sourceType).toBe('faq');
      expect(reranked[1].metadata.sourceType).toBe('document');
    });

    it('should apply recency boost', () => {
      const results: SearchResult[] = [
        {
          id: '1',
          score: 0.8,
          content: 'Old content',
          metadata: { sourceType: 'document', createdAt: '2020-01-01' },
        },
        {
          id: '2',
          score: 0.75,
          content: 'New content',
          metadata: { sourceType: 'document', createdAt: new Date().toISOString() },
        },
      ];

      const sourcePriority = { document: 1.0 };
      const reranked = queryOptimizer.rerankResults(results, sourcePriority);

      // Newer content should be ranked higher
      expect(reranked[0].content).toBe('New content');
    });
  });

  describe('deduplicateResults', () => {
    it('should remove similar content', () => {
      const results: SearchResult[] = [
        {
          id: '1',
          score: 0.9,
          content: 'machine learning algorithms',
          metadata: {},
        },
        {
          id: '2',
          score: 0.8,
          content: 'machine learning algorithms',
          metadata: {},
        },
        {
          id: '3',
          score: 0.7,
          content: 'Completely different topic about cooking',
          metadata: {},
        },
      ];

      const deduplicated = queryOptimizer.deduplicateResults(results);

      expect(deduplicated.length).toBe(2);
      expect(deduplicated.some((r) => r.content.includes('cooking'))).toBe(true);
    });
  });

  describe('filterByRelevance', () => {
    it('should filter results below threshold', () => {
      const results: SearchResult[] = [
        { id: '1', score: 0.9, content: 'High relevance', metadata: {} },
        { id: '2', score: 0.8, content: 'Good relevance', metadata: {} },
        { id: '3', score: 0.5, content: 'Low relevance', metadata: {} },
      ];

      const filtered = queryOptimizer.filterByRelevance(results);

      expect(filtered.length).toBe(2);
      expect(filtered.every((r) => r.score >= 0.7)).toBe(true);
    });
  });

  describe('hasInsufficientKnowledge', () => {
    it('should return true for empty results', () => {
      const result = queryOptimizer.hasInsufficientKnowledge([]);
      expect(result).toBe(true);
    });

    it('should return true for low average scores', () => {
      const results: SearchResult[] = [
        { id: '1', score: 0.5, content: 'Low score', metadata: {} },
        { id: '2', score: 0.6, content: 'Low score', metadata: {} },
      ];

      const result = queryOptimizer.hasInsufficientKnowledge(results);
      expect(result).toBe(true);
    });

    it('should return false for good results', () => {
      const results: SearchResult[] = [
        { id: '1', score: 0.9, content: 'High score', metadata: {} },
        { id: '2', score: 0.8, content: 'High score', metadata: {} },
      ];

      const result = queryOptimizer.hasInsufficientKnowledge(results);
      expect(result).toBe(false);
    });
  });

  describe('trackQueryAnalytics', () => {
    it('should create analytics object', () => {
      const results: SearchResult[] = [
        { id: '1', score: 0.9, content: 'Good result', metadata: {} },
        { id: '2', score: 0.8, content: 'Good result', metadata: {} },
      ];

      const analytics = queryOptimizer.trackQueryAnalytics('test query', 'user-123', results);

      expect(analytics.query).toBe('test query');
      expect(analytics.userId).toBe('user-123');
      expect(analytics.resultsCount).toBe(2);
      expect(analytics.avgRelevanceScore).toBeCloseTo(0.85);
      expect(analytics.hasLowConfidence).toBe(false);
    });
  });
});
