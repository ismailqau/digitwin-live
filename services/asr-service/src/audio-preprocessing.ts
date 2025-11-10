/**
 * Audio Preprocessing and Enhancement Service
 *
 * Provides audio normalization, silence detection, quality assessment,
 * echo cancellation, format conversion, compression, metadata extraction,
 * and validation for ASR processing.
 */

import { createLogger } from '@clone/logger';
import { AudioProcessingError } from '@clone/service-errors';

const logger = createLogger('audio-preprocessing');

/**
 * Helper to convert unknown error to Error type
 */
function toError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }
  return new Error(String(error));
}

/**
 * Audio buffer interface for processing
 */
export interface AudioBuffer {
  data: Buffer;
  sampleRate: number;
  channels: number;
  bitDepth: number;
  duration: number;
}

/**
 * Audio quality metrics
 */
export interface AudioQualityMetrics {
  snr: number; // Signal-to-Noise Ratio in dB
  clarityScore: number; // 0-100
  volumeLevel: number; // RMS level in dB
  clippingDetected: boolean;
  silenceRatio: number; // Percentage of silence
  isAcceptable: boolean;
  recommendations: string[];
}

/**
 * Audio metadata
 */
export interface AudioMetadata {
  duration: number; // in seconds
  sampleRate: number;
  channels: number;
  bitDepth: number;
  format: string;
  fileSize: number;
  codec?: string;
}

/**
 * Silence detection result
 */
export interface SilenceSegment {
  startTime: number;
  endTime: number;
  duration: number;
}

/**
 * Audio preprocessing configuration
 */
export interface PreprocessingConfig {
  targetSampleRate?: number;
  targetChannels?: number;
  targetBitDepth?: number;
  normalizeVolume?: boolean;
  targetVolumeDb?: number;
  removeSilence?: boolean;
  silenceThresholdDb?: number;
  minSilenceDuration?: number;
  enableEchoCancellation?: boolean;
  enableNoiseReduction?: boolean;
  compressionQuality?: number; // 0-100
}

/**
 * Default preprocessing configuration
 */
const DEFAULT_CONFIG: Required<PreprocessingConfig> = {
  targetSampleRate: 16000, // Optimal for ASR
  targetChannels: 1, // Mono
  targetBitDepth: 16,
  normalizeVolume: true,
  targetVolumeDb: -20, // Target RMS level
  removeSilence: false, // Keep silence for natural speech
  silenceThresholdDb: -40,
  minSilenceDuration: 0.5, // seconds
  enableEchoCancellation: true,
  enableNoiseReduction: true,
  compressionQuality: 80,
};

/**
 * Audio Preprocessing Service
 */
export class AudioPreprocessingService {
  private config: Required<PreprocessingConfig>;

  constructor(config: PreprocessingConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    logger.info('AudioPreprocessingService initialized', { config: this.config });
  }

  /**
   * Normalize audio volume to target level
   */
  async normalizeVolume(
    audio: AudioBuffer,
    targetDb: number = this.config.targetVolumeDb
  ): Promise<AudioBuffer> {
    try {
      logger.debug('Normalizing audio volume', { targetDb });

      const samples = this.bufferToSamples(audio.data, audio.bitDepth);
      const currentRms = this.calculateRMS(samples);
      const currentDb = 20 * Math.log10(currentRms);

      if (currentDb === -Infinity) {
        logger.warn('Audio is silent, skipping normalization');
        return audio;
      }

      const gainDb = targetDb - currentDb;
      const gain = Math.pow(10, gainDb / 20);

      logger.debug('Applying gain', { currentDb, targetDb, gainDb, gain });

      const normalizedSamples = samples.map((sample) => {
        const normalized = sample * gain;
        // Prevent clipping
        return Math.max(-1, Math.min(1, normalized));
      });

      const normalizedData = this.samplesToBuffer(normalizedSamples, audio.bitDepth);

      return {
        ...audio,
        data: normalizedData,
      };
    } catch (error) {
      logger.error('Error normalizing audio volume', { error });
      throw new AudioProcessingError('Failed to normalize audio volume', { cause: toError(error) });
    }
  }

