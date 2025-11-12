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
    cached?: boolean;
    originalCost?: number;
    originalLatency?: number;
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

// ============================================================================
// Voice Model Training Types
// ============================================================================

export interface TrainingJobRequest {
  userId: string;
  voiceSampleIds: string[];
  provider: TTSProvider;
  priority?: number;
  options?: TrainingOptions;
}

export interface TrainingOptions {
  epochs?: number;
  batchSize?: number;
  learningRate?: number;
  validationSplit?: number;
  earlyStoppingPatience?: number;
  modelArchitecture?: string;
  augmentationEnabled?: boolean;
  qualityThreshold?: number;
  maxTrainingTimeMs?: number;
}

export interface TrainingJobStatus {
  id: string;
  userId: string;
  status: TrainingStatus;
  progress: number;
  estimatedCost: number;
  actualCost?: number;
  estimatedTimeMs: number;
  actualTimeMs?: number;
  startedAt?: Date;
  completedAt?: Date;
  failedAt?: Date;
  cancelledAt?: Date;
  errorMessage?: string;
  retryCount: number;
  maxRetries: number;
  priority: number;
  gpuNodeId?: string;
  logs: TrainingLogEntry[];
  qualityMetrics?: VoiceQualityMetrics;
  createdAt: Date;
  updatedAt: Date;
}

export enum TrainingStatus {
  QUEUED = 'queued',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export interface TrainingLogEntry {
  timestamp: Date;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  metadata?: Record<string, unknown>;
}

export interface TrainingProgress {
  jobId: string;
  progress: number;
  stage: TrainingStage;
  currentEpoch?: number;
  totalEpochs?: number;
  loss?: number;
  validationLoss?: number;
  estimatedTimeRemainingMs?: number;
  gpuUtilization?: number;
  memoryUsage?: number;
}

export enum TrainingStage {
  INITIALIZING = 'initializing',
  PREPROCESSING = 'preprocessing',
  TRAINING = 'training',
  VALIDATING = 'validating',
  POSTPROCESSING = 'postprocessing',
  FINALIZING = 'finalizing',
}

export interface TrainingCostEstimate {
  provider: TTSProvider;
  estimatedCost: number;
  estimatedTimeMs: number;
  gpuHours: number;
  storageGb: number;
  breakdown: {
    compute: number;
    storage: number;
    dataTransfer: number;
    apiCalls: number;
  };
}

export interface TrainingValidationResult {
  isValid: boolean;
  qualityScore: number;
  issues: string[];
  recommendations: string[];
  metrics: {
    similarity: number;
    naturalness: number;
    clarity: number;
    consistency: number;
  };
}

export interface TrainingJobData {
  voiceSamplePaths: string[];
  outputModelPath: string;
  provider: TTSProvider;
  options: TrainingOptions;
  userId: string;
  estimatedCost: number;
  estimatedTimeMs: number;
}

export interface TrainingNotification {
  jobId: string;
  userId: string;
  type: 'started' | 'progress' | 'completed' | 'failed' | 'cancelled';
  message: string;
  progress?: number;
  data?: Record<string, unknown>;
}

export interface GPUNodeInfo {
  nodeId: string;
  isAvailable: boolean;
  gpuType: string;
  memoryGb: number;
  utilizationPercent: number;
  currentJobs: string[];
  maxConcurrentJobs: number;
}
