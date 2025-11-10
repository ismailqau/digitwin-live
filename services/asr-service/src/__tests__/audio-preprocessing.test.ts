/**
 * Audio Preprocessing Service Tests
 * Tests for audio normalization, silence detection, quality assessment, etc.
 */

import { AudioPreprocessingService, AudioBuffer } from '../audio-preprocessing';

describe('AudioPreprocessingService', () => {
  let service: AudioPreprocessingService;

  beforeEach(() => {
    service = new AudioPreprocessingService();
  });

  // Helper to create test audio buffer
  const createTestAudio = (durationSeconds: number = 1): AudioBuffer => {
    const sampleRate = 16000;
    const channels = 1;
    const bitDepth = 16;
    const numSamples = sampleRate * durationSeconds * channels;
    const data = Buffer.alloc(numSamples * (bitDepth / 8));

    // Generate sine wave test signal
    for (let i = 0; i < numSamples; i++) {
      const sample = Math.sin((2 * Math.PI * 440 * i) / sampleRate) * 0.5; // 440Hz tone at 50% volume
      const intSample = Math.round(sample * 32767);
      data.writeInt16LE(intSample, i * 2);
    }

    return {
      data,
      sampleRate,
      channels,
      bitDepth,
      duration: durationSeconds,
    };
  };

  describe('Volume Normalization', () => {
    it('should normalize audio volume to target level', async () => {
      const audio = createTestAudio(1);
      const normalized = await service.normalizeVolume(audio, -20);

      expect(normalized).toBeDefined();
      expect(normalized.data.length).toBeGreaterThan(0);
      expect(normalized.sampleRate).toBe(audio.sampleRate);
    });

    it('should handle silent audio gracefully', async () => {
      const audio = createTestAudio(1);
      audio.data.fill(0); // Silent audio

      const normalized = await service.normalizeVolume(audio);
      expect(normalized).toBeDefined();
      expect(normalized.data).toEqual(audio.data);
    });

    it('should prevent clipping during normalization', async () => {
      const audio = createTestAudio(1);
      const normalized = await service.normalizeVolume(audio, 0); // Very high target

      expect(normalized).toBeDefined();
      // Verify no clipping by checking samples don't exceed max value
      const samples = new Int16Array(
        normalized.data.buffer,
        normalized.data.byteOffset,
        normalized.data.length / 2
      );
      const maxSample = Math.max(...Array.from(samples).map(Math.abs));
      expect(maxSample).toBeLessThanOrEqual(32767);
    });
  });

  describe('Silence Detection', () => {
    it('should detect silence segments', async () => {
      const audio = createTestAudio(2);

      // Add silence in the middle (0.5s to 1.0s)
      const silenceStart = Math.floor(0.5 * audio.sampleRate);
      const silenceEnd = Math.floor(1.0 * audio.sampleRate);
      for (let i = silenceStart; i < silenceEnd; i++) {
        audio.data.writeInt16LE(0, i * 2);
      }

      const segments = await service.detectSilence(audio, -40, 0.3);

      expect(segments).toBeDefined();
      expect(Array.isArray(segments)).toBe(true);
      expect(segments.length).toBeGreaterThan(0);

      if (segments.length > 0) {
        expect(segments[0].startTime).toBeGreaterThanOrEqual(0);
        expect(segments[0].endTime).toBeGreaterThan(segments[0].startTime);
        expect(segments[0].duration).toBeGreaterThan(0);
      }
    });

    it('should not detect silence in continuous audio', async () => {
      const audio = createTestAudio(1);
      const segments = await service.detectSilence(audio, -40, 0.5);

      expect(segments).toBeDefined();
      expect(segments.length).toBe(0);
    });
  });

  describe('Silence Trimming', () => {
    it('should trim silence from audio', async () => {
      const audio = createTestAudio(2);

      // Add silence at start and end
      for (let i = 0; i < audio.sampleRate * 0.5; i++) {
        audio.data.writeInt16LE(0, i * 2);
      }
      const endStart = Math.floor(audio.sampleRate * 1.5);
      for (let i = endStart; i < audio.sampleRate * 2; i++) {
        audio.data.writeInt16LE(0, i * 2);
      }

      const trimmed = await service.trimSilence(audio);

      expect(trimmed).toBeDefined();
      expect(trimmed.duration).toBeLessThan(audio.duration);
    });

    it('should not modify audio without silence', async () => {
      const audio = createTestAudio(1);
      const trimmed = await service.trimSilence(audio);

      expect(trimmed.duration).toBeCloseTo(audio.duration, 1);
    });
  });

  describe('Quality Assessment', () => {
    it('should assess audio quality', async () => {
      const audio = createTestAudio(1);
      const quality = await service.assessQuality(audio);

      expect(quality).toBeDefined();
      expect(quality.snr).toBeGreaterThanOrEqual(0);
      expect(quality.clarityScore).toBeGreaterThanOrEqual(0);
      expect(quality.clarityScore).toBeLessThanOrEqual(100);
      expect(quality.volumeLevel).toBeDefined();
      expect(typeof quality.clippingDetected).toBe('boolean');
      expect(quality.silenceRatio).toBeGreaterThanOrEqual(0);
      expect(typeof quality.isAcceptable).toBe('boolean');
      expect(Array.isArray(quality.recommendations)).toBe(true);
    });

    it('should detect clipping in audio', async () => {
      const audio = createTestAudio(1);

      // Create clipped audio
      for (let i = 0; i < audio.data.length / 2; i++) {
        audio.data.writeInt16LE(32767, i * 2); // Max value
      }

      const quality = await service.assessQuality(audio);
      expect(quality.clippingDetected).toBe(true);
      expect(quality.isAcceptable).toBe(false);
    });

    it('should detect low volume audio', async () => {
      const audio = createTestAudio(1);

      // Create very quiet audio
      for (let i = 0; i < audio.data.length / 2; i++) {
        const sample = Math.sin((2 * Math.PI * 440 * i) / audio.sampleRate) * 0.01; // 1% volume
        const intSample = Math.round(sample * 32767);
        audio.data.writeInt16LE(intSample, i * 2);
      }

      const quality = await service.assessQuality(audio);
      expect(quality.volumeLevel).toBeLessThan(-30);
      expect(quality.recommendations.length).toBeGreaterThan(0);
    });
  });

  describe('Echo Cancellation', () => {
    it('should apply echo cancellation', async () => {
      const audio = createTestAudio(1);
      const processed = await service.cancelEcho(audio);

      expect(processed).toBeDefined();
      expect(processed.data.length).toBe(audio.data.length);
      expect(processed.sampleRate).toBe(audio.sampleRate);
    });
  });

  describe('Format Conversion', () => {
    it('should convert sample rate', async () => {
      const audio = createTestAudio(1);
      const converted = await service.convertFormat(audio, {
        targetSampleRate: 48000,
      });

      expect(converted.sampleRate).toBe(48000);
      expect(converted.channels).toBe(audio.channels);
      expect(converted.bitDepth).toBe(audio.bitDepth);
    });

    it('should convert channels (mono to stereo)', async () => {
      const audio = createTestAudio(1);
      const converted = await service.convertFormat(audio, {
        targetChannels: 2,
      });

      expect(converted.channels).toBe(2);
      expect(converted.data.length).toBeGreaterThan(audio.data.length);
    });

    it('should convert bit depth', async () => {
      const audio = createTestAudio(1);
      const converted = await service.convertFormat(audio, {
        targetBitDepth: 24,
      });

      expect(converted.bitDepth).toBe(24);
      expect(converted.data.length).toBeGreaterThan(audio.data.length);
    });

    it('should handle multiple conversions', async () => {
      const audio = createTestAudio(1);
      const converted = await service.convertFormat(audio, {
        targetSampleRate: 48000,
        targetChannels: 2,
        targetBitDepth: 24,
      });

      expect(converted.sampleRate).toBe(48000);
      expect(converted.channels).toBe(2);
      expect(converted.bitDepth).toBe(24);
    });
  });

  describe('Audio Compression', () => {
    it('should compress audio', async () => {
      const audio = createTestAudio(1);
      const compressed = await service.compressAudio(audio, 50);

      expect(compressed).toBeDefined();
      expect(compressed.length).toBeLessThanOrEqual(audio.data.length);
    });

    it('should compress with different quality levels', async () => {
      const audio = createTestAudio(1);
      const lowQuality = await service.compressAudio(audio, 30);
      const highQuality = await service.compressAudio(audio, 90);

      expect(lowQuality.length).toBeLessThan(highQuality.length);
    });
  });

  describe('Metadata Extraction', () => {
    it('should extract metadata from WAV file', async () => {
      // Create a simple WAV header
      const audio = createTestAudio(1);
      const wavHeader = Buffer.alloc(44);

      // RIFF header
      wavHeader.write('RIFF', 0);
      wavHeader.writeUInt32LE(audio.data.length + 36, 4);
      wavHeader.write('WAVE', 8);

      // fmt chunk
      wavHeader.write('fmt ', 12);
      wavHeader.writeUInt32LE(16, 16); // chunk size
      wavHeader.writeUInt16LE(1, 20); // audio format (PCM)
      wavHeader.writeUInt16LE(audio.channels, 22);
      wavHeader.writeUInt32LE(audio.sampleRate, 24);
      wavHeader.writeUInt32LE(audio.sampleRate * audio.channels * (audio.bitDepth / 8), 28); // byte rate
      wavHeader.writeUInt16LE(audio.channels * (audio.bitDepth / 8), 32); // block align
      wavHeader.writeUInt16LE(audio.bitDepth, 34);

      // data chunk
      wavHeader.write('data', 36);
      wavHeader.writeUInt32LE(audio.data.length, 40);

      const wavFile = Buffer.concat([wavHeader, audio.data]);

      const metadata = await service.extractMetadata(wavFile);

      expect(metadata).toBeDefined();
      expect(metadata.sampleRate).toBe(audio.sampleRate);
      expect(metadata.channels).toBe(audio.channels);
      expect(metadata.bitDepth).toBe(audio.bitDepth);
      expect(metadata.format).toBe('WAV');
      expect(metadata.duration).toBeGreaterThan(0);
    });
  });

  describe('Audio Validation', () => {
    it('should validate correct audio file', async () => {
      const audio = createTestAudio(1);
      const wavHeader = Buffer.alloc(44);

      // Create valid WAV header
      wavHeader.write('RIFF', 0);
      wavHeader.writeUInt32LE(audio.data.length + 36, 4);
      wavHeader.write('WAVE', 8);
      wavHeader.write('fmt ', 12);
      wavHeader.writeUInt32LE(16, 16);
      wavHeader.writeUInt16LE(1, 20);
      wavHeader.writeUInt16LE(audio.channels, 22);
      wavHeader.writeUInt32LE(audio.sampleRate, 24);
      wavHeader.writeUInt32LE(audio.sampleRate * audio.channels * (audio.bitDepth / 8), 28);
      wavHeader.writeUInt16LE(audio.channels * (audio.bitDepth / 8), 32);
      wavHeader.writeUInt16LE(audio.bitDepth, 34);
      wavHeader.write('data', 36);
      wavHeader.writeUInt32LE(audio.data.length, 40);

      const wavFile = Buffer.concat([wavHeader, audio.data]);

      const validation = await service.validateAudio(wavFile);

      expect(validation).toBeDefined();
      expect(validation.isValid).toBe(true);
      expect(validation.errors.length).toBe(0);
    });

    it('should detect invalid audio file', async () => {
      const invalidData = Buffer.from('not a valid audio file');
      const validation = await service.validateAudio(invalidData);

      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Full Processing Pipeline', () => {
    it('should process audio through full pipeline', async () => {
      const audio = createTestAudio(2);
      const processed = await service.processAudio(audio);

      expect(processed).toBeDefined();
      expect(processed.sampleRate).toBe(16000);
      expect(processed.channels).toBe(1);
      expect(processed.bitDepth).toBe(16);
    });

    it('should process with custom configuration', async () => {
      const audio = createTestAudio(1);
      const processed = await service.processAudio(audio, {
        targetSampleRate: 48000,
        normalizeVolume: true,
        removeSilence: false,
      });

      expect(processed.sampleRate).toBe(48000);
    });
  });
});