  /**
   * Detect silence segments in audio
   */
  async detectSilence(
    audio: AudioBuffer,
    thresholdDb: number = this.config.silenceThresholdDb,
    minDuration: number = this.config.minSilenceDuration
  ): Promise<SilenceSegment[]> {
    try {
      logger.debug('Detecting silence', { thresholdDb, minDuration });

      const samples = this.bufferToSamples(audio.data, audio.bitDepth);
      const windowSize = Math.floor(audio.sampleRate * 0.02); // 20ms windows
      const minSilenceSamples = Math.floor(audio.sampleRate * minDuration);
      const threshold = Math.pow(10, thresholdDb / 20);

      const silenceSegments: SilenceSegment[] = [];
      let silenceStart: number | null = null;
      let silenceSampleCount = 0;

      for (let i = 0; i < samples.length; i += windowSize) {
        const window = samples.slice(i, i + windowSize);
        const rms = this.calculateRMS(window);

        if (rms < threshold) {
          if (silenceStart === null) {
            silenceStart = i / audio.sampleRate;
          }
          silenceSampleCount += windowSize;
        } else {
          if (silenceStart !== null && silenceSampleCount >= minSilenceSamples) {
            const endTime = i / audio.sampleRate;
            silenceSegments.push({
              startTime: silenceStart,
              endTime,
              duration: endTime - silenceStart,
            });
          }
          silenceStart = null;
          silenceSampleCount = 0;
        }
      }

      // Handle silence at the end
      if (silenceStart !== null && silenceSampleCount >= minSilenceSamples) {
        const endTime = samples.length / audio.sampleRate;
        silenceSegments.push({
          startTime: silenceStart,
          endTime,
          duration: endTime - silenceStart,
        });
      }

      logger.debug('Silence detection complete', { segmentCount: silenceSegments.length });
      return silenceSegments;
    } catch (error) {
      logger.error('Error detecting silence', { error });
      throw new AudioProcessingError('Failed to detect silence', { cause: toError(error) });
    }
  }

  /**
   * Trim silence from beginning and end of audio
   */
  async trimSilence(audio: AudioBuffer): Promise<AudioBuffer> {
    try {
      logger.debug('Trimming silence from audio');

      const silenceSegments = await this.detectSilence(audio);

      if (silenceSegments.length === 0) {
        return audio;
      }

      const samples = this.bufferToSamples(audio.data, audio.bitDepth);

      // Find first non-silence
      let startSample = 0;
      if (silenceSegments[0].startTime === 0) {
        startSample = Math.floor(silenceSegments[0].endTime * audio.sampleRate);
      }

      // Find last non-silence
      let endSample = samples.length;
      const lastSegment = silenceSegments[silenceSegments.length - 1];
      if (lastSegment.endTime >= audio.duration - 0.1) {
        endSample = Math.floor(lastSegment.startTime * audio.sampleRate);
      }

      const trimmedSamples = samples.slice(startSample, endSample);
      const trimmedData = this.samplesToBuffer(trimmedSamples, audio.bitDepth);

      logger.debug('Silence trimmed', {
        originalDuration: audio.duration,
        trimmedDuration: trimmedSamples.length / audio.sampleRate,
      });

      return {
        ...audio,
        data: trimmedData,
        duration: trimmedSamples.length / audio.sampleRate,
      };
    } catch (error) {
      logger.error('Error trimming silence', { error });
      throw new AudioProcessingError('Failed to trim silence', { cause: toError(error) });
    }
  }

