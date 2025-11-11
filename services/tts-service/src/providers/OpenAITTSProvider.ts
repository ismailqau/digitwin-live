import { TTSProvider } from '@clone/shared-types';
import OpenAI from 'openai';
import winston from 'winston';

import { TTSRequest, TTSResponse, TTSStreamChunk, TTSOptions } from '../types';

import { BaseProvider } from './BaseProvider';

export class OpenAITTSProvider extends BaseProvider {
  private client?: OpenAI;
  private initialized = false;

  constructor(logger?: winston.Logger) {
    super(TTSProvider.OPENAI_TTS, logger);
  }

  get isAvailable(): boolean {
    return this.initialized && !!this.client;
  }

  async initialize(config: Record<string, any>): Promise<void> {
    try {
      this.config = config;

      // Initialize OpenAI client
      this.client = new OpenAI({
        apiKey: config.apiKey,
      });

      // Test the connection with a simple request
      await this.client.models.list();
      this.initialized = true;

      this.logger.info('OpenAI TTS provider initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize OpenAI TTS provider', { error });
      throw error;
    }
  }

  async synthesize(request: TTSRequest): Promise<TTSResponse> {
    if (!this.client) {
      throw new Error('OpenAI TTS provider not initialized');
    }

    const startTime = Date.now();

    try {
      const { text, voiceModelId, options = {} } = request;

      // OpenAI TTS supports specific voice names
      const voice = this.mapVoiceModel(voiceModelId, options.voiceName);
      const model = options.model || 'tts-1'; // tts-1 or tts-1-hd

      const response = await this.client.audio.speech.create({
        model,
        voice: voice as any,
        input: text,
        response_format: this.mapFormat(options.format || 'mp3'),
        speed: options.speed || 1.0,
      });

      const audioData = Buffer.from(await response.arrayBuffer());
      const latency = Date.now() - startTime;
      const cost = this.calculateCost(text.length, model);

      this.updateMetrics(latency, cost);

      return {
        audioData,
        format: options.format || 'mp3',
        sampleRate: options.sampleRate || 22050,
        duration: this.estimateDuration(text, options.speed || 1.0),
        metadata: {
          provider: this.provider,
          voiceModelId,
          cost,
          latency,
        },
      };
    } catch (error) {
      const latency = Date.now() - startTime;
      this.updateMetrics(latency, 0, true);
      this.logger.error('OpenAI TTS synthesis failed', { error, request });
      throw error;
    }
  }

  async *synthesizeStream(request: TTSRequest): AsyncGenerator<TTSStreamChunk, void, unknown> {
    // OpenAI TTS doesn't support streaming, so we'll chunk the result
    const response = await this.synthesize(request);
    const chunkSize = 4096; // 4KB chunks
    const audioData = response.audioData;

    let sequenceNumber = 0;

    for (let i = 0; i < audioData.length; i += chunkSize) {
      const chunk = audioData.slice(i, i + chunkSize);
      const isLast = i + chunkSize >= audioData.length;

      yield {
        chunk,
        isLast,
        sequenceNumber: sequenceNumber++,
        timestamp: Date.now(),
      };
    }
  }

  async getAvailableVoices(): Promise<string[]> {
    // OpenAI TTS has predefined voices
    return ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'];
  }

  async estimateCost(text: string, options?: TTSOptions): Promise<number> {
    const model = options?.model || 'tts-1';
    return this.calculateCost(text.length, model);
  }

  private mapVoiceModel(voiceModelId?: string, voiceName?: string): string {
    // Map voice model ID or voice name to OpenAI voice
    const voiceMap: Record<string, string> = {
      alloy: 'alloy',
      echo: 'echo',
      fable: 'fable',
      onyx: 'onyx',
      nova: 'nova',
      shimmer: 'shimmer',
    };

    const voice = voiceModelId || voiceName || 'alloy';
    return voiceMap[voice] || 'alloy';
  }

  private mapFormat(format: string): 'mp3' | 'opus' | 'aac' | 'flac' {
    const formatMap: Record<string, 'mp3' | 'opus' | 'aac' | 'flac'> = {
      mp3: 'mp3',
      opus: 'opus',
      aac: 'aac',
      flac: 'flac',
      wav: 'flac', // Closest to WAV
      pcm: 'flac', // Closest to PCM
    };

    return formatMap[format] || 'mp3';
  }

  private calculateCost(characterCount: number, model: string): number {
    // OpenAI TTS pricing: $15.00 per 1M characters for tts-1, $30.00 for tts-1-hd
    const pricePerCharacter = model === 'tts-1-hd' ? 30.0 / 1000000 : 15.0 / 1000000;
    return characterCount * pricePerCharacter;
  }

  private estimateDuration(text: string, speed: number): number {
    // Rough estimation: ~150 words per minute at normal speed
    const wordsPerMinute = 150 * speed;
    const wordCount = text.split(' ').length;
    return (wordCount / wordsPerMinute) * 60 * 1000; // Return in milliseconds
  }
}
