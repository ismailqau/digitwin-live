import { TTSProvider } from '@clone/shared-types';

import { TTSRequest, TTSResponse, TTSStreamChunk, TTSOptions, VoiceModelMetadata } from '../types';

export interface ITTSProvider {
  readonly provider: TTSProvider;
  readonly isAvailable: boolean;

  /**
   * Initialize the provider with configuration
   */
  initialize(config: Record<string, any>): Promise<void>;

  /**
   * Synthesize text to speech
   */
  synthesize(request: TTSRequest): Promise<TTSResponse>;

  /**
   * Stream text to speech in chunks
   */
  synthesizeStream(request: TTSRequest): AsyncGenerator<TTSStreamChunk, void, unknown>;

  /**
   * Get available voices for this provider
   */
  getAvailableVoices(): Promise<string[]>;

  /**
   * Validate voice model compatibility
   */
  validateVoiceModel(voiceModel: VoiceModelMetadata): Promise<boolean>;

  /**
   * Get provider-specific cost estimation
   */
  estimateCost(text: string, options?: TTSOptions): Promise<number>;

  /**
   * Health check for the provider
   */
  healthCheck(): Promise<boolean>;

  /**
   * Get provider metrics
   */
  getMetrics(): Promise<Record<string, any>>;
}
