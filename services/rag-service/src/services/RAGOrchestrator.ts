import { RAGError } from '@clone/errors';
import { logger } from '@clone/logger';

import { CacheService } from './CacheService';
import { ContextAssembler, ConversationTurn, UserProfile, LLMContext } from './ContextAssembler';
import { EmbeddingService } from './EmbeddingService';
import { VectorSearchService, SearchFilter } from './VectorSearchService';

export interface RAGConfig {
  topK: number;
  similarityThreshold: number;
  maxConversationTurns: number;
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
  metrics: {
    embeddingLatencyMs: number;
    searchLatencyMs: number;
    totalLatencyMs: number;
    cacheHit: boolean;
  };
}

/**
 * RAG Orchestrator - Coordinates embedding, search, and context assembly
 */
export class RAGOrchestrator {
  private embeddingService: EmbeddingService;
  private vectorSearchService: VectorSearchService;
  private contextAssembler: ContextAssembler;
  private cacheService: CacheService;
  private config: RAGConfig;

  constructor(
    embeddingService: EmbeddingService,
    vectorSearchService: VectorSearchService,
    contextAssembler: ContextAssembler,
    cacheService: CacheService,
    config: RAGConfig
  ) {
    this.embeddingService = embeddingService;
    this.vectorSearchService = vectorSearchService;
    this.contextAssembler = contextAssembler;
    this.cacheService = cacheService;
    this.config = config;
  }

  /**
   * Process a RAG query end-to-end
   */
  async processQuery(request: RAGQueryRequest): Promise<RAGQueryResponse> {
    const startTime = Date.now();
    let embeddingLatencyMs = 0;
    let searchLatencyMs = 0;
    let cacheHit = false;

    try {
      logger.info('Processing RAG query', {
        userId: request.userId,
        query: request.query,
      });

      // Step 1: Check cache for search results
      const cachedResults = await this.cacheService.getCachedSearchResults(
        request.query,
        request.userId,
        request.filters || {}
      );

      let searchResults;

      if (cachedResults) {
        cacheHit = true;
        searchResults = cachedResults;
        logger.info('Using cached search results');
      } else {
        // Step 2: Generate or retrieve embedding
        const embeddingStart = Date.now();
        let embedding = await this.cacheService.getCachedEmbedding(request.query);

        if (!embedding) {
          embedding = await this.embeddingService.embedQuery(request.query);
          await this.cacheService.cacheEmbedding(request.query, embedding);
        } else {
          logger.info('Using cached embedding');
        }

        embeddingLatencyMs = Date.now() - embeddingStart;

        // Step 3: Perform vector search
        const searchStart = Date.now();
        const filter: SearchFilter = {
          userId: request.userId,
          ...request.filters,
        };

        searchResults = await this.vectorSearchService.search(embedding, this.config.topK, filter);

        searchLatencyMs = Date.now() - searchStart;

        // Cache the search results
        await this.cacheService.cacheSearchResults(
          request.query,
          request.userId,
          request.filters || {},
          searchResults
        );
      }

      // Step 4: Assemble context
      const context = this.contextAssembler.assembleContext(
        request.query,
        searchResults,
        request.conversationHistory || [],
        request.userProfile
      );

      // Step 5: Build final prompt
      const prompt = this.contextAssembler.buildPrompt(context);

      const totalLatencyMs = Date.now() - startTime;

      logger.info('RAG query processed successfully', {
        userId: request.userId,
        resultsFound: searchResults.length,
        totalLatencyMs,
        cacheHit,
      });

      return {
        context,
        prompt,
        searchResults,
        metrics: {
          embeddingLatencyMs,
          searchLatencyMs,
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
}
