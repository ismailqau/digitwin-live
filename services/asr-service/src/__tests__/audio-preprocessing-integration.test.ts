/**
 * Audio Preprocessing Integration Tests
 * Tests for audio preprocessing pipeline functionality
 */

import { AudioPreprocessingService, type AudioBuffer } from '../audio-preprocessing';

describe('AudioPreprocessingService - Integration Tests', () => {
  let service: AudioPreprocessingService;

  beforeEach(() => {
    service = new AudioPreprocessingService();
  });

  describe('Audio Format Validation', () => {
    it('should validate correct WAV file format', async () => {
      const wavHeader = createWavHeader(16000, 1, 16, 16000); // 1 second of audio
      const audioData = Buffer.concat([wavHeader, Buffer.alloc(32000)]);

      const result = await service.validateAudio(audioData);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect invalid file size', async () => {
      const tooSmall = Buffer.alloc(20);

      const result = await service.validateAudio(tooSmall);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should detect invalid sample rate', async () => {
      const wavHeader = createWavHeader(100000, 1, 16, 16000); // Invalid sample rate
      const audioData = Buffer.concat([wavHeader, Buffer.alloc(32000)]);

      const result = await service.validateAudio(audioData);

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('sample rate'))).toBe(true);
    });
  });

  describe('Metadata Extraction', () => {
    it('should extract metadata from WAV file', async () => {
      const wavHeader = createWavHeader(16000, 1, 16, 32000); // 1 second
      const audioData = Buffer.concat([wavHeader, Buffer.alloc(32000)]);

      const metadata = await service.extractMetadata(audioData);

      expect(metadata.sampleRate).toBe(16000);
      expect(metadata.channels).toBe(1);
      expect(metadata.bitDepth).toBe(16);
      expect(metadata.format).toBe('WAV');
      expect(metadata.codec).toBe('PCM');
      expect(metadata.duration).toBeCloseTo(1.0, 1);
    });

    it('should handle stereo audio metadata', async () => {
      const wavHeader = createWavHeader(44100, 2, 16, 176400); // 1 second stereo
      const audioData = Buffer.concat([wavHeader, Buffer.alloc(176400)]);

      const metadata = await service.extractMetadata(audioData);

      expect(metadata.channels).toBe(2);
      expect(metadata.sampleRate).toBe(44100);
    });
  });

  describe('Volume Normalization', () => {
    it('should normalize audio volume', async () => {
      const audio = createTestAudioBuffer(16000, 1, 16, 1.0);

      const normalized = await service.normalizeVolume(audio, -20);

      expect(normalized.data).toBeDefined();
      expect(normalized.sampleRate).toBe(audio.sampleRate);
      expect(normalized.channels).toBe(audio.channels);
    });

    it('should handle silent audio', async () => {
      const audio: AudioBuffer = {
        data: Buffer.alloc(32000), // All zeros (silence)
        sampleRate: 16000,
        channels: 1,
        bitDepth: 16,
        duration: 1.0,
      };

      const normalized = await service.normalizeVolume(audio);

      expect(normalized.data).toBeDefined();
    });
  });

  describe('Silence Detection', () => {
    it('should detect silence segments', async () => {
      const audio = createTestAudioBuffer(16000, 1, 16, 2.0);

      const segments = await service.detectSilence(audio, -40, 0.5);

      expect(Array.isArray(segments)).toBe(true);
      segments.forEach((segment) => {
        expect(segment.startTime).toBeGreaterThanOrEqual(0);
        expect(segment.endTime).toBeGreaterThan(segment.startTime);
        expect(segment.duration).toBeGreaterThan(0);
      });
    });

    it('should respect minimum silence duration', async () => {
      const audio = createTestAudioBuffer(16000, 1, 16, 1.0);

      const segments = await service.detectSilence(audio, -40, 0.5);

      segments.forEach((segment) => {
        expect(segment.duration).toBeGreaterThanOrEqual(0.5);
      });
    });
  });

  describe('Silence Trimming', () => {
    it('should trim silence from audio', async () => {
      const audio = createTestAudioBuffer(16000, 1, 16, 2.0);

      const trimmed = await service.trimSilence(audio);

      expect(trimmed.data).toBeDefined();
      expect(trimmed.duration).toBeLessThanOrEqual(audio.duration);
    });
  });

  describe('Quality Assessment', () => {
    it('should assess audio quality', async () => {
      const audio = createTestAudioBuffer(16000, 1, 16, 1.0);

      const quality = await service.assessQuality(audio);

      expect(quality.snr).toBeGreaterThanOrEqual(0);
      expect(quality.clarityScore).toBeGreaterThanOrEqual(0);
      expect(quality.clarityScore).toBeLessThanOrEqual(100);
      expect(quality.volumeLevel).toBeDefined();
      expect(typeof quality.clippingDetected).toBe('boolean');
      expect(quality.silenceRatio).toBeGreaterThanOrEqual(0);
      expect(quality.silenceRatio).toBeLessThanOrEqual(100);
      expect(typeof quality.isAcceptable).toBe('boolean');
      expect(Array.isArray(quality.recommendations)).toBe(true);
    });

    it('should detect clipping in audio', async () => {
      const audio = createClippedAudioBuffer(16000, 1, 16, 1.0);

      const quality = await service.assessQuality(audio);

      expect(quality.clippingDetected).toBe(true);
      expect(quality.recommendations.some((r) => r.includes('clipping'))).toBe(true);
    });
  });

  describe('Echo Cancellation', () => {
    it('should apply echo cancellation', async () => {
      const audio = createTestAudioBuffer(16000, 1, 16, 1.0);

      const processed = await service.cancelEcho(audio);

      expect(processed.data).toBeDefined();
      expect(processed.sampleRate).toBe(audio.sampleRate);
      expect(processed.channels).toBe(audio.channels);
    });
  });

  describe('Format Conversion', () => {
    it('should convert sample rate', async () => {
      const audio = createTestAudioBuffer(44100, 1, 16, 1.0);

      const converted = await service.convertFormat(audio, { targetSampleRate: 16000 });

      expect(converted.sampleRate).toBe(16000);
      expect(converted.channels).toBe(audio.channels);
    });

    it('should convert channels (stereo to mono)', async () => {
      const audio = createTestAudioBuffer(16000, 2, 16, 1.0);

      const converted = await service.convertFormat(audio, { targetChannels: 1 });

      expect(converted.channels).toBe(1);
      expect(converted.sampleRate).toBe(audio.sampleRate);
    });

    it('should convert bit depth', async () => {
      const audio = createTestAudioBuffer(16000, 1, 16, 1.0);

      const converted = await service.convertFormat(audio, { targetBitDepth: 16 });

      expect(converted.bitDepth).toBe(16);
    });

    it('should convert multiple parameters at once', async () => {
      const audio = createTestAudioBuffer(44100, 2, 16, 1.0);

      const converted = await service.convertFormat(audio, {
        targetSampleRate: 16000,
        targetChannels: 1,
      });

      expect(converted.sampleRate).toBe(16000);
      expect(converted.channels).toBe(1);
    });
  });

  describe('Audio Compression', () => {
    it('should compress audio', async () => {
      const audio = createTestAudioBuffer(16000, 1, 16, 1.0);

      const compressed = await service.compressAudio(audio, 80);

      expect(compressed).toBeDefined();
      expect(compressed.length).toBeLessThanOrEqual(audio.data.length);
    });

    it('should respect compression quality', async () => {
      const audio = createTestAudioBuffer(16000, 1, 16, 1.0);

      const highQuality = await service.compressAudio(audio, 90);
      const lowQuality = await service.compressAudio(audio, 50);

      expect(highQuality.length).toBeGreaterThanOrEqual(lowQuality.length);
    });
  });

  describe('Full Processing Pipeline', () => {
    it('should process audio through full pipeline', async () => {
      const audio = createTestAudioBuffer(44100, 2, 16, 2.0);

      const processed = await service.processAudio(audio, {
        targetSampleRate: 16000,
        targetChannels: 1,
        normalizeVolume: true,
        enableEchoCancellation: true,
        removeSilence: false,
      });

      expect(processed.sampleRate).toBe(16000);
      expect(processed.channels).toBe(1);
      expect(processed.data).toBeDefined();
    });

    it('should handle pipeline with silence removal', async () => {
      const audio = createTestAudioBuffer(16000, 1, 16, 2.0);

      const processed = await service.processAudio(audio, {
        removeSilence: true,
      });

      expect(processed.duration).toBeLessThanOrEqual(audio.duration);
    });
  });
});