  /**
   * Assess audio quality
   */
  async assessQuality(audio: AudioBuffer): Promise<AudioQualityMetrics> {
    try {
      logger.debug('Assessing audio quality');

      const samples = this.bufferToSamples(audio.data, audio.bitDepth);

      // Calculate SNR (simplified estimation)
      const snr = this.estimateSNR(samples);

      // Calculate volume level
      const rms = this.calculateRMS(samples);
      const volumeLevel = 20 * Math.log10(rms);

      // Detect clipping
      const clippingDetected = this.detectClipping(samples);

      // Calculate silence ratio
      const silenceSegments = await this.detectSilence(audio);
      const totalSilence = silenceSegments.reduce((sum, seg) => sum + seg.duration, 0);
      const silenceRatio = (totalSilence / audio.duration) * 100;

      // Calculate clarity score (0-100)
      const clarityScore = this.calculateClarityScore(
        snr,
        volumeLevel,
        clippingDetected,
        silenceRatio
      );

      // Determine if quality is acceptable
      const isAcceptable = snr > 20 && !clippingDetected && volumeLevel > -40 && volumeLevel < -10;

      // Generate recommendations
      const recommendations: string[] = [];
      if (snr < 20) {
        recommendations.push('High background noise detected. Record in a quieter environment.');
      }
      if (clippingDetected) {
        recommendations.push(
          'Audio clipping detected. Reduce microphone gain or speak further from mic.'
        );
      }
      if (volumeLevel < -40) {
        recommendations.push('Audio level too low. Speak louder or move closer to microphone.');
      }
      if (volumeLevel > -10) {
        recommendations.push(
          'Audio level too high. Reduce microphone gain or speak further from mic.'
        );
      }
      if (silenceRatio > 50) {
        recommendations.push('High silence ratio. Ensure continuous speech for better results.');
      }

      const metrics: AudioQualityMetrics = {
        snr,
        clarityScore,
        volumeLevel,
        clippingDetected,
        silenceRatio,
        isAcceptable,
        recommendations,
      };

      logger.debug('Quality assessment complete', metrics);
      return metrics;
    } catch (error) {
      logger.error('Error assessing audio quality', { error });
      throw new AudioProcessingError('Failed to assess audio quality', { cause: toError(error) });
    }
  }

  /**
   * Apply echo cancellation (simplified implementation)
   */
  async cancelEcho(audio: AudioBuffer): Promise<AudioBuffer> {
    try {
      logger.debug('Applying echo cancellation');

      const samples = this.bufferToSamples(audio.data, audio.bitDepth);

      // Simplified echo cancellation using adaptive filtering
      // In production, use a proper library like WebRTC's echo cancellation
      const delayMs = 50; // Typical echo delay
      const delaySamples = Math.floor((delayMs / 1000) * audio.sampleRate);
      const attenuation = 0.3; // Echo attenuation factor

      const processed = new Float32Array(samples.length);

      for (let i = 0; i < samples.length; i++) {
        processed[i] = samples[i];

        // Subtract attenuated delayed signal (simplified echo model)
        if (i >= delaySamples) {
          processed[i] -= samples[i - delaySamples] * attenuation;
        }
      }

      const processedData = this.samplesToBuffer(Array.from(processed), audio.bitDepth);

      logger.debug('Echo cancellation applied');
      return {
        ...audio,
        data: processedData,
      };
    } catch (error) {
      logger.error('Error applying echo cancellation', { error });
      throw new AudioProcessingError('Failed to apply echo cancellation', {
        cause: toError(error),
      });
    }
  }

