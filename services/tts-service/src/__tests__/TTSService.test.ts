import { TTSProvider } from '@clone/shared-types';
import winston from 'winston';

import { TTSService } from '../services/TTSService';

describe('TTSService', () => {
  let ttsService: TTSService;
  let mockLogger: winston.Logger;

  beforeEach(() => {
    // Create a mock logger
    mockLogger = winston.createLogger({
      level: 'error',
      format: winston.format.json(),
      transports: [new winston.transports.Console({ silent: true })],
    });

    ttsService = new TTSService(mockLogger);
  });

  describe('initialization', () => {
    it('should initialize with all providers', () => {
      expect(ttsService).toBeDefined();
    });

    it('should have health check method', async () => {
      const health = await ttsService.healthCheck();
      expect(health).toBeDefined();
      expect(typeof health).toBe('object');
    });
  });

  describe('provider management', () => {
    it('should get available voices', async () => {
      const voices = await ttsService.getAvailableVoices();
      expect(voices).toBeDefined();
      expect(typeof voices).toBe('object');
    });

    it('should estimate costs', async () => {
      const costs = await ttsService.estimateCost('Hello world');
      expect(costs).toBeDefined();
      expect(typeof costs).toBe('object');
    });

    it('should get provider metrics', async () => {
      const metrics = await ttsService.getProviderMetrics();
      expect(metrics).toBeDefined();
      expect(typeof metrics).toBe('object');
    });
  });

  describe('synthesis', () => {
    it('should handle synthesis request without providers initialized', async () => {
      const request = {
        text: 'Hello world',
        provider: TTSProvider.OPENAI_TTS,
      };

      await expect(ttsService.synthesize(request)).rejects.toThrow();
    });

    it('should handle stream synthesis request without providers initialized', async () => {
      const request = {
        text: 'Hello world',
        provider: TTSProvider.OPENAI_TTS,
      };

      const generator = ttsService.synthesizeStream(request);
      await expect(generator.next()).rejects.toThrow();
    });
  });
});