// ========== Helper Functions ==========

/**
 * Create a WAV file header
 */
function createWavHeader(
  sampleRate: number,
  channels: number,
  bitDepth: number,
  dataSize: number
): Buffer {
  const header = Buffer.alloc(44);

  // RIFF header
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write('WAVE', 8);

  // fmt chunk
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16); // fmt chunk size
  header.writeUInt16LE(1, 20); // audio format (PCM)
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * channels * (bitDepth / 8), 28); // byte rate
  header.writeUInt16LE(channels * (bitDepth / 8), 32); // block align
  header.writeUInt16LE(bitDepth, 34);

  // data chunk
  header.write('data', 36);
  header.writeUInt32LE(dataSize, 40);

  return header;
}

/**
 * Create a test audio buffer with sine wave
 */
function createTestAudioBuffer(
  sampleRate: number,
  channels: number,
  bitDepth: number,
  duration: number
): AudioBuffer {
  const numSamples = Math.floor(sampleRate * duration * channels);
  const bytesPerSample = bitDepth / 8;
  const data = Buffer.alloc(numSamples * bytesPerSample);

  // Generate sine wave
  const frequency = 440; // A4 note
  const maxValue = Math.pow(2, bitDepth - 1) - 1;

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const sample = Math.sin(2 * Math.PI * frequency * t) * 0.5; // 50% amplitude
    const intSample = Math.round(sample * maxValue);

    if (bitDepth === 16) {
      data.writeInt16LE(intSample, i * 2);
    } else if (bitDepth === 24) {
      data.writeUInt8(intSample & 0xff, i * 3);
      data.writeUInt8((intSample >> 8) & 0xff, i * 3 + 1);
      data.writeInt8((intSample >> 16) & 0xff, i * 3 + 2);
    }
  }

  return {
    data,
    sampleRate,
    channels,
    bitDepth,
    duration,
  };
}

/**
 * Create audio buffer with clipping
 */
function createClippedAudioBuffer(
  sampleRate: number,
  channels: number,
  bitDepth: number,
  duration: number
): AudioBuffer {
  const numSamples = Math.floor(sampleRate * duration * channels);
  const bytesPerSample = bitDepth / 8;
  const data = Buffer.alloc(numSamples * bytesPerSample);

  const maxValue = Math.pow(2, bitDepth - 1) - 1;

  // Generate clipped sine wave (amplitude > 1.0)
  const frequency = 440;

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const sample = Math.sin(2 * Math.PI * frequency * t) * 1.5; // 150% amplitude (clipped)
    const clampedSample = Math.max(-1, Math.min(1, sample));
    const intSample = Math.round(clampedSample * maxValue);

    if (bitDepth === 16) {
      data.writeInt16LE(intSample, i * 2);
    }
  }

  return {
    data,
    sampleRate,
    channels,
    bitDepth,
    duration,
  };
}