  /**
   * Convert audio format (sample rate, channels, bit depth)
   */
  async convertFormat(
    audio: AudioBuffer,
    targetConfig: Partial<PreprocessingConfig>
  ): Promise<AudioBuffer> {
    try {
      const targetSampleRate = targetConfig.targetSampleRate || audio.sampleRate;
      const targetChannels = targetConfig.targetChannels || audio.channels;
      const targetBitDepth = targetConfig.targetBitDepth || audio.bitDepth;

      logger.debug('Converting audio format', {
        from: { sampleRate: audio.sampleRate, channels: audio.channels, bitDepth: audio.bitDepth },
        to: { sampleRate: targetSampleRate, channels: targetChannels, bitDepth: targetBitDepth },
      });

      let samples = this.bufferToSamples(audio.data, audio.bitDepth);
      let currentSampleRate = audio.sampleRate;
      let currentChannels = audio.channels;

      // Convert channels (stereo to mono or vice versa)
      if (currentChannels !== targetChannels) {
        samples = this.convertChannels(samples, currentChannels, targetChannels);
        currentChannels = targetChannels;
      }

      // Resample if needed
      if (currentSampleRate !== targetSampleRate) {
        samples = this.resample(samples, currentSampleRate, targetSampleRate);
        currentSampleRate = targetSampleRate;
      }

      // Convert bit depth
      const convertedData = this.samplesToBuffer(samples, targetBitDepth);

      const newDuration = samples.length / (targetSampleRate * targetChannels);

      logger.debug('Format conversion complete');
      return {
        data: convertedData,
        sampleRate: targetSampleRate,
        channels: targetChannels,
        bitDepth: targetBitDepth,
        duration: newDuration,
      };
    } catch (error) {
      logger.error('Error converting audio format', { error });
      throw new AudioProcessingError('Failed to convert audio format', { cause: toError(error) });
    }
  }

  /**
   * Compress audio for efficient storage/transmission
   */
  async compressAudio(
    audio: AudioBuffer,
    quality: number = this.config.compressionQuality
  ): Promise<Buffer> {
    try {
      logger.debug('Compressing audio', { quality });

      // In production, use a proper audio codec like Opus
      // This is a simplified implementation using basic quantization
      const samples = this.bufferToSamples(audio.data, audio.bitDepth);

      // Reduce bit depth based on quality (simplified compression)
      const targetBits = Math.max(8, Math.floor((quality / 100) * audio.bitDepth));
      const quantizationFactor = Math.pow(2, targetBits - 1);

      const compressed = samples.map((sample) => {
        const quantized = Math.round(sample * quantizationFactor) / quantizationFactor;
        return quantized;
      });

      const compressedData = this.samplesToBuffer(compressed, targetBits);

      logger.debug('Audio compressed', {
        originalSize: audio.data.length,
        compressedSize: compressedData.length,
        ratio: ((compressedData.length / audio.data.length) * 100).toFixed(2) + '%',
      });

      return compressedData;
    } catch (error) {
      logger.error('Error compressing audio', { error });
      throw new AudioProcessingError('Failed to compress audio', { cause: toError(error) });
    }
  }

