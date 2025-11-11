import { TTSProvider } from '@clone/shared-types';
import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import winston from 'winston';

import { TTSRequest, TTSResponse, TTSStreamChunk, TTSOptions } from '../types';

import { BaseProvider } from './BaseProvider';

export class GoogleCloudTTSProvider extends BaseProvider {
  private client?: TextToSpeechClient;
  private initialized = false;

  constructor(logger?: winston.Logger) {
    super(TTSProvider.GOOGLE_CLOUD_TTS, logger);
  }

  get isAvailable(): boolean {
    return this.initialized && !!this.client;
  }

  async initialize(config: Record<string, any>): Promise<void> {
    try {
      this.config = config;

      // Initialize Google Cloud TTS client
      this.client = new TextToSpeechClient({
        projectId: config.projectId,
        keyFilename: config.keyFilename,
      });

      // Test the connection
      await this.client.listVoices({});
      this.initialized = true;

      this.logger.info('Google Cloud TTS provider initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Google Cloud TTS provider', { error });
      throw error;
    }
  }

  async synthesize(request: TTSRequest): Promise<TTSResponse> {
    if (!this.client) {
      throw new Error('Google Cloud TTS provider not initialized');
    }

    const startTime = Date.now();

    try {
      const { text, voiceModelId, options = {} } = request;

      // Configure synthesis request
      const synthesisRequest = {
        input: { text },
        voice: {
          languageCode: options.languageCode || 'en-US',
          name: voiceModelId || options.voiceName || 'en-US-Neural2-A',
          ssmlGender: (options.ssmlGender as any) || 'NEUTRAL',
        },
        audioConfig: {
          audioEncoding: this.getAudioEncoding(options.format || 'mp3'),
          sampleRateHertz: options.sampleRate || 22050,
          speakingRate: options.speed || 1.0,
          pitch: options.pitch || 0.0,
          volumeGainDb: options.volume || 0.0,
        },
      };

      const [response] = await this.client.synthesizeSpeech(synthesisRequest as any);

      if (!response.audioContent) {
        throw new Error('No audio content received from Google Cloud TTS');
      }

      const audioData = Buffer.from(response.audioContent);
      const latency = Date.now() - startTime;
      const cost = this.calculateCost(text.length);

      this.updateMetrics(latency, cost);
      this.updateQuotaUsage(text.length);

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
      this.logger.error('Google Cloud TTS synthesis failed', { error, request });
      throw error;
    }
  }

  async *synthesizeStream(request: TTSRequest): AsyncGenerator<TTSStreamChunk, void, unknown> {
    // Google Cloud TTS doesn't support streaming, so we'll chunk the result
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
    if (!this.client) {
      throw new Error('Google Cloud TTS provider not initialized');
    }

    try {
      const [response] = await this.client.listVoices({});
      return response.voices?.map((voice) => voice.name || '') || [];
    } catch (error) {
      this.logger.error('Failed to get available voices', { error });
      throw error;
    }
  }

  async estimateCost(text: string, _options?: TTSOptions): Promise<number> {
    return this.calculateCost(text.length);
  }

  private getAudioEncoding(format: string): any {
    const encodingMap: Record<string, any> = {
      mp3: 'MP3',
      wav: 'LINEAR16',
      opus: 'OGG_OPUS',
      pcm: 'LINEAR16',
    };

    return encodingMap[format] || 'MP3';
  }

  private calculateCost(characterCount: number): number {
    // Google Cloud TTS pricing: $4.00 per 1M characters for Neural2 voices
    const pricePerCharacter = 4.0 / 1000000;
    return characterCount * pricePerCharacter;
  }

  private estimateDuration(text: string, speed: number): number {
    // Rough estimation: ~150 words per minute at normal speed
    const wordsPerMinute = 150 * speed;
    const wordCount = text.split(' ').length;
    return (wordCount / wordsPerMinute) * 60 * 1000; // Return in milliseconds
  }
}
