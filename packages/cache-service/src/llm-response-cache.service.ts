/**
 * LLM response cache service using PostgreSQL LLMResponseCache table
 * Caches LLM responses for FAQs and common queries
 */

import crypto from 'crypto';

import { config } from '@clone/config';
import { PrismaClient } from '@clone/database';

import { BaseCacheService } from './base-cache.service';
import { CacheOptions } from './types';

export interface LLMResponseCacheEntry {
  response: string;
  provider: string;
}

export interface LLMPrompt {
  prompt: string;
  context?: string;
  provider: string;
}

export class LLMResponseCacheService extends BaseCacheService<LLMResponseCacheEntry, LLMPrompt> {
  constructor(prisma: PrismaClient) {
    super(prisma, config.cache.ttlMedium); // 1 hour default
  }

  /**
   * Generate cache key from prompt and context
   */
  protected generateCacheKey(llmPrompt: LLMPrompt): string {
    const keyData = {
      prompt: llmPrompt.prompt.trim(),
      context: llmPrompt.context?.trim() || '',
      provider: llmPrompt.provider,
    };
    return crypto.createHash('sha256').update(JSON.stringify(keyData)).digest('hex');
  }

  /**
   * Get LLM response from cache
   */
  async get(llmPrompt: LLMPrompt, _options?: CacheOptions): Promise<LLMResponseCacheEntry | null> {
    if (!this.isCacheEnabled()) {
      return null;
    }

    try {
      const promptHash = this.generateCacheKey(llmPrompt);

      const cached = await this.prisma.lLMResponseCache.findFirst({
        where: { promptHash },
      });

      if (!cached) {
        this.logCacheMiss(promptHash);
        return null;
      }

      if (this.isExpired(cached.expiresAt)) {
        // Delete expired entry
        await this.prisma.lLMResponseCache.delete({
          where: { id: cached.id },
        });
        this.logCacheMiss(promptHash);
        return null;
      }

      // Increment hit count
      await this.prisma.lLMResponseCache.update({
        where: { id: cached.id },
        data: { hitCount: { increment: 1 } },
      });

      this.logCacheHit(promptHash);
      return {
        response: cached.response,
        provider: cached.provider,
      };
    } catch (error) {
      this.handleCacheError(error as Error, 'get');
      return null;
    }
  }

  /**
   * Set LLM response in cache
   */
  async set(
    llmPrompt: LLMPrompt,
    value: LLMResponseCacheEntry,
    options?: CacheOptions
  ): Promise<void> {
    if (!this.isCacheEnabled()) {
      return;
    }

    try {
      const promptHash = this.generateCacheKey(llmPrompt);
      const expiresAt = this.calculateExpiresAt(options?.ttl);

      await this.prisma.lLMResponseCache.create({
        data: {
          promptHash,
          response: value.response,
          provider: value.provider,
          expiresAt,
          hitCount: 0,
        },
      });

      this.logCacheSet(promptHash, options?.ttl || this.defaultTTL);
    } catch (error) {
      this.handleCacheError(error as Error, 'set');
    }
  }

  /**
   * Delete LLM response from cache
   */
  async delete(llmPrompt: LLMPrompt): Promise<void> {
    if (!this.isCacheEnabled()) {
      return;
    }

    try {
      const promptHash = this.generateCacheKey(llmPrompt);

      await this.prisma.lLMResponseCache.deleteMany({
        where: { promptHash },
      });

      this.logCacheDelete(promptHash);
    } catch (error) {
      this.handleCacheError(error as Error, 'delete');
    }
  }

  /**
   * Get most frequently cached responses (for analytics)
   */
  async getTopCachedResponses(
    limit: number = 10
  ): Promise<Array<{ promptHash: string; hitCount: number; provider: string }>> {
    if (!this.isCacheEnabled()) {
      return [];
    }

    try {
      const results = await this.prisma.lLMResponseCache.findMany({
        where: {
          expiresAt: {
            gt: new Date(),
          },
        },
        orderBy: {
          hitCount: 'desc',
        },
        take: limit,
        select: {
          promptHash: true,
          hitCount: true,
          provider: true,
        },
      });

      return results;
    } catch (error) {
      this.handleCacheError(error as Error, 'getTopCachedResponses');
      return [];
    }
  }

  /**
   * Clean up expired LLM responses
   */
  async cleanup(): Promise<number> {
    if (!this.isCacheEnabled()) {
      return 0;
    }

    try {
      const result = await this.prisma.lLMResponseCache.deleteMany({
        where: {
          expiresAt: {
            lt: new Date(),
          },
        },
      });

      return result.count;
    } catch (error) {
      this.handleCacheError(error as Error, 'cleanup');
      return 0;
    }
  }
}
