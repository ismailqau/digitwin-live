/**
 * Voice Sample Processor Service
 *
 * Handles voice sample preprocessing and quality validation.
 * Implements:
 * - Audio quality validation (SNR > 20 dB, no clipping, no background noise)
 * - Voice sample preprocessing (noise reduction, normalization)
 * - Audio format validation and conversion
 * - Metadata extraction (duration, quality score, language)
 */

import { exec } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface AudioQualityMetrics {
  duration: number; // in seconds
  sampleRate: number;
  channels: number;
  bitDepth: number;
  snr: number; // Signal-to-noise ratio in dB
  hasClipping: boolean;
  hasBackgroundNoise: boolean;
  qualityScore: number; // 0-100
  peakLevel: number; // Peak audio level in dB
  rmsLevel: number; // RMS audio level in dB
  dynamicRange: number; // Dynamic range in dB
}

export interface VoiceSampleRequirements {
  minDuration: number; // 60 seconds (1 minute)
  maxDuration: number; // 300 seconds (5 minutes)
  minSNR: number; // 20 dB
  maxClippingPercentage: number; // 5%
  minQualityScore: number; // 70/100
  requiredSampleRate: number; // 16000 Hz
  requiredChannels: number; // 1 (mono)
  requiredBitDepth: number; // 16-bit
  supportedFormats: string[]; // ['wav', 'mp3', 'flac', 'm4a']
}

export interface ProcessingResult {
  isValid: boolean;
  metrics: AudioQualityMetrics;
  processedFilePath?: string;
  issues: string[];
  recommendations: string[];
}

const DEFAULT_REQUIREMENTS: VoiceSampleRequirements = {
  minDuration: 60, // 1 minute
  maxDuration: 300, // 5 minutes
  minSNR: 20, // 20 dB
  maxClippingPercentage: 5, // 5%
  minQualityScore: 70, // 70/100
  requiredSampleRate: 16000, // 16 kHz
  requiredChannels: 1, // Mono
  requiredBitDepth: 16, // 16-bit
  supportedFormats: ['wav', 'mp3', 'flac', 'm4a', 'aac'],
};

export class VoiceSampleProcessor {
  private requirements: VoiceSampleRequirements;

  constructor(requirements: Partial<VoiceSampleRequirements> = {}) {
    this.requirements = { ...DEFAULT_REQUIREMENTS, ...requirements };
  }