  /**
   * Extract audio metadata
   */
  async extractMetadata(audioData: Buffer): Promise<AudioMetadata> {
    try {
      logger.debug('Extracting audio metadata');

      // Parse WAV header (simplified - assumes WAV format)
      // In production, use a proper audio library like node-wav or fluent-ffmpeg

      if (audioData.length < 44) {
        throw new Error('Invalid audio file: too small');
      }

      // Check for RIFF header
      const riffHeader = audioData.toString('ascii', 0, 4);
      if (riffHeader !== 'RIFF') {
        throw new Error('Invalid audio format: not a WAV file');
      }

      const fileSize = audioData.readUInt32LE(4) + 8;
      const waveHeader = audioData.toString('ascii', 8, 12);

      if (waveHeader !== 'WAVE') {
        throw new Error('Invalid audio format: not a WAVE file');
      }

      // Find fmt chunk
      let offset = 12;
      while (offset < audioData.length - 8) {
        const chunkId = audioData.toString('ascii', offset, offset + 4);
        const chunkSize = audioData.readUInt32LE(offset + 4);

        if (chunkId === 'fmt ') {
          const audioFormat = audioData.readUInt16LE(offset + 8);
          const channels = audioData.readUInt16LE(offset + 10);
          const sampleRate = audioData.readUInt32LE(offset + 12);
          const bitDepth = audioData.readUInt16LE(offset + 22);

          // Find data chunk for duration
          let dataOffset = offset + 8 + chunkSize;
          while (dataOffset < audioData.length - 8) {
            const dataChunkId = audioData.toString('ascii', dataOffset, dataOffset + 4);
            const dataChunkSize = audioData.readUInt32LE(dataOffset + 4);

            if (dataChunkId === 'data') {
              const numSamples = dataChunkSize / (channels * (bitDepth / 8));
              const duration = numSamples / sampleRate;

              const metadata: AudioMetadata = {
                duration,
                sampleRate,
                channels,
                bitDepth,
                format: 'WAV',
                fileSize,
                codec: audioFormat === 1 ? 'PCM' : 'Unknown',
              };

              logger.debug('Metadata extracted', metadata);
              return metadata;
            }

            dataOffset += 8 + dataChunkSize;
          }
        }

        offset += 8 + chunkSize;
      }

      throw new Error('Invalid WAV file: missing required chunks');
    } catch (error) {
      logger.error('Error extracting metadata', { error });
      throw new AudioProcessingError('Failed to extract audio metadata', { cause: toError(error) });
    }
  }

