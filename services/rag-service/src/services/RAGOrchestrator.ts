import { RAGError } from '@clone/errors';
import { logger } from '@clone/logger';

import { CacheService } from './CacheService';
import { ContextAssembler, ConversationTurn, UserProfile, LLMContext } from './ContextAssembler';
import { EmbeddingService } from './EmbeddingService';
import { QueryAnalyticsService } from './QueryAnalyticsService';
import { QueryOptimizer, QueryOptimizationConfig, OptimizedQuery } from './QueryOptimizer';
import { VectorSearchService, SearchFilter } from './VectorSearchService';

export interface RAGConfig {
  topK: number;
  similarityThreshold: number;
  maxConversationTurns: number;
  enableQueryOptimization: boolean;
  enableHybridSearch: boolean;
  sourcePriority: Record<string, number>;
}

export interface RAGQueryRequest {
  query: string;
  userId: string;
  conversationHistory?: ConversationTurn[];
  userProfile: UserProfile;
  filters?: Partial<SearchFilter>;
}

export interface RAGQueryResponse {
  context: LLMContext;
  prompt: string;
  searchResults: Array<{
    id: string;
    score: number;
    content: string;
    metadata: Record<string, unknown>;
  }>;
  optimizedQuery?: OptimizedQuery;
  hasInsufficientKnowledge: boolean;
  fallbackToGeneral: boolean;
  metrics: {
    embeddingLatencyMs: number;
    searchLatencyMs: number;
    optimizationLatencyMs: number;
    totalLatencyMs: number;
    cacheHit: boolean;
  };
}

/**
 * RAG Orchestrator - Coordinates embedding, search, and context assembly with query optimization
 */
export class RAGOrchestrator {
  private embeddingService: EmbeddingService;
  private vectorSearchService: VectorSearchService;
  private contextAssembler: ContextAssembler;
  private cacheService: CacheService;
  private queryOptimizer?: QueryOptimizer;
  private queryAnalytics?: QueryAnalyticsService;
  private config: RAGConfig;

  constructor(
    embeddingService: EmbeddingService,
    vectorSearchService: VectorSearchService,
    contextAssembler: ContextAssembler,
    cacheService: CacheService,
    config: RAGConfig,
    queryOptimizer?: QueryOptimizer,
    queryAnalytics?: QueryAnalyticsService
  ) {
    this.embeddingService = embeddingService;
    this.vectorSearchService = vectorSearchService;
    this.contextAssembler = contextAssembler;
    this.cacheService = cacheService;
    this.queryOptimizer = queryOptimizer;
    this.queryAnalytics = queryAnalytics;
    this.config = config;
  }

  /**
   * Process a RAG query end-to-end with optimization
   */
  async processQuery(request: RAGQueryRequest): Promise<RAGQueryResponse> {
    const startTime = Date.now();
    let embeddingLatencyMs = 0;
    let searchLatencyMs = 0;
    let optimizationLatencyMs = 0;
    let cacheHit = false;
    let optimizedQuery: OptimizedQuery | undefined;
    let hasInsufficientKnowledge = false;
    let fallbackToGeneral = false;

    try {
      logger.info('Processing RAG query', {
        userId: request.userId,
        query: request.query,
        enableOptimization: this.config.enableQueryOptimization,
      });

      // Step 1: Query optimization (if enabled)
      let queryToProcess = request.query;
      const searchFilter: SearchFilter = {
        userId: request.userId,
        ...request.filters,
      };

      if (this.config.enableQueryOptimization && this.queryOptimizer) {
        const optimizationStart = Date.now();
        optimizedQuery = this.queryOptimizer.preprocessQuery(request.query);

        // Use the normalized query for embedding and search
        queryToProcess = optimizedQuery.normalized;

        // Enable hybrid search if configured and keywords are available
        if (this.config.enableHybridSearch && optimizedQuery.keywords.length > 0) {
          searchFilter.hybridSearch = true;
          searchFilter.keywords = optimizedQuery.keywords;
        }

        optimizationLatencyMs = Date.now() - optimizationStart;

        logger.info('Query optimized', {
          original: request.query,
          normalized: optimizedQuery.normalized,
          keywords: optimizedQuery.keywords,
          expandedQueries: optimizedQuery.expanded.length,
        });
      }

      // Step 2: Check cache for search results
      const cacheKey = this.config.enableQueryOptimization ? queryToProcess : request.query;
      const cachedResults = await this.cacheService.getCachedSearchResults(
        cacheKey,
        request.userId,
        searchFilter as unknown as Record<string, unknown>
      );

      let searchResults;

      if (cachedResults) {
        cacheHit = true;
        searchResults = cachedResults;
        logger.info('Using cached search results');
      } else {
        // Step 3: Generate or retrieve embedding
        const embeddingStart = Date.now();
        let embedding = await this.cacheService.getCachedEmbedding(queryToProcess);

        if (!embedding) {
          embedding = await this.embeddingService.embedQuery(queryToProcess);
          await this.cacheService.cacheEmbedding(queryToProcess, embedding);
        } else {
          logger.info('Using cached embedding');
        }

        embeddingLatencyMs = Date.now() - embeddingStart;

        // Step 4: Perform vector search
        const searchStart = Date.now();
        searchResults = await this.vectorSearchService.search(
          embedding,
          this.config.topK,
          searchFilter
        );

        // Apply query optimization post-processing if enabled
        if (this.config.enableQueryOptimization && this.queryOptimizer) {
          // Re-rank results based on source priority and conversation context
          const conversationContext =
            request.conversationHistory?.slice(-3).map((turn) => turn.userTranscript) || [];
          searchResults = this.queryOptimizer.rerankResults(
            searchResults,
            this.config.sourcePriority,
            conversationContext
          );

          // Deduplicate similar results
          searchResults = this.queryOptimizer.deduplicateResults(searchResults);

          // Filter by relevance threshold
          searchResults = this.queryOptimizer.filterByRelevance(searchResults);

          // Check if knowledge is insufficient
          hasInsufficientKnowledge = this.queryOptimizer.hasInsufficientKnowledge(searchResults);
        }

        searchLatencyMs = Date.now() - searchStart;

        // Cache the search results
        await this.cacheService.cacheSearchResults(
          cacheKey,
          request.userId,
          searchFilter as unknown as Record<string, unknown>,
          searchResults
        );
      }

      // Step 5: Handle insufficient knowledge fallback
      if (hasInsufficientKnowledge) {
        fallbackToGeneral = true;
        logger.info('Insufficient knowledge detected, flagging for general knowledge fallback', {
          userId: request.userId,
          resultsCount: searchResults.length,
          avgScore:
            searchResults.length > 0
              ? searchResults.reduce((sum, r) => sum + r.score, 0) / searchResults.length
              : 0,
        });
      }

      // Step 6: Assemble context with conversation history integration
      const conversationHistory =
        request.conversationHistory?.slice(-this.config.maxConversationTurns) || [];
      const context = this.contextAssembler.assembleContext(
        request.query,
        searchResults,
        conversationHistory,
        request.userProfile
      );

      // Step 7: Build final prompt
      const prompt = this.contextAssembler.buildPrompt(context);

      // Step 8: Track analytics (if enabled)
      if (this.queryAnalytics && this.queryOptimizer) {
        const analytics = this.queryOptimizer.trackQueryAnalytics(
          request.query,
          request.userId,
          searchResults
        );
        // Store analytics asynchronously to not block the response
        this.queryAnalytics.storeAnalytics(analytics).catch((error) => {
          logger.error('Failed to store query analytics', { error });
        });
      }

      const totalLatencyMs = Date.now() - startTime;

      logger.info('RAG query processed successfully', {
        userId: request.userId,
        resultsFound: searchResults.length,
        totalLatencyMs,
        cacheHit,
        hasInsufficientKnowledge,
        fallbackToGeneral,
      });

      return {
        context,
        prompt,
        searchResults,
        optimizedQuery,
        hasInsufficientKnowledge,
        fallbackToGeneral,
        metrics: {
          embeddingLatencyMs,
          searchLatencyMs,
          optimizationLatencyMs,
          totalLatencyMs,
          cacheHit,
        },
      };
    } catch (error) {
      logger.error('RAG query processing failed', { error, userId: request.userId });
      throw new RAGError('RAG query processing failed');
    }
  }

