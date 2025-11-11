import { TTSProvider } from '@clone/shared-types';

export interface TTSRequest {
  text: string;
  voiceModelId?: string;
  provider?: TTSProvider;
  options?: TTSOptions;
}

export interface TTSOptions {
  sampleRate?: number;
  speed?: number;
  pitch?: number;
  volume?: number;
  format?: 'mp3' | 'wav' | 'opus' | 'pcm';
  streaming?: boolean;
  languageCode?: string;
  voiceName?: string;
  ssmlGender?: string;
  model?: string;
}

export interface TTSResponse {
  audioData: Buffer;
  format: string;
  sampleRate: number;
  duration: number;
  metadata: {
    provider: TTSProvider;
    voiceModelId?: string;
    cost: number;
    latency: number;
  };
}

export interface TTSStreamChunk {
  chunk: Buffer;
  isLast: boolean;
  sequenceNumber: number;
  timestamp: number;
}

export interface VoiceModelMetadata {
  id: string;
  userId: string;
  provider: TTSProvider;
  modelPath: string;
  sampleRate: number;
  qualityScore: number;
  isActive: boolean;
  metadata: Record<string, any>;
}

export interface TTSProviderConfig {
  provider: TTSProvider;
  apiKey?: string;
  endpoint?: string;
  modelPath?: string;
  options?: Record<string, unknown>;
}

export interface TTSMetrics {
  requestCount: number;
  totalLatency: number;
  averageLatency: number;
  errorCount: number;
  totalCost: number;
  lastUsed: Date;
}

export interface CachedTTSResult {
  cacheKey: string;
  audioData: Buffer;
  format: string;
  sampleRate: number;
  duration: number;
  createdAt: Date;
  expiresAt: Date;
  hitCount: number;
}
