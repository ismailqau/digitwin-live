/**
 * Job queue types and interfaces
 */

export enum JobType {
  DOCUMENT_PROCESSING = 'document-processing',
  VOICE_MODEL_TRAINING = 'voice-model-training',
  FACE_MODEL_CREATION = 'face-model-creation',
  CACHE_CLEANUP = 'cache-cleanup',
}

export enum JobStatus {
  QUEUED = 'queued',
  ACTIVE = 'active',
  COMPLETED = 'completed',
  FAILED = 'failed',
  DELAYED = 'delayed',
  WAITING = 'waiting',
}

export enum JobPriority {
  LOW = 1,
  NORMAL = 50,
  HIGH = 75,
  CRITICAL = 100,
}

export interface JobData {
  userId: string;
  [key: string]: unknown;
}

export interface DocumentProcessingJobData extends JobData {
  documentId: string;
  filename: string;
  storagePath: string;
  contentType: string;
}

export interface VoiceModelTrainingJobData extends JobData {
  trainingJobId: string;
  voiceSampleIds: string[];
  provider: string;
  settings?: Record<string, unknown>;
}

export interface FaceModelCreationJobData extends JobData {
  faceModelId: string;
  mediaType: 'images' | 'video';
  storagePaths: string[];
  settings?: Record<string, unknown>;
}

export interface CacheCleanupJobData {
  cacheTypes?: string[];
}

export interface JobOptions {
  priority?: JobPriority;
  delay?: number; // Delay in milliseconds
  attempts?: number; // Number of retry attempts
  backoff?: {
    type: 'exponential' | 'fixed';
    delay: number;
  };
  removeOnComplete?: boolean | number; // Keep last N completed jobs
  removeOnFail?: boolean | number; // Keep last N failed jobs
}

export interface JobProgress {
  percentage: number;
  message?: string;
  data?: Record<string, unknown>;
}

export interface JobResult {
  success: boolean;
  data?: unknown;
  error?: string;
}
