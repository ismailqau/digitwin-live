import { AudioFeatureService } from '../services/audio-feature.service';
import { AudioChunk } from '../types';

describe('AudioFeatureService', () => {
  let service: AudioFeatureService;

  beforeEach(() => {
    service = new AudioFeatureService();
  });

  afterEach(() => {
    service.clearCache();
  });

  describe('extractFeatures', () => {
    it('should extract audio features from a valid audio chunk', async () => {
      const audioChunk = createTestAudioChunk(1600, 16000); // 100ms of audio

      const features = await service.extractFeatures(audioChunk);

      expect(features).toBeDefined();
      expect(features.melSpectrogram).toBeDefined();
      expect(features.melSpectrogram.length).toBeGreaterThan(0);
      expect(features.mfcc).toBeDefined();
      expect(features.mfcc.length).toBeGreaterThan(0);
      expect(features.energy).toBeGreaterThanOrEqual(0);
      expect(features.pitch).toBeGreaterThan(0);
      expect(features.timestamp).toBe(audioChunk.timestamp);
      expect(features.sampleRate).toBe(audioChunk.sampleRate);
    });

    it('should cache extracted features', async () => {
      const audioChunk = createTestAudioChunk(1600, 16000);

      // First extraction
      const features1 = await service.extractFeatures(audioChunk);

      // Second extraction should hit cache
      const features2 = await service.extractFeatures(audioChunk);

      expect(features1).toEqual(features2);

      const stats = service.getCacheStats();
      expect(stats.size).toBe(1);
    });

    it('should handle empty audio chunk', async () => {
      const audioChunk: AudioChunk = {
        data: Buffer.alloc(0),
        timestamp: 0,
        sequenceNumber: 0,
        sampleRate: 16000,
        channels: 1,
        format: 'pcm',
      };

      const features = await service.extractFeatures(audioChunk);

      expect(features.melSpectrogram.length).toBe(0);
      expect(features.mfcc.length).toBe(0);
    });

    it('should handle different sample rates', async () => {
      const audioChunk8k = createTestAudioChunk(800, 8000);
      const audioChunk16k = createTestAudioChunk(1600, 16000);
      const audioChunk22k = createTestAudioChunk(2205, 22050);

      const features8k = await service.extractFeatures(audioChunk8k);
      const features16k = await service.extractFeatures(audioChunk16k);
      const features22k = await service.extractFeatures(audioChunk22k);

      expect(features8k.sampleRate).toBe(8000);
      expect(features16k.sampleRate).toBe(16000);
      expect(features22k.sampleRate).toBe(22050);
    });
  });

  describe('extractStreamingFeatures', () => {
    it('should extract features from multiple chunks', async () => {
      const chunks = [
        createTestAudioChunk(1600, 16000, 0),
        createTestAudioChunk(1600, 16000, 100),
        createTestAudioChunk(1600, 16000, 200),
      ];

      const features = await service.extractStreamingFeatures(chunks);

      expect(features.length).toBe(3);
      expect(features[0].timestamp).toBe(0);
      expect(features[1].timestamp).toBe(100);
      expect(features[2].timestamp).toBe(200);
    });
  });

  describe('assessAudioQuality', () => {
    it('should assess quality of clean audio', () => {
      const audioChunk = createTestAudioChunk(1600, 16000, 0, 0.5);

      const quality = service.assessAudioQuality(audioChunk);

      expect(quality.snr).toBeGreaterThan(0);
      expect(quality.clarity).toBeGreaterThanOrEqual(0);
      expect(quality.clarity).toBeLessThanOrEqual(1);
      expect(quality.volume).toBeDefined();
      expect(typeof quality.hasClipping).toBe('boolean');
      expect(quality.silenceRatio).toBeGreaterThanOrEqual(0);
      expect(quality.silenceRatio).toBeLessThanOrEqual(1);
    });

    it('should detect clipping in loud audio', () => {
      // Create audio with clipping (values at max)
      const samples = 1600;
      const buffer = Buffer.alloc(samples * 2);
      for (let i = 0; i < samples; i++) {
        buffer.writeInt16LE(32767, i * 2); // Max value
      }

      const audioChunk: AudioChunk = {
        data: buffer,
        timestamp: 0,
        sequenceNumber: 0,
        sampleRate: 16000,
        channels: 1,
        format: 'pcm',
      };

      const quality = service.assessAudioQuality(audioChunk);

      expect(quality.hasClipping).toBe(true);
    });

    it('should detect high silence ratio in quiet audio', () => {
      // Create mostly silent audio
      const samples = 1600;
      const buffer = Buffer.alloc(samples * 2);
      // Leave buffer as zeros (silence)

      const audioChunk: AudioChunk = {
        data: buffer,
        timestamp: 0,
        sequenceNumber: 0,
        sampleRate: 16000,
        channels: 1,
        format: 'pcm',
      };

      const quality = service.assessAudioQuality(audioChunk);

      expect(quality.silenceRatio).toBe(1);
    });
  });

  describe('detectPhonemes', () => {
    it('should detect phonemes from audio features', async () => {
      const audioChunk = createTestAudioChunk(3200, 16000); // 200ms

      const features = await service.extractFeatures(audioChunk);
      const phonemes = service.detectPhonemes(features);

      expect(Array.isArray(phonemes)).toBe(true);
      // Phonemes should have required properties
      phonemes.forEach((p) => {
        expect(p.phoneme).toBeDefined();
        expect(p.startTime).toBeGreaterThanOrEqual(0);
        expect(p.endTime).toBeGreaterThan(p.startTime);
        expect(p.confidence).toBeGreaterThanOrEqual(0);
        expect(p.confidence).toBeLessThanOrEqual(1);
      });
    });
  });

  describe('preprocessForLipSync', () => {
    it('should preprocess audio for lip-sync', () => {
      const audioChunk = createTestAudioChunk(1600, 16000);

      const preprocessed = service.preprocessForLipSync(audioChunk);

      expect(preprocessed.sampleRate).toBe(16000);
      expect(preprocessed.channels).toBe(1);
      expect(preprocessed.format).toBe('pcm');
    });

    it('should resample audio to target sample rate', () => {
      const audioChunk = createTestAudioChunk(2205, 22050); // 100ms at 22050Hz

      const preprocessed = service.preprocessForLipSync(audioChunk, 16000);

      expect(preprocessed.sampleRate).toBe(16000);
      // Resampled data should be approximately 1600 samples (100ms at 16kHz)
      const expectedSamples = Math.floor((2205 / 22050) * 16000);
      const actualSamples = preprocessed.data.length / 2;
      expect(actualSamples).toBeCloseTo(expectedSamples, -1);
    });
  });

  describe('cache management', () => {
    it('should clear cache', async () => {
      const audioChunk = createTestAudioChunk(1600, 16000);
      await service.extractFeatures(audioChunk);

      expect(service.getCacheStats().size).toBe(1);

      service.clearCache();

      expect(service.getCacheStats().size).toBe(0);
    });

    it('should report cache statistics', async () => {
      const stats = service.getCacheStats();

      expect(stats).toHaveProperty('size');
      expect(stats).toHaveProperty('maxSize');
      expect(stats).toHaveProperty('hitRate');
    });
  });
});

// Helper function to create test audio chunks
function createTestAudioChunk(
  samples: number,
  sampleRate: number,
  timestamp = 0,
  amplitude = 0.3
): AudioChunk {
  const buffer = Buffer.alloc(samples * 2);

  // Generate a simple sine wave
  const frequency = 440; // A4 note
  for (let i = 0; i < samples; i++) {
    const t = i / sampleRate;
    const value = Math.sin(2 * Math.PI * frequency * t) * amplitude;
    buffer.writeInt16LE(Math.round(value * 32767), i * 2);
  }

  return {
    data: buffer,
    timestamp,
    sequenceNumber: Math.floor(timestamp / 100),
    sampleRate,
    channels: 1,
    format: 'pcm',
  };
}