  /**
   * Health check for RAG service
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    components: Record<string, boolean>;
  }> {
    const components: Record<string, boolean> = {
      embedding: false,
      vectorSearch: false,
      cache: false,
    };

    try {
      // Test embedding service
      try {
        await this.embeddingService.embedQuery('health check');
        components.embedding = true;
      } catch (error) {
        logger.error('Embedding service health check failed', { error });
      }

      // Test vector search service
      try {
        await this.vectorSearchService.search(new Array(768).fill(0), 1, {
          userId: 'health-check',
        });
        components.vectorSearch = true;
      } catch (error) {
        logger.error('Vector search service health check failed', { error });
      }

      // Test cache service
      try {
        await this.cacheService.getCachedEmbedding('health check');
        components.cache = true;
      } catch (error) {
        logger.error('Cache service health check failed', { error });
      }

      const allHealthy = Object.values(components).every((status) => status);

      return {
        status: allHealthy ? 'healthy' : 'unhealthy',
        components,
      };
    } catch (error) {
      logger.error('Health check failed', { error });
      return {
        status: 'unhealthy',
        components,
      };
    }
  }

  /**
   * Factory method to create RAGOrchestrator with query optimization
   */
  static createWithOptimization(
    embeddingService: EmbeddingService,
    vectorSearchService: VectorSearchService,
    contextAssembler: ContextAssembler,
    cacheService: CacheService,
    config: RAGConfig,
    queryOptimizationConfig?: QueryOptimizationConfig,
    analyticsConnectionString?: string
  ): RAGOrchestrator {
    let queryOptimizer: QueryOptimizer | undefined;
    let queryAnalytics: QueryAnalyticsService | undefined;

    if (config.enableQueryOptimization && queryOptimizationConfig) {
      queryOptimizer = new QueryOptimizer(queryOptimizationConfig);
      logger.info('Query optimization enabled');
    }

    if (analyticsConnectionString) {
      queryAnalytics = new QueryAnalyticsService(analyticsConnectionString);
      logger.info('Query analytics enabled');
    }

    return new RAGOrchestrator(
      embeddingService,
      vectorSearchService,
      contextAssembler,
      cacheService,
      config,
      queryOptimizer,
      queryAnalytics
    );
  }

  /**
   * Get popular queries for a user (requires analytics)
   */
  async getPopularQueries(userId?: string, limit: number = 10) {
    if (!this.queryAnalytics) {
      throw new RAGError('Query analytics not enabled');
    }
    return this.queryAnalytics.getPopularQueries(limit, userId);
  }

  /**
   * Get low confidence queries for improvement (requires analytics)
   */
  async getLowConfidenceQueries(userId?: string, limit: number = 10) {
    if (!this.queryAnalytics) {
      throw new RAGError('Query analytics not enabled');
    }
    return this.queryAnalytics.getLowConfidenceQueries(limit, userId);
  }

  /**
   * Get query statistics for a user (requires analytics)
   */
  async getUserQueryStats(userId: string) {
    if (!this.queryAnalytics) {
      throw new RAGError('Query analytics not enabled');
    }
    return this.queryAnalytics.getUserQueryStats(userId);
  }
}
