import { AllQueries, QueryType } from '../queries';
import { Query, QueryHandler, QueryResult } from '../types';

export interface QueryBusConfig {
  enableCaching?: boolean;
  cacheTTL?: number; // milliseconds
}

/**
 * Query Bus
 * Routes queries to their respective handlers
 */
export class QueryBus {
  private handlers: Map<string, QueryHandler<any, any>>;
  private cache: Map<string, { result: QueryResult; expiresAt: number }>;
  private config: QueryBusConfig;

  constructor(config: QueryBusConfig = {}) {
    this.handlers = new Map();
    this.cache = new Map();
    this.config = {
      enableCaching: false,
      cacheTTL: 60000, // 1 minute default
      ...config,
    };
  }

  /**
   * Register a query handler
   */
  register<TQuery extends Query>(queryType: QueryType, handler: QueryHandler<TQuery, any>): void {
    if (this.handlers.has(queryType)) {
      throw new Error(`Handler already registered for query type: ${queryType}`);
    }
    this.handlers.set(queryType, handler);
  }

  /**
   * Execute a query
   */
  async execute<TQuery extends AllQueries>(query: TQuery): Promise<QueryResult> {
    const handler = this.handlers.get(query.queryType);
    if (!handler) {
      throw new Error(`No handler registered for query type: ${query.queryType}`);
    }

    // Check cache if enabled
    if (this.config.enableCaching) {
      const cacheKey = this.getCacheKey(query);
      const cached = this.cache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        return {
          ...cached.result,
          fromCache: true,
        };
      }
    }

    // Execute query
    const result = await handler.handle(query);

    // Cache result if successful and caching is enabled
    if (result.success && this.config.enableCaching) {
      const cacheKey = this.getCacheKey(query);
      this.cache.set(cacheKey, {
        result,
        expiresAt: Date.now() + (this.config.cacheTTL || 60000),
      });
    }

    return result;
  }

  /**
   * Execute multiple queries in parallel
   */
  async executeMany<TQuery extends AllQueries>(queries: TQuery[]): Promise<QueryResult[]> {
    return Promise.all(queries.map((query) => this.execute(query)));
  }

  /**
   * Invalidate cache for a specific query
   */
  invalidateCache(query: Query): void {
    const cacheKey = this.getCacheKey(query);
    this.cache.delete(cacheKey);
  }

  /**
   * Invalidate all cache entries for a query type
   */
  invalidateCacheByType(queryType: QueryType): void {
    for (const [key] of this.cache) {
      if (key.startsWith(`${queryType}:`)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clear all cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get registered handler for a query type
   */
  getHandler(queryType: QueryType): QueryHandler<any, any> | undefined {
    return this.handlers.get(queryType);
  }

  /**
   * Check if a handler is registered
   */
  hasHandler(queryType: QueryType): boolean {
    return this.handlers.has(queryType);
  }

  /**
   * Generate cache key from query
   */
  private getCacheKey(query: Query): string {
    return `${query.queryType}:${JSON.stringify((query as any).payload)}`;
  }
}
