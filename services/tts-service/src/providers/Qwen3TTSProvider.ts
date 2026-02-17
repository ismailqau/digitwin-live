import { TTSProvider } from '@clone/shared-types';
import winston from 'winston';

import { TTSRequest, TTSResponse, TTSStreamChunk, TTSOptions } from '../types';

import { BaseProvider } from './BaseProvider';

interface Qwen3TTSConfig {
  serviceUrl?: string;
  gpuEnabled?: boolean;
  maxConsecutiveFailures?: number;
  cooldownPeriodMs?: number;
}

interface Qwen3TTSHealthResponse {
  status: string;
  device?: string;
  platform?: string;
  custom_voice_model_loaded?: boolean;
  base_model_loaded?: boolean;
  gpu_available?: boolean;
  gpu_memory_used_mb?: number;
  gpu_memory_total_mb?: number;
}

interface Qwen3TTSSynthesizeResponse {
  audio_data: string;
  sample_rate: number;
  duration: number;
  language: string;
  speaker: string;
  device_used: string;
  processing_time: number;
}

interface Qwen3TTSStreamChunk {
  chunk: string;
  sequence_number: number;
  is_last: boolean;
  error?: string;
}

const PREMIUM_TIMBRES = [
  'Vivian',
  'Serena',
  'Uncle_Fu',
  'Dylan',
  'Eric',
  'Ryan',
  'Aiden',
  'Ono_Anna',
  'Sohee',
] as const;

const SUPPORTED_LANGUAGES = ['zh', 'en', 'ja', 'ko', 'de', 'fr', 'ru', 'pt', 'es', 'it'] as const;

const CLONE_VOICE_PATTERN = /^qwen3-clone-(.+)$/;
const PREMIUM_TIMBRE_PATTERN = /^qwen3-(.+)$/;

export class Qwen3TTSProvider extends BaseProvider {
  private initialized = false;
  private serviceUrl: string;
  private gpuEnabled: boolean;

  // Circuit breaker state
  private consecutiveFailures = 0;
  private maxConsecutiveFailures: number;
  private cooldownPeriodMs: number;
  private isInCooldown = false;
  private cooldownTimer: NodeJS.Timeout | null = null;

  constructor(logger?: winston.Logger, config: Qwen3TTSConfig = {}) {
    super(TTSProvider.QWEN3_TTS, logger);
    this.serviceUrl =
      config.serviceUrl || process.env.QWEN3_TTS_SERVICE_URL || 'http://localhost:8001';
    this.gpuEnabled =
      config.gpuEnabled !== undefined
        ? config.gpuEnabled
        : (process.env.QWEN3_TTS_GPU_ENABLED || 'true').toLowerCase() === 'true';
    this.maxConsecutiveFailures =
      config.maxConsecutiveFailures ??
      parseInt(process.env.QWEN3_TTS_MAX_CONSECUTIVE_FAILURES || '3', 10);
    this.cooldownPeriodMs =
      config.cooldownPeriodMs ?? parseInt(process.env.QWEN3_TTS_COOLDOWN_PERIOD_MS || '30000', 10);
  }

  get isAvailable(): boolean {
    return this.initialized && !this.isInCooldown;
  }

  async initialize(config: Record<string, unknown> = {}): Promise<void> {
    try {
      const healthResponse = await fetch(`${this.serviceUrl}/health`);

      if (!healthResponse.ok) {
        throw new Error(`Qwen3-TTS service health check failed: ${healthResponse.status}`);
      }

      const healthData = (await healthResponse.json()) as Qwen3TTSHealthResponse;
      this.initialized = healthData.status === 'healthy' || healthData.status === 'initializing';

      // Reset circuit breaker on successful init
      this.consecutiveFailures = 0;
      this.isInCooldown = false;
      if (this.cooldownTimer) {
        clearTimeout(this.cooldownTimer);
        this.cooldownTimer = null;
      }

      this.logger.info('Qwen3-TTS provider initialized', {
        available: this.initialized,
        serviceUrl: this.serviceUrl,
        device: healthData.device,
        customVoiceModelLoaded: healthData.custom_voice_model_loaded,
        baseModelLoaded: healthData.base_model_loaded,
        gpuAvailable: healthData.gpu_available,
        config,
      });
    } catch (error) {
      this.logger.error('Failed to initialize Qwen3-TTS provider', { error });
      this.initialized = false;
    }
  }

