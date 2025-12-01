/**
 * Cache types and interfaces for PostgreSQL-based caching
 */

export enum CacheType {
  EMBEDDING = 'embedding',
  VECTOR_SEARCH = 'vector_search',
  LLM_RESPONSE = 'llm_response',
  AUDIO_CHUNK = 'audio_chunk',
}

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  userId?: string; // For user-specific caching
}

export interface CacheEntry<T = unknown> {
  key: string;
  value: T;
  expiresAt: Date;
  createdAt: Date;
}

export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  totalEntries: number;
  expiredEntries: number;
}

export interface CleanupResult {
  deletedCount: number;
  cacheType: CacheType;
}
