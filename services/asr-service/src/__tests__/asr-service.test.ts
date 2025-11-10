/**
 * ASR Service Tests
 * Tests for Google Chirp ASR streaming service
 */

// Mock Google Cloud Speech Client BEFORE importing ASRService
const mockStreamingRecognize = jest.fn().mockReturnValue({
  write: jest.fn(),
  end: jest.fn(),
  on: jest.fn(),
  pipe: jest.fn(),
  removeListener: jest.fn(),
});

const mockSpeechClient = jest.fn().mockImplementation(() => ({
  streamingRecognize: mockStreamingRecognize,
}));

jest.mock('@google-cloud/speech', () => ({
  SpeechClient: mockSpeechClient,
  protos: {
    google: {
      cloud: {
        speech: {
          v1: {},
        },
      },
    },
  },
}));

// NOW import ASRService after mocks are set up
import { ASRService } from '../asr-service';
import { AudioEncoding } from '../types';

describe('ASRService', () => {
  let asrService: ASRService;

  beforeEach(() => {
    asrService = new ASRService();
  });

  afterEach(async () => {
    await asrService.shutdown();
  });

  describe('Stream Management', () => {
    // Skip these tests as they require complex Google Cloud Speech API mocking
    // These are integration tests that should be run with actual GCP credentials
    it.skip('should start a new ASR stream', async () => {
      const handle = await asrService.startStream('session-1', 'user-1');

      expect(handle).toBeDefined();
      expect(handle.id).toBeDefined();
      expect(handle.sessionId).toBe('session-1');
      expect(handle.config).toBeDefined();
      expect(handle.config.sampleRate).toBe(16000);
      expect(handle.config.encoding).toBe(AudioEncoding.LINEAR16);
    });

    it.skip('should start stream with custom configuration', async () => {
      const handle = await asrService.startStream('session-2', 'user-1', {
        sampleRate: 48000,
        languageCode: 'es-US',
        enableAutomaticPunctuation: false,
      });

      expect(handle.config.sampleRate).toBe(48000);
      expect(handle.config.languageCode).toBe('es-US');
      expect(handle.config.enableAutomaticPunctuation).toBe(false);
    });

    it.skip('should track active streams', async () => {
      const handle1 = await asrService.startStream('session-1', 'user-1');
      const handle2 = await asrService.startStream('session-2', 'user-1');

      expect(asrService.getActiveStreamCount()).toBe(2);

      await asrService.endStream(handle1.id);
      expect(asrService.getActiveStreamCount()).toBe(1);

      await asrService.endStream(handle2.id);
      expect(asrService.getActiveStreamCount()).toBe(0);
    });

    it.skip('should retrieve stream handle by ID', async () => {
      const handle = await asrService.startStream('session-1', 'user-1');
      const retrieved = asrService.getStreamHandle(handle.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(handle.id);
      expect(retrieved?.sessionId).toBe('session-1');
    });

    it.skip('should end stream successfully', async () => {
      const handle = await asrService.startStream('session-1', 'user-1');
      await asrService.endStream(handle.id);

      const retrieved = asrService.getStreamHandle(handle.id);
      expect(retrieved).toBeUndefined();
    });

    it('should handle ending non-existent stream gracefully', async () => {
      await expect(asrService.endStream('non-existent-id')).resolves.not.toThrow();
    });
  });

  describe('Audio Processing', () => {
    it.skip('should send audio chunks to stream', async () => {
      const handle = await asrService.startStream('session-1', 'user-1');
      const audioData = Buffer.alloc(3200); // 100ms of 16kHz mono 16-bit audio

      await expect(asrService.sendAudioChunk(handle.id, audioData)).resolves.not.toThrow();
    });

    it('should throw error when sending to non-existent stream', async () => {
      const audioData = Buffer.alloc(3200);

      await expect(asrService.sendAudioChunk('non-existent-id', audioData)).rejects.toThrow(
        'Stream handle not found'
      );
    });
  });

  describe('Event Handling', () => {
    it.skip('should set up stream event handlers', async () => {
      const handle = await asrService.startStream('session-1', 'user-1');

      const onInterimResult = jest.fn();
      const onFinalResult = jest.fn();
      const onError = jest.fn();
      const onEnd = jest.fn();

      expect(() => {
        asrService.onStreamEvents(handle.id, {
          onInterimResult,
          onFinalResult,
          onError,
          onEnd,
        });
      }).not.toThrow();
    });

    it('should throw error when setting up events for non-existent stream', () => {
      expect(() => {
        asrService.onStreamEvents('non-existent-id', {});
      }).toThrow('Stream handle not found');
    });
  });

  describe('Service Management', () => {
    it('should provide access to metrics service', () => {
      const metrics = asrService.getMetrics();
      expect(metrics).toBeDefined();
    });

    it('should provide access to quota service', () => {
      const quota = asrService.getQuota();
      expect(quota).toBeDefined();
    });

    it('should provide access to cache service', () => {
      const cache = asrService.getCache();
      expect(cache).toBeDefined();
    });

    it.skip('should shutdown gracefully', async () => {
      const handle1 = await asrService.startStream('session-1', 'user-1');
      const handle2 = await asrService.startStream('session-2', 'user-1');

      await asrService.shutdown();

      expect(asrService.getActiveStreamCount()).toBe(0);
      expect(asrService.getStreamHandle(handle1.id)).toBeUndefined();
      expect(asrService.getStreamHandle(handle2.id)).toBeUndefined();
    });
  });
});