  async synthesize(request: TTSRequest): Promise<TTSResponse> {
    if (!this.isAvailable) {
      throw new Error('Qwen3-TTS provider not available');
    }

    const startTime = Date.now();

    try {
      this.logger.debug('Starting Qwen3-TTS synthesis', {
        textLength: request.text.length,
        voiceModelId: request.voiceModelId,
      });

      const isClone = this.isCloneVoice(request.voiceModelId);
      const endpoint = isClone ? '/clone' : '/synthesize';
      const payload = isClone
        ? this.buildClonePayload(request)
        : this.buildSynthesizePayload(request);

      const response = await fetch(`${this.serviceUrl}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `Qwen3-TTS service error: ${response.status} - ${JSON.stringify(errorData)}`
        );
      }

      const data = (await response.json()) as Qwen3TTSSynthesizeResponse;
      const duration = Date.now() - startTime;
      const cost = this.calculateCost(request.text.length);

      this.logger.debug('Qwen3-TTS synthesis completed', {
        duration,
        cost,
        audioSize: data.audio_data?.length || 0,
        deviceUsed: data.device_used,
        processingTime: data.processing_time,
      });

      this.recordSuccess();
      this.updateMetrics(duration, cost, false);
      this.updateQuotaUsage(request.text.length);

      return {
        audioData: Buffer.from(data.audio_data, 'base64'),
        format: 'wav',
        sampleRate: data.sample_rate,
        duration: data.duration * 1000,
        metadata: {
          provider: TTSProvider.QWEN3_TTS,
          voiceModelId: request.voiceModelId,
          cost,
          latency: duration,
        },
      };
    } catch (error) {
      const latency = Date.now() - startTime;
      this.recordFailure();
      this.updateMetrics(latency, 0, true);
      this.logger.error('Qwen3-TTS synthesis failed', {
        error,
        request: { text: request.text.substring(0, 50), voiceModelId: request.voiceModelId },
      });
      throw new Error(`Qwen3-TTS synthesis failed: ${(error as Error).message}`);
    }
  }

  async *synthesizeStream(request: TTSRequest): AsyncGenerator<TTSStreamChunk, void, unknown> {
    if (!this.isAvailable) {
      throw new Error('Qwen3-TTS provider not available');
    }

    try {
      this.logger.debug('Starting Qwen3-TTS streaming synthesis');

      const payload = this.buildSynthesizePayload(request);
      (payload as Record<string, unknown>).streaming = true;

      const response = await fetch(`${this.serviceUrl}/synthesize/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `Qwen3-TTS streaming error: ${response.status} - ${JSON.stringify(errorData)}`
        );
      }

      if (!response.body) {
        throw new Error('Qwen3-TTS streaming response has no body');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          const chunk = JSON.parse(trimmed) as Qwen3TTSStreamChunk;

          if (chunk.error) {
            this.recordFailure();
            throw new Error(`Qwen3-TTS stream error: ${chunk.error}`);
          }

          yield {
            chunk: Buffer.from(chunk.chunk, 'base64'),
            isLast: chunk.is_last,
            sequenceNumber: chunk.sequence_number,
            timestamp: Date.now(),
          };

          if (chunk.is_last) {
            this.recordSuccess();
            return;
          }
        }
      }
    } catch (error) {
      this.recordFailure();
      this.logger.error('Qwen3-TTS streaming failed', { error });
      throw error;
    }
  }

  async getAvailableVoices(): Promise<string[]> {
    const timbreIds = PREMIUM_TIMBRES.map((t) => `qwen3-${t.toLowerCase()}`);
    const languageIds = SUPPORTED_LANGUAGES.map((l) => `qwen3-${l}`);
    return [...timbreIds, ...languageIds];
  }

  async estimateCost(text: string, _options?: TTSOptions): Promise<number> {
    const charactersPerSecond = this.gpuEnabled ? 250 : 60;
    const computeCostPerSecond = this.gpuEnabled ? 0.0012 : 0.0001;
    const estimatedSeconds = text.length / charactersPerSecond;
    return estimatedSeconds * computeCostPerSecond;
  }

  async healthCheck(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${this.serviceUrl}/health`, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) return false;

      const data = (await response.json()) as Qwen3TTSHealthResponse;
      return data.status === 'healthy';
    } catch (error) {
      this.logger.error('Qwen3-TTS health check failed', { error });
      return false;
    }
  }

  async getMetrics(): Promise<Record<string, unknown>> {
    return {
      ...(await super.getMetrics()),
      consecutiveFailures: this.consecutiveFailures,
      isInCooldown: this.isInCooldown,
      serviceUrl: this.serviceUrl,
      gpuEnabled: this.gpuEnabled,
    };
  }

  // --- Voice model ID routing ---

  private isCloneVoice(voiceModelId?: string): boolean {
    if (!voiceModelId) return false;
    return CLONE_VOICE_PATTERN.test(voiceModelId);
  }

  isPremiumTimbre(voiceModelId?: string): boolean {
    if (!voiceModelId) return true; // default to premium
    const match = PREMIUM_TIMBRE_PATTERN.exec(voiceModelId);
    if (!match) return false;
    return PREMIUM_TIMBRES.some((t) => t.toLowerCase() === match[1].toLowerCase());
  }

  private extractTimbre(voiceModelId?: string): string {
    if (!voiceModelId) return 'Vivian';
    const match = PREMIUM_TIMBRE_PATTERN.exec(voiceModelId);
    if (!match) return 'Vivian';
    const found = PREMIUM_TIMBRES.find((t) => t.toLowerCase() === match[1].toLowerCase());
    return found || 'Vivian';
  }

  private buildSynthesizePayload(request: TTSRequest): Record<string, unknown> {
    return {
      text: request.text,
      speaker: this.extractTimbre(request.voiceModelId),
      language: request.options?.languageCode || 'en',
      instruction: request.options?.voiceName || null,
      streaming: false,
    };
  }

  private buildClonePayload(request: TTSRequest): Record<string, unknown> {
    return {
      text: request.text,
      speaker_audio: request.options?.model || '',
      language: request.options?.languageCode || 'en',
    };
  }

  private calculateCost(characterCount: number): number {
    const computeTimeSeconds = characterCount / (this.gpuEnabled ? 250 : 60);
    const costPerSecond = this.gpuEnabled ? 0.0012 : 0.0001;
    return computeTimeSeconds * costPerSecond;
  }

  // --- Circuit breaker ---

  private recordSuccess(): void {
    this.consecutiveFailures = 0;
  }

  private recordFailure(): void {
    this.consecutiveFailures++;
    if (this.consecutiveFailures >= this.maxConsecutiveFailures) {
      this.enterCooldown();
    }
  }

  private enterCooldown(): void {
    this.isInCooldown = true;
    this.logger.warn('Qwen3-TTS provider entering cooldown', {
      consecutiveFailures: this.consecutiveFailures,
      cooldownPeriodMs: this.cooldownPeriodMs,
    });

    this.cooldownTimer = setTimeout(() => {
      this.logger.info('Qwen3-TTS provider cooldown expired, attempting re-initialization');
      this.isInCooldown = false;
      this.consecutiveFailures = 0;
      this.cooldownTimer = null;
      void this.initialize();
    }, this.cooldownPeriodMs);
  }
}
