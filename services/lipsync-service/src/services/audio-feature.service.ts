import { createLogger } from '@clone/logger';

import {
  AudioFeatures,
  AudioChunk,
  AudioProcessingConfig,
  PhonemeInfo,
  AudioQualityMetrics,
  AudioFeatureCache,
} from '../types';

const logger = createLogger('AudioFeatureService');

// Default audio processing configuration
const DEFAULT_CONFIG: AudioProcessingConfig = {
  sampleRate: 16000,
  hopLength: 160, // 10ms at 16kHz
  windowLength: 400, // 25ms at 16kHz
  nMels: 80,
  nMfcc: 13,
  fMin: 80,
  fMax: 7600,
};

/**
 * Service for extracting audio features for lip-sync generation.
 * Extracts mel-spectrograms, MFCCs, and other features needed for lip-sync models.
 */
export class AudioFeatureService {
  private config: AudioProcessingConfig;
  private featureCache: Map<string, AudioFeatureCache> = new Map();
  private readonly maxCacheSize = 1000;
  private readonly cacheTtlMs: number;

  constructor(config?: Partial<AudioProcessingConfig>, cacheTtlMs = 300000) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.cacheTtlMs = cacheTtlMs;
    logger.info('AudioFeatureService initialized', { config: this.config });
  }

  /**
   * Extract audio features from an audio chunk.
   */
  async extractFeatures(chunk: AudioChunk): Promise<AudioFeatures> {
    const startTime = Date.now();
    const cacheKey = this.generateCacheKey(chunk);

    // Check cache first
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      logger.debug('Audio features cache hit', { cacheKey });
      return cached.features;
    }

    try {
      // Convert audio buffer to samples
      const samples = this.bufferToSamples(chunk.data, chunk.format);

      // Normalize samples
      const normalizedSamples = this.normalizeSamples(samples);

      // Apply pre-emphasis filter
      const preEmphasized = this.applyPreEmphasis(normalizedSamples);

      // Extract mel-spectrogram
      const melSpectrogram = this.extractMelSpectrogram(preEmphasized);

      // Extract MFCCs
      const mfcc = this.extractMFCC(melSpectrogram);

      // Calculate energy
      const energy = this.calculateEnergy(normalizedSamples);

      // Estimate pitch
      const pitch = this.estimatePitch(normalizedSamples);

      const features: AudioFeatures = {
        melSpectrogram,
        mfcc,
        energy,
        pitch,
        timestamp: chunk.timestamp,
        duration: (samples.length / chunk.sampleRate) * 1000,
        sampleRate: chunk.sampleRate,
      };

      // Cache the features
      this.addToCache(cacheKey, features);

      const processingTime = Date.now() - startTime;
      logger.debug('Audio features extracted', {
        duration: features.duration,
        processingTimeMs: processingTime,
        melFrames: melSpectrogram.length,
      });

      return features;
    } catch (error) {
      logger.error('Failed to extract audio features', { error });
      throw error;
    }
  }

  /**
   * Extract features optimized for real-time streaming.
   */
  async extractStreamingFeatures(chunks: AudioChunk[]): Promise<AudioFeatures[]> {
    return Promise.all(chunks.map((chunk) => this.extractFeatures(chunk)));
  }

  /**
   * Assess audio quality for lip-sync optimization.
   */
  assessAudioQuality(chunk: AudioChunk): AudioQualityMetrics {
    const samples = this.bufferToSamples(chunk.data, chunk.format);

    // Calculate SNR
    const snr = this.calculateSNR(samples);

    // Calculate clarity (based on spectral flatness)
    const clarity = this.calculateClarity(samples);

    // Calculate volume in dB
    const volume = this.calculateVolumeDb(samples);

    // Check for clipping
    const hasClipping = this.detectClipping(samples);

    // Calculate silence ratio
    const silenceRatio = this.calculateSilenceRatio(samples);

    return {
      snr,
      clarity,
      volume,
      hasClipping,
      silenceRatio,
    };
  }

  /**
   * Detect phonemes for improved lip-sync accuracy.
   * This is a simplified implementation - production would use a proper ASR model.
   */
  detectPhonemes(features: AudioFeatures): PhonemeInfo[] {
    const phonemes: PhonemeInfo[] = [];
    const frameCount = features.melSpectrogram.length;
    const frameDuration = features.duration / frameCount;

    // Simplified phoneme detection based on energy and spectral features
    // In production, this would use a trained phoneme recognition model
    for (let i = 0; i < frameCount; i++) {
      const frameEnergy = this.calculateFrameEnergy(features.melSpectrogram[i]);
      const startTime = i * frameDuration;
      const endTime = (i + 1) * frameDuration;

      // Classify based on energy and spectral characteristics
      const phoneme = this.classifyPhoneme(features.melSpectrogram[i], frameEnergy);

      if (phoneme) {
        phonemes.push({
          phoneme,
          startTime,
          endTime,
          confidence: 0.7, // Simplified confidence
        });
      }
    }

    return this.mergeConsecutivePhonemes(phonemes);
  }

  /**
   * Preprocess audio for optimal lip-sync model input.
   */
  preprocessForLipSync(chunk: AudioChunk, targetSampleRate = 16000): AudioChunk {
    let samples = this.bufferToSamples(chunk.data, chunk.format);

    // Resample if necessary
    if (chunk.sampleRate !== targetSampleRate) {
      samples = this.resample(samples, chunk.sampleRate, targetSampleRate);
    }

    // Normalize
    samples = this.normalizeSamples(samples);

    // Apply noise reduction (simplified)
    samples = this.reduceNoise(samples);

    return {
      data: this.samplesToBuffer(samples),
      timestamp: chunk.timestamp,
      sequenceNumber: chunk.sequenceNumber,
      sampleRate: targetSampleRate,
      channels: 1,
      format: 'pcm',
    };
  }

  // ============================================================================
  // Private Methods - Signal Processing
  // ============================================================================

  private bufferToSamples(buffer: Buffer, format: 'pcm' | 'wav' | 'opus'): Float32Array {
    // Handle different formats
    if (format === 'wav') {
      // Skip WAV header (44 bytes)
      buffer = buffer.subarray(44);
    }

    // Assume 16-bit PCM
    const samples = new Float32Array(buffer.length / 2);
    for (let i = 0; i < samples.length; i++) {
      const sample = buffer.readInt16LE(i * 2);
      samples[i] = sample / 32768.0;
    }
    return samples;
  }

  private samplesToBuffer(samples: Float32Array): Buffer {
    const buffer = Buffer.alloc(samples.length * 2);
    for (let i = 0; i < samples.length; i++) {
      const sample = Math.max(-1, Math.min(1, samples[i]));
      buffer.writeInt16LE(Math.round(sample * 32767), i * 2);
    }
    return buffer;
  }

  private normalizeSamples(samples: Float32Array): Float32Array {
    const maxAbs = samples.reduce((max, s) => Math.max(max, Math.abs(s)), 0.0001);
    const normalized = new Float32Array(samples.length);
    for (let i = 0; i < samples.length; i++) {
      normalized[i] = samples[i] / maxAbs;
    }
    return normalized;
  }

  private applyPreEmphasis(samples: Float32Array, coefficient = 0.97): Float32Array {
    const result = new Float32Array(samples.length);
    result[0] = samples[0];
    for (let i = 1; i < samples.length; i++) {
      result[i] = samples[i] - coefficient * samples[i - 1];
    }
    return result;
  }

  private extractMelSpectrogram(samples: Float32Array): number[][] {
    const { hopLength, windowLength, nMels, fMin, fMax, sampleRate } = this.config;
    const numFrames = Math.floor((samples.length - windowLength) / hopLength) + 1;
    const melSpectrogram: number[][] = [];

    // Create mel filterbank
    const melFilterbank = this.createMelFilterbank(windowLength, sampleRate, nMels, fMin, fMax);

    for (let frame = 0; frame < numFrames; frame++) {
      const start = frame * hopLength;
      const frameData = samples.slice(start, start + windowLength);

      // Apply Hann window
      const windowed = this.applyHannWindow(frameData);

      // Compute FFT magnitude spectrum
      const spectrum = this.computeFFTMagnitude(windowed);

      // Apply mel filterbank
      const melFrame = this.applyMelFilterbank(spectrum, melFilterbank);

      // Convert to log scale
      const logMelFrame = melFrame.map((v) => Math.log(Math.max(v, 1e-10)));

      melSpectrogram.push(logMelFrame);
    }

    return melSpectrogram;
  }

  private extractMFCC(melSpectrogram: number[][]): number[] {
    if (melSpectrogram.length === 0) return [];

    // Average mel spectrogram across frames
    const avgMel = new Array(this.config.nMels).fill(0);
    for (const frame of melSpectrogram) {
      for (let i = 0; i < frame.length; i++) {
        avgMel[i] += frame[i];
      }
    }
    for (let i = 0; i < avgMel.length; i++) {
      avgMel[i] /= melSpectrogram.length;
    }

    // Apply DCT to get MFCCs
    return this.dct(avgMel).slice(0, this.config.nMfcc);
  }

  private createMelFilterbank(
    fftSize: number,
    sampleRate: number,
    nMels: number,
    fMin: number,
    fMax: number
  ): number[][] {
    const melMin = this.hzToMel(fMin);
    const melMax = this.hzToMel(fMax);
    const melPoints = new Array(nMels + 2);

    for (let i = 0; i < nMels + 2; i++) {
      melPoints[i] = melMin + (i * (melMax - melMin)) / (nMels + 1);
    }

    const hzPoints = melPoints.map((m) => this.melToHz(m));
    const binPoints = hzPoints.map((hz) => Math.floor(((fftSize + 1) * hz) / sampleRate));

    const filterbank: number[][] = [];
    for (let i = 0; i < nMels; i++) {
      const filter = new Array(Math.floor(fftSize / 2) + 1).fill(0);
      for (let j = binPoints[i]; j < binPoints[i + 1]; j++) {
        filter[j] = (j - binPoints[i]) / (binPoints[i + 1] - binPoints[i]);
      }
      for (let j = binPoints[i + 1]; j < binPoints[i + 2]; j++) {
        filter[j] = (binPoints[i + 2] - j) / (binPoints[i + 2] - binPoints[i + 1]);
      }
      filterbank.push(filter);
    }

    return filterbank;
  }

  private applyMelFilterbank(spectrum: number[], filterbank: number[][]): number[] {
    return filterbank.map((filter) =>
      filter.reduce((sum, f, i) => sum + f * (spectrum[i] || 0), 0)
    );
  }

  private applyHannWindow(samples: Float32Array): Float32Array {
    const windowed = new Float32Array(samples.length);
    for (let i = 0; i < samples.length; i++) {
      const window = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (samples.length - 1)));
      windowed[i] = samples[i] * window;
    }
    return windowed;
  }

  private computeFFTMagnitude(samples: Float32Array): number[] {
    // Simplified DFT for demonstration - production would use FFT library
    const n = samples.length;
    const magnitude = new Array(Math.floor(n / 2) + 1);

    for (let k = 0; k <= n / 2; k++) {
      let real = 0;
      let imag = 0;
      for (let t = 0; t < n; t++) {
        const angle = (2 * Math.PI * k * t) / n;
        real += samples[t] * Math.cos(angle);
        imag -= samples[t] * Math.sin(angle);
      }
      magnitude[k] = Math.sqrt(real * real + imag * imag);
    }

    return magnitude;
  }

  private dct(input: number[]): number[] {
    const n = input.length;
    const output = new Array(n);

    for (let k = 0; k < n; k++) {
      let sum = 0;
      for (let i = 0; i < n; i++) {
        sum += input[i] * Math.cos((Math.PI * k * (2 * i + 1)) / (2 * n));
      }
      output[k] = sum * Math.sqrt(2 / n);
    }

    return output;
  }

  private hzToMel(hz: number): number {
    return 2595 * Math.log10(1 + hz / 700);
  }

  private melToHz(mel: number): number {
    return 700 * (Math.pow(10, mel / 2595) - 1);
  }

  private calculateEnergy(samples: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < samples.length; i++) {
      sum += samples[i] * samples[i];
    }
    return sum / samples.length;
  }

  private calculateFrameEnergy(frame: number[]): number {
    return frame.reduce((sum, v) => sum + Math.exp(v), 0) / frame.length;
  }

  private estimatePitch(samples: Float32Array): number {
    // Simplified autocorrelation-based pitch estimation
    const minPeriod = Math.floor(this.config.sampleRate / 500); // Max 500 Hz
    const maxPeriod = Math.floor(this.config.sampleRate / 50); // Min 50 Hz

    let maxCorr = 0;
    let bestPeriod = minPeriod;

    for (let period = minPeriod; period < maxPeriod && period < samples.length / 2; period++) {
      let corr = 0;
      for (let i = 0; i < samples.length - period; i++) {
        corr += samples[i] * samples[i + period];
      }
      if (corr > maxCorr) {
        maxCorr = corr;
        bestPeriod = period;
      }
    }

    return this.config.sampleRate / bestPeriod;
  }

  // ============================================================================
  // Private Methods - Audio Quality
  // ============================================================================

  private calculateSNR(samples: Float32Array): number {
    // Estimate signal and noise power
    const sorted = Array.from(samples)
      .map(Math.abs)
      .sort((a, b) => a - b);
    const noiseFloor = sorted[Math.floor(sorted.length * 0.1)];
    const signalPeak = sorted[Math.floor(sorted.length * 0.9)];

    if (noiseFloor < 0.0001) return 60; // Very clean signal
    return 20 * Math.log10(signalPeak / noiseFloor);
  }

  private calculateClarity(samples: Float32Array): number {
    // Spectral flatness as clarity measure
    const spectrum = this.computeFFTMagnitude(samples);
    const geometricMean = Math.exp(
      spectrum.reduce((sum, v) => sum + Math.log(Math.max(v, 1e-10)), 0) / spectrum.length
    );
    const arithmeticMean = spectrum.reduce((sum, v) => sum + v, 0) / spectrum.length;

    return 1 - geometricMean / (arithmeticMean + 1e-10);
  }

  private calculateVolumeDb(samples: Float32Array): number {
    const rms = Math.sqrt(this.calculateEnergy(samples));
    return 20 * Math.log10(Math.max(rms, 1e-10));
  }

  private detectClipping(samples: Float32Array, threshold = 0.99): boolean {
    let clippedCount = 0;
    for (let i = 0; i < samples.length; i++) {
      if (Math.abs(samples[i]) >= threshold) {
        clippedCount++;
      }
    }
    return clippedCount / samples.length > 0.001;
  }

  private calculateSilenceRatio(samples: Float32Array, threshold = 0.01): number {
    let silentCount = 0;
    for (let i = 0; i < samples.length; i++) {
      if (Math.abs(samples[i]) < threshold) {
        silentCount++;
      }
    }
    return silentCount / samples.length;
  }

  // ============================================================================
  // Private Methods - Phoneme Detection
  // ============================================================================

  private classifyPhoneme(melFrame: number[], energy: number): string | null {
    // Simplified phoneme classification based on spectral characteristics
    // Production would use a trained neural network

    if (energy < 0.01) return null; // Silence

    const lowEnergy = melFrame.slice(0, 20).reduce((a, b) => a + b, 0) / 20;
    const midEnergy = melFrame.slice(20, 50).reduce((a, b) => a + b, 0) / 30;
    const highEnergy = melFrame.slice(50).reduce((a, b) => a + b, 0) / 30;

    // Very simplified classification
    if (highEnergy > midEnergy && highEnergy > lowEnergy) {
      return 's'; // Sibilant
    } else if (lowEnergy > midEnergy) {
      return 'o'; // Low vowel
    } else if (midEnergy > lowEnergy) {
      return 'a'; // Mid vowel
    }

    return 'n'; // Neutral
  }

  private mergeConsecutivePhonemes(phonemes: PhonemeInfo[]): PhonemeInfo[] {
    if (phonemes.length === 0) return [];

    const merged: PhonemeInfo[] = [];
    let current = { ...phonemes[0] };

    for (let i = 1; i < phonemes.length; i++) {
      if (phonemes[i].phoneme === current.phoneme) {
        current.endTime = phonemes[i].endTime;
        current.confidence = (current.confidence + phonemes[i].confidence) / 2;
      } else {
        merged.push(current);
        current = { ...phonemes[i] };
      }
    }
    merged.push(current);

    return merged;
  }

  // ============================================================================
  // Private Methods - Resampling and Noise Reduction
  // ============================================================================

  private resample(samples: Float32Array, fromRate: number, toRate: number): Float32Array {
    const ratio = toRate / fromRate;
    const newLength = Math.floor(samples.length * ratio);
    const resampled = new Float32Array(newLength);

    for (let i = 0; i < newLength; i++) {
      const srcIndex = i / ratio;
      const srcIndexFloor = Math.floor(srcIndex);
      const srcIndexCeil = Math.min(srcIndexFloor + 1, samples.length - 1);
      const fraction = srcIndex - srcIndexFloor;

      resampled[i] = samples[srcIndexFloor] * (1 - fraction) + samples[srcIndexCeil] * fraction;
    }

    return resampled;
  }

  private reduceNoise(samples: Float32Array): Float32Array {
    // Simple spectral subtraction noise reduction
    // Production would use more sophisticated algorithms
    const windowSize = 256;
    const result = new Float32Array(samples.length);

    // Estimate noise floor from first few frames
    const noiseEstimate = new Array(windowSize / 2 + 1).fill(0);
    const numNoiseFrames = Math.min(5, Math.floor(samples.length / windowSize));

    for (let frame = 0; frame < numNoiseFrames; frame++) {
      const start = frame * windowSize;
      const frameData = samples.slice(start, start + windowSize);
      const spectrum = this.computeFFTMagnitude(new Float32Array(Array.from(frameData)));
      for (let i = 0; i < spectrum.length; i++) {
        noiseEstimate[i] += spectrum[i] / numNoiseFrames;
      }
    }

    // For simplicity, just copy samples (full implementation would do spectral subtraction)
    result.set(samples);

    return result;
  }

  // ============================================================================
  // Private Methods - Caching
  // ============================================================================

  private generateCacheKey(chunk: AudioChunk): string {
    // Create hash from audio data
    let hash = 0;
    for (let i = 0; i < Math.min(chunk.data.length, 1000); i++) {
      hash = (hash * 31 + chunk.data[i]) & 0xffffffff;
    }
    return `audio_${chunk.timestamp}_${hash}`;
  }

  private getFromCache(key: string): AudioFeatureCache | null {
    const cached = this.featureCache.get(key);
    if (!cached) return null;

    if (cached.expiresAt < new Date()) {
      this.featureCache.delete(key);
      return null;
    }

    cached.hitCount++;
    return cached;
  }

  private addToCache(key: string, features: AudioFeatures): void {
    // Evict old entries if cache is full
    if (this.featureCache.size >= this.maxCacheSize) {
      const oldestKey = this.featureCache.keys().next().value;
      if (oldestKey) {
        this.featureCache.delete(oldestKey);
      }
    }

    this.featureCache.set(key, {
      cacheKey: key,
      features,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + this.cacheTtlMs),
      hitCount: 0,
    });
  }

  /**
   * Clear the feature cache.
   */
  clearCache(): void {
    this.featureCache.clear();
    logger.info('Audio feature cache cleared');
  }

  /**
   * Get cache statistics.
   */
  getCacheStats(): { size: number; maxSize: number; hitRate: number } {
    let totalHits = 0;
    this.featureCache.forEach((entry) => {
      totalHits += entry.hitCount;
    });

    return {
      size: this.featureCache.size,
      maxSize: this.maxCacheSize,
      hitRate: this.featureCache.size > 0 ? totalHits / this.featureCache.size : 0,
    };
  }
}
