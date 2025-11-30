import { FaceModel, VideoFrame } from '@clone/shared-types';

// ============================================================================
// Lip-sync Model Types
// ============================================================================

export enum LipSyncModel {
  TPSM = 'tpsm', // Thin-Plate Spline Motion - fastest
  WAV2LIP = 'wav2lip', // High quality
  SADTALKER = 'sadtalker', // Head motion + lip-sync
  AUDIO2HEAD = 'audio2head', // Advanced facial animation
  STATIC = 'static', // Fallback - static image with animated overlay
}

export interface LipSyncModelConfig {
  model: LipSyncModel;
  priority: number; // Lower = higher priority
  maxLatencyMs: number;
  minQualityScore: number;
  gpuMemoryMb: number;
  supportsStreaming: boolean;
  supportedResolutions: Resolution[];
}

export interface Resolution {
  width: number;
  height: number;
}

// ============================================================================
// Audio Feature Types
// ============================================================================

export interface AudioFeatures {
  melSpectrogram: number[][];
  mfcc: number[];
  energy: number;
  pitch: number;
  timestamp: number;
  duration: number;
  sampleRate: number;
}

export interface AudioChunk {
  data: Buffer;
  timestamp: number;
  sequenceNumber: number;
  sampleRate: number;
  channels: number;
  format: 'pcm' | 'wav' | 'opus';
}

export interface AudioProcessingConfig {
  sampleRate: number;
  hopLength: number;
  windowLength: number;
  nMels: number;
  nMfcc: number;
  fMin: number;
  fMax: number;
}

export interface PhonemeInfo {
  phoneme: string;
  startTime: number;
  endTime: number;
  confidence: number;
}

export interface AudioQualityMetrics {
  snr: number; // Signal-to-noise ratio
  clarity: number; // 0-1
  volume: number; // dB
  hasClipping: boolean;
  silenceRatio: number;
}

// ============================================================================
// Face Model Integration Types
// ============================================================================

export interface CachedFaceModel {
  model: FaceModel;
  loadedAt: Date;
  lastAccessedAt: Date;
  memoryUsageMb: number;
  preprocessedData?: PreprocessedFaceData;
}

export interface PreprocessedFaceData {
  alignedFace: Buffer;
  landmarks: number[][];
  embedding: number[];
  textureMap?: Buffer;
  meshData?: Buffer;
}

export interface FaceModelCompatibility {
  modelId: string;
  compatibleLipSyncModels: LipSyncModel[];
  recommendedModel: LipSyncModel;
  issues: string[];
}

// ============================================================================
// Video Generation Types
// ============================================================================

export interface VideoGenerationConfig {
  targetFps: number;
  resolution: Resolution;
  format: 'jpeg' | 'h264';
  quality: number; // 0-100
  enableInterpolation: boolean;
  bufferSizeFrames: number;
}

export interface GeneratedFrame extends VideoFrame {
  sequenceNumber: number;
  lipSyncModel: LipSyncModel;
  generationTimeMs: number;
  isInterpolated: boolean;
}

export interface FrameBuffer {
  frames: GeneratedFrame[];
  startTimestamp: number;
  endTimestamp: number;
  totalDurationMs: number;
}

export interface VideoGenerationMetrics {
  framesGenerated: number;
  framesDropped: number;
  averageGenerationTimeMs: number;
  averageFps: number;
  bufferUnderruns: number;
  modelSwitches: number;
}

// ============================================================================
// Streaming Types
// ============================================================================

export interface VideoStreamConfig {
  codec: 'h264' | 'vp8' | 'vp9';
  bitrate: number;
  keyframeInterval: number;
  enableAdaptiveBitrate: boolean;
  minBitrate: number;
  maxBitrate: number;
}

export interface StreamingMetrics {
  bytesSent: number;
  packetsLost: number;
  latencyMs: number;
  jitterMs: number;
  currentBitrate: number;
}

export interface SyncState {
  audioTimestamp: number;
  videoTimestamp: number;
  offsetMs: number;
  isInSync: boolean;
  correctionApplied: boolean;
}

// ============================================================================
// Model Performance Types
// ============================================================================

export interface ModelPerformanceMetrics {
  model: LipSyncModel;
  averageLatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  successRate: number;
  qualityScore: number;
  gpuUtilization: number;
  memoryUsageMb: number;
  framesPerSecond: number;
  lastUpdated: Date;
}

export interface ModelBenchmarkResult {
  model: LipSyncModel;
  testDurationMs: number;
  framesGenerated: number;
  averageLatencyMs: number;
  maxLatencyMs: number;
  minLatencyMs: number;
  qualityScore: number;
  gpuMemoryPeakMb: number;
  isRecommended: boolean;
}

export interface ModelSelectionCriteria {
  maxLatencyMs?: number;
  minQualityScore?: number;
  preferredModel?: LipSyncModel;
  networkBandwidthKbps?: number;
  gpuAvailable?: boolean;
}

// ============================================================================
// Cache Types
// ============================================================================

export interface AudioFeatureCache {
  cacheKey: string;
  features: AudioFeatures;
  createdAt: Date;
  expiresAt: Date;
  hitCount: number;
}

export interface FrameCache {
  cacheKey: string;
  frame: GeneratedFrame;
  audioHash: string;
  faceModelId: string;
  createdAt: Date;
  expiresAt: Date;
}

// ============================================================================
// Service Request/Response Types
// ============================================================================

export interface LipSyncRequest {
  sessionId: string;
  userId: string;
  audioChunk: AudioChunk;
  faceModelId: string;
  config?: Partial<VideoGenerationConfig>;
  modelPreference?: LipSyncModel;
}

export interface LipSyncResponse {
  sessionId: string;
  frames: GeneratedFrame[];
  syncState: SyncState;
  metrics: {
    processingTimeMs: number;
    modelUsed: LipSyncModel;
    framesGenerated: number;
  };
}

export interface LipSyncServiceConfig {
  defaultModel: LipSyncModel;
  fallbackChain: LipSyncModel[];
  maxConcurrentSessions: number;
  faceModelCacheSize: number;
  audioFeatureCacheTtl: number;
  frameCacheTtl: number;
  enableAdaptiveModelSelection: boolean;
  performanceMonitoringInterval: number;
}

// ============================================================================
// Error Types
// ============================================================================

export enum LipSyncErrorCode {
  FACE_MODEL_NOT_FOUND = 'FACE_MODEL_NOT_FOUND',
  FACE_MODEL_INCOMPATIBLE = 'FACE_MODEL_INCOMPATIBLE',
  AUDIO_PROCESSING_FAILED = 'AUDIO_PROCESSING_FAILED',
  VIDEO_GENERATION_FAILED = 'VIDEO_GENERATION_FAILED',
  GPU_UNAVAILABLE = 'GPU_UNAVAILABLE',
  MODEL_LOAD_FAILED = 'MODEL_LOAD_FAILED',
  SYNC_ERROR = 'SYNC_ERROR',
  BUFFER_OVERFLOW = 'BUFFER_OVERFLOW',
  TIMEOUT = 'TIMEOUT',
}

export interface LipSyncError {
  code: LipSyncErrorCode;
  message: string;
  recoverable: boolean;
  fallbackAvailable: boolean;
  details?: Record<string, unknown>;
}