  /**
   * Process and validate a voice sample
   */
  async processVoiceSample(inputFilePath: string, outputDir: string): Promise<ProcessingResult> {
    try {
      // Validate file format
      const formatValidation = await this.validateFileFormat(inputFilePath);
      if (!formatValidation.isValid) {
        return {
          isValid: false,
          metrics: {} as AudioQualityMetrics,
          issues: formatValidation.issues,
          recommendations: formatValidation.recommendations,
        };
      }

      // Extract audio metrics
      const metrics = await this.extractAudioMetrics(inputFilePath);

      // Validate audio quality
      const qualityValidation = this.validateAudioQuality(metrics);

      // Process audio if needed (normalize, denoise, convert format)
      let processedFilePath: string | undefined;
      if (qualityValidation.needsProcessing) {
        processedFilePath = await this.processAudio(inputFilePath, outputDir, metrics);

        // Re-extract metrics from processed file
        const processedMetrics = await this.extractAudioMetrics(processedFilePath);
        Object.assign(metrics, processedMetrics);
      }

      return {
        isValid: qualityValidation.isValid,
        metrics,
        processedFilePath,
        issues: qualityValidation.issues,
        recommendations: qualityValidation.recommendations,
      };
    } catch (error) {
      console.error('Voice sample processing error:', error);
      return {
        isValid: false,
        metrics: {} as AudioQualityMetrics,
        issues: [`Processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
        recommendations: ['Please try uploading the file again or use a different audio format'],
      };
    }
  }

  /**
   * Validate file format
   */
  private async validateFileFormat(filePath: string): Promise<{
    isValid: boolean;
    issues: string[];
    recommendations: string[];
  }> {
    const issues: string[] = [];
    const recommendations: string[] = [];

    try {
      // Check file extension
      const ext = path.extname(filePath).toLowerCase().slice(1);
      if (!this.requirements.supportedFormats.includes(ext)) {
        issues.push(`Unsupported file format: ${ext}`);
        recommendations.push(`Supported formats: ${this.requirements.supportedFormats.join(', ')}`);
      }

      // Check file size (max 50MB)
      const stats = await fs.stat(filePath);
      const maxSize = 50 * 1024 * 1024; // 50MB
      if (stats.size > maxSize) {
        issues.push(`File too large: ${Math.round(stats.size / 1024 / 1024)}MB (max: 50MB)`);
        recommendations.push('Compress the audio file or reduce the recording duration');
      }

      // Check if file is readable
      await fs.access(filePath, fs.constants.R_OK);

      return {
        isValid: issues.length === 0,
        issues,
        recommendations,
      };
    } catch {
      return {
        isValid: false,
        issues: ['File is not readable or does not exist'],
        recommendations: ['Please check the file and try again'],
      };
    }
  }

  /**
   * Extract audio metrics using FFmpeg
   */
  private async extractAudioMetrics(filePath: string): Promise<AudioQualityMetrics> {
    try {
      // Get basic audio info
      const { stdout: infoOutput } = await execAsync(
        `ffprobe -v quiet -print_format json -show_format -show_streams "${filePath}"`
      );
      const info = JSON.parse(infoOutput);
      const audioStream = info.streams.find(
        (s: { codec_type: string }) => s.codec_type === 'audio'
      );

      if (!audioStream) {
        throw new Error('No audio stream found in file');
      }

      const duration = parseFloat(info.format.duration);
      const sampleRate = parseInt(audioStream.sample_rate);
      const channels = parseInt(audioStream.channels);
      const bitDepth = audioStream.bits_per_sample || 16;

      // Analyze audio quality using FFmpeg filters
      const { stdout: analysisOutput } = await execAsync(
        `ffmpeg -i "${filePath}" -af "volumedetect,astats=metadata=1:reset=1" -f null - 2>&1`
      );

      // Parse volume detection results
      const volumeMatch = analysisOutput.match(/max_volume: ([-\d.]+) dB/);
      const meanVolumeMatch = analysisOutput.match(/mean_volume: ([-\d.]+) dB/);

      const peakLevel = volumeMatch ? parseFloat(volumeMatch[1]) : -60;
      const rmsLevel = meanVolumeMatch ? parseFloat(meanVolumeMatch[1]) : -60;

      // Estimate SNR (simplified calculation)
      const snr = this.estimateSNR(peakLevel, rmsLevel, analysisOutput);

      // Detect clipping
      const hasClipping = peakLevel > -0.1; // Very close to 0 dB indicates clipping

      // Detect background noise (simplified)
      const hasBackgroundNoise = snr < this.requirements.minSNR;

      // Calculate dynamic range
      const dynamicRange = Math.abs(peakLevel - rmsLevel);

      // Calculate overall quality score
      const qualityScore = this.calculateQualityScore({
        duration,
        sampleRate,
        channels,
        bitDepth,
        snr,
        hasClipping,
        hasBackgroundNoise,
        peakLevel,
        rmsLevel,
        dynamicRange,
      });

      return {
        duration,
        sampleRate,
        channels,
        bitDepth,
        snr,
        hasClipping,
        hasBackgroundNoise,
        qualityScore,
        peakLevel,
        rmsLevel,
        dynamicRange,
      };
    } catch (error) {
      console.error('Error extracting audio metrics:', error);
      throw new Error(
        `Failed to analyze audio: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Estimate Signal-to-Noise Ratio
   */
  private estimateSNR(peakLevel: number, rmsLevel: number, analysisOutput: string): number {
    // Look for noise floor estimation in FFmpeg output
    const noiseFloorMatch = analysisOutput.match(/Noise floor: ([-\d.]+) dB/);

    if (noiseFloorMatch) {
      const noiseFloor = parseFloat(noiseFloorMatch[1]);
      return rmsLevel - noiseFloor;
    }

    // Simplified SNR estimation based on dynamic range
    const dynamicRange = Math.abs(peakLevel - rmsLevel);

    // Estimate SNR based on dynamic range and RMS level
    if (rmsLevel > -20) return Math.min(40, dynamicRange + 10);
    if (rmsLevel > -30) return Math.min(30, dynamicRange + 5);
    if (rmsLevel > -40) return Math.min(20, dynamicRange);
    return Math.max(0, dynamicRange - 5);
  }

  /**
   * Calculate overall quality score
   */
  private calculateQualityScore(metrics: Partial<AudioQualityMetrics>): number {
    let score = 100;

    // Duration penalties
    if (metrics.duration! < this.requirements.minDuration) {
      score -= 30;
    }
    if (metrics.duration! > this.requirements.maxDuration) {
      score -= 20;
    }

    // Sample rate penalties
    if (metrics.sampleRate !== this.requirements.requiredSampleRate) {
      score -= 15;
    }

    // Channel penalties
    if (metrics.channels !== this.requirements.requiredChannels) {
      score -= 10;
    }

    // SNR penalties
    if (metrics.snr! < this.requirements.minSNR) {
      score -= 25;
    }

    // Clipping penalties
    if (metrics.hasClipping) {
      score -= 20;
    }

    // Background noise penalties
    if (metrics.hasBackgroundNoise) {
      score -= 15;
    }

    // Level penalties
    if (metrics.rmsLevel! < -40) {
      score -= 10; // Too quiet
    }
    if (metrics.peakLevel! > -3) {
      score -= 15; // Too loud
    }

    // Dynamic range penalties
    if (metrics.dynamicRange! < 10) {
      score -= 10; // Poor dynamic range
    }

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  /**
   * Validate audio quality
   */
  private validateAudioQuality(metrics: AudioQualityMetrics): {
    isValid: boolean;
    needsProcessing: boolean;
    issues: string[];
    recommendations: string[];
  } {
    const issues: string[] = [];
    const recommendations: string[] = [];
    let needsProcessing = false;

    // Check duration
    if (metrics.duration < this.requirements.minDuration) {
      issues.push(
        `Recording too short: ${Math.round(metrics.duration)}s (minimum: ${this.requirements.minDuration}s)`
      );
    }
    if (metrics.duration > this.requirements.maxDuration) {
      issues.push(
        `Recording too long: ${Math.round(metrics.duration)}s (maximum: ${this.requirements.maxDuration}s)`
      );
    }

    // Check sample rate
    if (metrics.sampleRate !== this.requirements.requiredSampleRate) {
      recommendations.push(
        `Sample rate will be converted from ${metrics.sampleRate}Hz to ${this.requirements.requiredSampleRate}Hz`
      );
      needsProcessing = true;
    }

    // Check channels
    if (metrics.channels !== this.requirements.requiredChannels) {
      recommendations.push(
        `Audio will be converted from ${metrics.channels} channel(s) to ${this.requirements.requiredChannels} channel (mono)`
      );
      needsProcessing = true;
    }

    // Check SNR
    if (metrics.snr < this.requirements.minSNR) {
      issues.push(
        `Signal-to-noise ratio too low: ${Math.round(metrics.snr)}dB (minimum: ${this.requirements.minSNR}dB)`
      );
      recommendations.push('Record in a quieter environment with less background noise');
    }

    // Check clipping
    if (metrics.hasClipping) {
      issues.push('Audio clipping detected');
      recommendations.push('Reduce microphone gain or speak further from the microphone');
    }

    // Check background noise
    if (metrics.hasBackgroundNoise) {
      recommendations.push('Background noise detected. Noise reduction will be applied');
      needsProcessing = true;
    }

    // Check quality score
    if (metrics.qualityScore < this.requirements.minQualityScore) {
      issues.push(
        `Quality score too low: ${metrics.qualityScore}/100 (minimum: ${this.requirements.minQualityScore})`
      );
    }

    // Check levels
    if (metrics.rmsLevel < -40) {
      recommendations.push('Audio level is low. Normalization will be applied');
      needsProcessing = true;
    }

    const isValid =
      metrics.duration >= this.requirements.minDuration &&
      metrics.duration <= this.requirements.maxDuration &&
      metrics.qualityScore >= this.requirements.minQualityScore &&
      !metrics.hasClipping;

    return {
      isValid,
      needsProcessing,
      issues,
      recommendations,
    };
  }

  /**
   * Process audio (normalize, denoise, convert format)
   */
  private async processAudio(
    inputPath: string,
    outputDir: string,
    metrics: AudioQualityMetrics
  ): Promise<string> {
    const outputFileName = `processed_${Date.now()}.wav`;
    const outputPath = path.join(outputDir, outputFileName);

    try {
      // Convert to required format (16kHz, mono, 16-bit)
      let audioFilters = `aresample=${this.requirements.requiredSampleRate}`;

      if (metrics.channels > 1) {
        audioFilters += ',pan=mono|c0=0.5*c0+0.5*c1'; // Convert to mono
      }

      // Apply noise reduction if background noise detected
      if (metrics.hasBackgroundNoise) {
        // Simple high-pass filter to reduce low-frequency noise
        audioFilters += ',highpass=f=80';
        // Noise gate to reduce background noise during silence
        audioFilters += ',agate=threshold=0.1:ratio=2:attack=5:release=50';
      }

      // Normalize audio if levels are too low
      if (metrics.rmsLevel < -30) {
        audioFilters += ',loudnorm=I=-16:TP=-1.5:LRA=11';
      }

      // Apply limiter to prevent clipping
      audioFilters += ',alimiter=level_in=1:level_out=0.9:limit=0.95';

      // Execute FFmpeg command
      const command = [
        'ffmpeg',
        '-i',
        `"${inputPath}"`,
        '-af',
        `"${audioFilters}"`,
        '-acodec',
        'pcm_s16le',
        '-ar',
        this.requirements.requiredSampleRate.toString(),
        '-ac',
        this.requirements.requiredChannels.toString(),
        '-y', // Overwrite output file
        `"${outputPath}"`,
      ].join(' ');

      await execAsync(command);

      // Verify the processed file exists
      await fs.access(outputPath, fs.constants.R_OK);

      return outputPath;
    } catch (error) {
      console.error('Audio processing error:', error);
      throw new Error(
        `Failed to process audio: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Clean up temporary files
   */
  async cleanup(filePaths: string[]): Promise<void> {
    for (const filePath of filePaths) {
      try {
        await fs.unlink(filePath);
      } catch (error) {
        console.warn(`Failed to delete temporary file ${filePath}:`, error);
      }
    }
  }

  /**
   * Get requirements
   */
  getRequirements(): VoiceSampleRequirements {
    return this.requirements;
  }
}

export default VoiceSampleProcessor;
