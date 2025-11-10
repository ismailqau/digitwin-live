/**
 * ASR Cache Service Tests
 * Tests for PostgreSQL-based caching of ASR results
 */

import { ASRCacheService } from '../cache';

describe('ASRCacheService', () => {
  let cacheService: ASRCacheService;

  beforeEach(() => {
    cacheService = new ASRCacheService();
  });

  describe('Cache Key Generation', () => {
    it('should generate consistent cache keys for same audio', () => {
      const audioData = Buffer.from('test audio data');
      const languageCode = 'en-US';

      const key1 = cacheService.generateCacheKey(audioData, languageCode);
      const key2 = cacheService.generateCacheKey(audioData, languageCode);

      expect(key1).toBe(key2);
      expect(key1).toContain('asr:');
      expect(key1).toContain(languageCode);
    });

    it('should generate different keys for different audio', () => {
      const audio1 = Buffer.from('test audio 1');
      const audio2 = Buffer.from('test audio 2');
      const languageCode = 'en-US';

      const key1 = cacheService.generateCacheKey(audio1, languageCode);
      const key2 = cacheService.generateCacheKey(audio2, languageCode);

      expect(key1).not.toBe(key2);
    });

    it('should generate different keys for different languages', () => {
      const audioData = Buffer.from('test audio');

      const key1 = cacheService.generateCacheKey(audioData, 'en-US');
      const key2 = cacheService.generateCacheKey(audioData, 'es-US');

      expect(key1).not.toBe(key2);
    });
  });

  describe('Cache Operations', () => {
    it('should store and retrieve cached transcript', async () => {
      const cacheKey = 'asr:en-US:test123';
      const transcript = 'Hello, this is a test transcript';
      const confidence = 0.95;
      const languageCode = 'en-US';
      const ttl = 3600;

      await cacheService.set(cacheKey, transcript, confidence, languageCode, ttl);

      const cached = await cacheService.get(cacheKey);

      expect(cached).toBeDefined();
      expect(cached?.transcript).toBe(transcript);
      expect(cached?.confidence).toBe(confidence);
      expect(cached?.languageCode).toBe(languageCode);
    });

    it('should return null for non-existent cache key', async () => {
      const cached = await cacheService.get('non-existent-key');
      expect(cached).toBeNull();
    });

    it('should not return expired cache entries', async () => {
      const cacheKey = 'asr:en-US:expired';
      const transcript = 'Expired transcript';
      const ttl = -1; // Already expired

      await cacheService.set(cacheKey, transcript, 0.9, 'en-US', ttl);

      const cached = await cacheService.get(cacheKey);
      expect(cached).toBeNull();
    });

    it('should delete cached entry', async () => {
      const cacheKey = 'asr:en-US:delete-test';
      await cacheService.set(cacheKey, 'Test', 0.9, 'en-US', 3600);

      let cached = await cacheService.get(cacheKey);
      expect(cached).toBeDefined();

      await cacheService.delete(cacheKey);

      cached = await cacheService.get(cacheKey);
      expect(cached).toBeNull();
    });
  });

  describe('Cache Cleanup', () => {
    it('should clean up expired entries', async () => {
      // Add some entries with short TTL
      await cacheService.set('asr:en-US:expire1', 'Test 1', 0.9, 'en-US', -1);
      await cacheService.set('asr:en-US:expire2', 'Test 2', 0.9, 'en-US', -1);
      await cacheService.set('asr:en-US:valid', 'Test 3', 0.9, 'en-US', 3600);

      await cacheService.cleanup();

      const expired1 = await cacheService.get('asr:en-US:expire1');
      const expired2 = await cacheService.get('asr:en-US:expire2');
      const valid = await cacheService.get('asr:en-US:valid');

      expect(expired1).toBeNull();
      expect(expired2).toBeNull();
      expect(valid).toBeDefined();
    });
  });

  describe('Cache Statistics', () => {
    it('should return cache statistics', () => {
      const stats = cacheService.getStats();

      expect(stats).toBeDefined();
      expect(stats.memoryCacheSize).toBeGreaterThanOrEqual(0);
      expect(stats.maxMemoryCacheSize).toBeGreaterThan(0);
    });
  });
});