  /**
   * Validate audio file for corruption
   */
  async validateAudio(audioData: Buffer): Promise<{ isValid: boolean; errors: string[] }> {
    try {
      logger.debug('Validating audio file');

      const errors: string[] = [];

      // Check minimum size
      if (audioData.length < 44) {
        errors.push('File too small to be valid audio');
        return { isValid: false, errors };
      }

      // Try to extract metadata
      try {
        const metadata = await this.extractMetadata(audioData);

        // Validate metadata values
        if (metadata.sampleRate < 8000 || metadata.sampleRate > 48000) {
          errors.push(`Invalid sample rate: ${metadata.sampleRate} Hz`);
        }

        if (metadata.channels < 1 || metadata.channels > 2) {
          errors.push(`Invalid channel count: ${metadata.channels}`);
        }

        if (
          metadata.bitDepth !== 8 &&
          metadata.bitDepth !== 16 &&
          metadata.bitDepth !== 24 &&
          metadata.bitDepth !== 32
        ) {
          errors.push(`Invalid bit depth: ${metadata.bitDepth}`);
        }

        if (metadata.duration <= 0 || metadata.duration > 3600) {
          errors.push(`Invalid duration: ${metadata.duration} seconds`);
        }

        // Check for data corruption (simplified)
        const samples = this.bufferToSamples(audioData.slice(44), metadata.bitDepth);
        const hasNaN = samples.some((s) => isNaN(s));
        if (hasNaN) {
          errors.push('Audio data contains invalid values');
        }
      } catch (error) {
        errors.push(
          `Failed to parse audio: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }

      const isValid = errors.length === 0;
      logger.debug('Audio validation complete', { isValid, errorCount: errors.length });

      return { isValid, errors };
    } catch (error) {
      logger.error('Error validating audio', { error });
      throw new AudioProcessingError('Failed to validate audio', { cause: toError(error) });
    }
  }

  /**
   * Process audio with full preprocessing pipeline
   */
  async processAudio(
    audio: AudioBuffer,
    config?: Partial<PreprocessingConfig>
  ): Promise<AudioBuffer> {
    try {
      const processingConfig = { ...this.config, ...config };
      logger.info('Starting audio preprocessing pipeline', { config: processingConfig });

      let processed = audio;

      // 1. Format conversion
      if (
        audio.sampleRate !== processingConfig.targetSampleRate ||
        audio.channels !== processingConfig.targetChannels ||
        audio.bitDepth !== processingConfig.targetBitDepth
      ) {
        processed = await this.convertFormat(processed, processingConfig);
      }

      // 2. Echo cancellation
      if (processingConfig.enableEchoCancellation) {
        processed = await this.cancelEcho(processed);
      }

      // 3. Volume normalization
      if (processingConfig.normalizeVolume) {
        processed = await this.normalizeVolume(processed, processingConfig.targetVolumeDb);
      }

      // 4. Silence trimming (optional)
      if (processingConfig.removeSilence) {
        processed = await this.trimSilence(processed);
      }

      // 5. Quality assessment
      const quality = await this.assessQuality(processed);
      logger.info('Audio preprocessing complete', {
        quality: {
          snr: quality.snr,
          clarityScore: quality.clarityScore,
          isAcceptable: quality.isAcceptable,
        },
      });

      if (!quality.isAcceptable) {
        logger.warn('Audio quality below acceptable threshold', {
          recommendations: quality.recommendations,
        });
      }

      return processed;
    } catch (error) {
      logger.error('Error in audio preprocessing pipeline', { error });
      throw new AudioProcessingError('Failed to process audio', { cause: toError(error) });
    }
  }

  // ========== Private Helper Methods ==========

  /**
   * Convert buffer to normalized float samples (-1 to 1)
   */
  private bufferToSamples(buffer: Buffer, bitDepth: number): Float32Array {
    const samples = new Float32Array(buffer.length / (bitDepth / 8));
    const maxValue = Math.pow(2, bitDepth - 1);

    for (let i = 0; i < samples.length; i++) {
      let sample: number;

      if (bitDepth === 8) {
        sample = buffer.readUInt8(i) - 128;
      } else if (bitDepth === 16) {
        sample = buffer.readInt16LE(i * 2);
      } else if (bitDepth === 24) {
        const byte1 = buffer.readUInt8(i * 3);
        const byte2 = buffer.readUInt8(i * 3 + 1);
        const byte3 = buffer.readInt8(i * 3 + 2);
        sample = (byte3 << 16) | (byte2 << 8) | byte1;
      } else if (bitDepth === 32) {
        sample = buffer.readInt32LE(i * 4);
      } else {
        throw new Error(`Unsupported bit depth: ${bitDepth}`);
      }

      samples[i] = sample / maxValue;
    }

    return samples;
  }

  /**
   * Convert normalized float samples to buffer
   */
  private samplesToBuffer(samples: Float32Array | number[], bitDepth: number): Buffer {
    const buffer = Buffer.alloc(samples.length * (bitDepth / 8));
    const maxValue = Math.pow(2, bitDepth - 1);

    for (let i = 0; i < samples.length; i++) {
      const sample = Math.max(-1, Math.min(1, samples[i]));
      const intSample = Math.round(sample * maxValue);

      if (bitDepth === 8) {
        buffer.writeUInt8(intSample + 128, i);
      } else if (bitDepth === 16) {
        buffer.writeInt16LE(intSample, i * 2);
      } else if (bitDepth === 24) {
        buffer.writeUInt8(intSample & 0xff, i * 3);
        buffer.writeUInt8((intSample >> 8) & 0xff, i * 3 + 1);
        buffer.writeInt8((intSample >> 16) & 0xff, i * 3 + 2);
      } else if (bitDepth === 32) {
        buffer.writeInt32LE(intSample, i * 4);
      }
    }

    return buffer;
  }

  /**
   * Calculate RMS (Root Mean Square) of samples
   */
  private calculateRMS(samples: Float32Array | number[]): number {
    let sumSquares = 0;
    for (let i = 0; i < samples.length; i++) {
      sumSquares += samples[i] * samples[i];
    }
    return Math.sqrt(sumSquares / samples.length);
  }

  /**
   * Estimate Signal-to-Noise Ratio
   */
  private estimateSNR(samples: Float32Array | number[]): number {
    // Simplified SNR estimation
    // In production, use proper signal processing techniques

    const windowSize = 1024;
    const energies: number[] = [];

    for (let i = 0; i < samples.length - windowSize; i += windowSize) {
      const window = Array.from(samples.slice(i, i + windowSize));
      const rms = this.calculateRMS(window);
      energies.push(rms);
    }

    if (energies.length === 0) return 0;

    // Sort energies to find signal and noise levels
    energies.sort((a, b) => a - b);

    // Assume bottom 20% is noise, top 20% is signal
    const noiseIndex = Math.floor(energies.length * 0.2);
    const signalIndex = Math.floor(energies.length * 0.8);

    const noiseLevel = energies[noiseIndex];
    const signalLevel = energies[signalIndex];

    if (noiseLevel === 0) return 100; // Perfect signal

    const snr = 20 * Math.log10(signalLevel / noiseLevel);
    return Math.max(0, snr);
  }

  /**
   * Detect audio clipping
   */
  private detectClipping(samples: Float32Array | number[]): boolean {
    const threshold = 0.99; // 99% of max value
    const clippedSamples = samples.filter((s) => Math.abs(s) >= threshold).length;
    const clippingRatio = clippedSamples / samples.length;

    return clippingRatio > 0.01; // More than 1% clipped
  }

  /**
   * Calculate clarity score (0-100)
   */
  private calculateClarityScore(
    snr: number,
    volumeLevel: number,
    clippingDetected: boolean,
    silenceRatio: number
  ): number {
    let score = 100;

    // SNR contribution (40 points)
    if (snr < 10) score -= 40;
    else if (snr < 20) score -= 20;
    else if (snr < 30) score -= 10;

    // Volume level contribution (30 points)
    if (volumeLevel < -40 || volumeLevel > -10) score -= 30;
    else if (volumeLevel < -35 || volumeLevel > -15) score -= 15;

    // Clipping penalty (20 points)
    if (clippingDetected) score -= 20;

    // Silence ratio contribution (10 points)
    if (silenceRatio > 70) score -= 10;
    else if (silenceRatio > 50) score -= 5;

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Convert between mono and stereo
   */
  private convertChannels(
    samples: Float32Array,
    fromChannels: number,
    toChannels: number
  ): Float32Array {
    if (fromChannels === toChannels) return samples;

    if (fromChannels === 2 && toChannels === 1) {
      // Stereo to mono: average channels
      const mono = new Float32Array(samples.length / 2);
      for (let i = 0; i < mono.length; i++) {
        mono[i] = (samples[i * 2] + samples[i * 2 + 1]) / 2;
      }
      return mono;
    } else if (fromChannels === 1 && toChannels === 2) {
      // Mono to stereo: duplicate channel
      const stereo = new Float32Array(samples.length * 2);
      for (let i = 0; i < samples.length; i++) {
        stereo[i * 2] = samples[i];
        stereo[i * 2 + 1] = samples[i];
      }
      return stereo;
    }

    throw new Error(`Unsupported channel conversion: ${fromChannels} to ${toChannels}`);
  }

  /**
   * Resample audio (simplified linear interpolation)
   */
  private resample(samples: Float32Array, fromRate: number, toRate: number): Float32Array {
    if (fromRate === toRate) return samples;

    const ratio = fromRate / toRate;
    const newLength = Math.floor(samples.length / ratio);
    const resampled = new Float32Array(newLength);

    for (let i = 0; i < newLength; i++) {
      const srcIndex = i * ratio;
      const srcIndexFloor = Math.floor(srcIndex);
      const srcIndexCeil = Math.min(srcIndexFloor + 1, samples.length - 1);
      const fraction = srcIndex - srcIndexFloor;

      // Linear interpolation
      resampled[i] = samples[srcIndexFloor] * (1 - fraction) + samples[srcIndexCeil] * fraction;
    }

    return resampled;
  }
}

/**
 * Create a singleton instance
 */
export const audioPreprocessing = new AudioPreprocessingService();
