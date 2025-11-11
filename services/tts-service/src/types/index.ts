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
  // ElevenLabs specific options
  stability?: number;
  similarity_boost?: number;
  style?: number;
  use_speaker_boost?: boolean;
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
  metadata: Record<string, unknown>;
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
  successRate: number;
  averageQualityScore: number;
  quotaUsed: number;
  quotaLimit: number;
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

export interface ProviderSelectionCriteria {
  preferredProvider?: TTSProvider;
  maxCost?: number;
  maxLatency?: number;
  minQualityScore?: number;
  requireStreaming?: boolean;
  voiceModelCompatibility?: string[];
}

export interface ProviderPerformanceMetrics {
  provider: TTSProvider;
  isAvailable: boolean;
  averageLatency: number;
  successRate: number;
  averageCost: number;
  qualityScore: number;
  quotaUsage: {
    used: number;
    limit: number;
    resetDate?: Date;
  };
  lastHealthCheck: Date;
}

export interface VoiceQualityMetrics {
  similarity: number; // 0-1 score
  naturalness: number; // 0-1 score
  clarity: number; // 0-1 score
  overall: number; // 0-1 score
}

export interface ProviderQuota {
  provider: TTSProvider;
  charactersUsed: number;
  charactersLimit: number;
  requestsUsed: number;
  requestsLimit: number;
  resetDate: Date;
  isExceeded: boolean;
}
