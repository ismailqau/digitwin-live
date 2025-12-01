/**
 * @clone/cache-service - PostgreSQL-based caching for Real-Time Conversational Clone System
 *
 * This package provides caching services using PostgreSQL cache tables.
 * DO NOT use Redis or Memcached - this project uses PostgreSQL for all caching.
 *
 * Cache tables:
 * - EmbeddingCache: Caches query embeddings (TTL: 1 hour)
 * - VectorSearchCache: Caches vector search results (TTL: 5 minutes)
 * - LLMResponseCache: Caches LLM responses (TTL: 1 hour)
 * - AudioChunkCache: Caches TTS audio chunks (TTL: 5 minutes)
 *
 * Environment variables:
 * - ENABLE_CACHING: Enable/disable caching (default: false)
 * - CACHE_TTL_SHORT: Short TTL in seconds (default: 300 = 5 minutes)
 * - CACHE_TTL_MEDIUM: Medium TTL in seconds (default: 3600 = 1 hour)
 * - CACHE_TTL_LONG: Long TTL in seconds (default: 86400 = 24 hours)
 */

export * from './types';
export * from './base-cache.service';
export * from './embedding-cache.service';
export * from './vector-search-cache.service';
export * from './llm-response-cache.service';
export * from './audio-chunk-cache.service';
export * from './cache-manager';

// Re-export for convenience
export { CacheManager } from './cache-manager';
export { EmbeddingCacheService } from './embedding-cache.service';
export { VectorSearchCacheService } from './vector-search-cache.service';
export { LLMResponseCacheService } from './llm-response-cache.service';
export { AudioChunkCacheService } from './audio-chunk-cache.service';
