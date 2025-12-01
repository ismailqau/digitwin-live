/* eslint-disable @typescript-eslint/no-explicit-any */
import { TTSProvider } from '@clone/shared-types';
import winston from 'winston';

import { TTSRequest, TTSResponse, TTSStreamChunk, TTSOptions } from '../types';

import { BaseProvider } from './BaseProvider';

export class ElevenLabsProvider extends BaseProvider {
  private apiKey?: string;
  private initialized = false;
  private baseUrl = 'https://api.elevenlabs.io/v1';

  constructor(logger?: winston.Logger) {
    super(TTSProvider.ELEVENLABS, logger);
  }

  get isAvailable(): boolean {
    return this.initialized && !!this.apiKey;
  }

  async initialize(config: Record<string, any>): Promise<void> {
    try {
      this.config = config;
      this.apiKey = config.apiKey;

      if (!this.apiKey) {
        throw new Error('ElevenLabs API key is required');
      }

      // Test the connection
      await this.testConnection();
      this.initialized = true;

      this.logger.info('ElevenLabs TTS provider initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize ElevenLabs TTS provider', { error });
      throw error;
    }
  }

  async synthesize(request: TTSRequest): Promise<TTSResponse> {
    if (!this.apiKey) {
      throw new Error('ElevenLabs TTS provider not initialized');
    }

    const startTime = Date.now();

    try {
      const { text, voiceModelId, options = {} } = request;

      // Use voice model ID or default voice
      const voiceId = voiceModelId || 'pNInz6obpgDQGcFmaJgB'; // Default Adam voice

      const requestBody = {
        text,
        model_id: options.model || 'eleven_monolingual_v1',
        voice_settings: {
          stability: options.stability || 0.5,
          similarity_boost: options.similarity_boost || 0.5,
          style: options.style || 0.0,
          use_speaker_boost: options.use_speaker_boost || true,
        },
      };

      const response = await fetch(`${this.baseUrl}/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: {
          Accept: 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': this.apiKey,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
      }

      const audioData = Buffer.from(await response.arrayBuffer());
      const latency = Date.now() - startTime;
      const cost = this.calculateCost(text.length);

      this.updateMetrics(latency, cost);
      this.updateQuotaUsage(text.length);

      return {
        audioData,
        format: 'mp3',
        sampleRate: 22050,
        duration: this.estimateDuration(text, 1.0),
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
      this.logger.error('ElevenLabs TTS synthesis failed', { error, request });
      throw error;
    }
  }

  async *synthesizeStream(request: TTSRequest): AsyncGenerator<TTSStreamChunk, void, unknown> {
    if (!this.apiKey) {
      throw new Error('ElevenLabs TTS provider not initialized');
    }

    const { text, voiceModelId, options = {} } = request;
    const voiceId = voiceModelId || 'pNInz6obpgDQGcFmaJgB';

    try {
      const requestBody = {
        text,
        model_id: options.model || 'eleven_monolingual_v1',
        voice_settings: {
          stability: options.stability || 0.5,
          similarity_boost: options.similarity_boost || 0.5,
          style: options.style || 0.0,
          use_speaker_boost: options.use_speaker_boost || true,
        },
      };

      const response = await fetch(`${this.baseUrl}/text-to-speech/${voiceId}/stream`, {
        method: 'POST',
        headers: {
          Accept: 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': this.apiKey,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ElevenLabs streaming API error: ${response.status} - ${errorText}`);
      }

      if (!response.body) {
        throw new Error('No response body received from ElevenLabs streaming API');
      }

      const reader = response.body.getReader();
      let sequenceNumber = 0;

      try {
        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            break;
          }

          yield {
            chunk: Buffer.from(value),
            isLast: false,
            sequenceNumber: sequenceNumber++,
            timestamp: Date.now(),
          };
        }

        // Send final chunk
        yield {
          chunk: Buffer.alloc(0),
          isLast: true,
          sequenceNumber: sequenceNumber++,
          timestamp: Date.now(),
        };
      } finally {
        reader.releaseLock();
      }
    } catch (error) {
      this.logger.error('ElevenLabs TTS streaming failed', { error, request });
      throw error;
    }
  }

  async getAvailableVoices(): Promise<string[]> {
    if (!this.apiKey) {
      throw new Error('ElevenLabs TTS provider not initialized');
    }

    try {
      const response = await fetch(`${this.baseUrl}/voices`, {
        headers: {
          'xi-api-key': this.apiKey,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to get voices: ${response.status}`);
      }

      const data = (await response.json()) as { voices?: Array<{ voice_id: string }> };
      return data.voices?.map((voice) => voice.voice_id) || [];
    } catch (error) {
      this.logger.error('Failed to get available voices from ElevenLabs', { error });
      throw error;
    }
  }

  async estimateCost(text: string, _options?: TTSOptions): Promise<number> {
    return this.calculateCost(text.length);
  }

  async healthCheck(): Promise<boolean> {
    try {
      if (!this.apiKey) {
        return false;
      }

      const response = await fetch(`${this.baseUrl}/user`, {
        headers: {
          'xi-api-key': this.apiKey,
        },
      });

      return response.ok;
    } catch (error) {
      this.logger.error('ElevenLabs health check failed', { error });
      return false;
    }
  }

  private async testConnection(): Promise<void> {
    const response = await fetch(`${this.baseUrl}/user`, {
      headers: {
        'xi-api-key': this.apiKey!,
      },
    });

    if (!response.ok) {
      throw new Error(`ElevenLabs API test failed: ${response.status}`);
    }
  }

  private calculateCost(characterCount: number): number {
    // ElevenLabs pricing: approximately $0.30 per 1K characters for standard voices
    const pricePerCharacter = 0.3 / 1000;
    return characterCount * pricePerCharacter;
  }

  private estimateDuration(text: string, speed: number): number {
    // Rough estimation: ~150 words per minute at normal speed
    const wordsPerMinute = 150 * speed;
    const wordCount = text.split(' ').length;
    return (wordCount / wordsPerMinute) * 60 * 1000; // Return in milliseconds
  }
}
