// Re-export face types from shared-types
export * from '@clone/shared-types';

// Service-specific types
export interface ImageMetadata {
  width: number;
  height: number;
  format: string;
  channels: number;
  hasAlpha: boolean;
}

export interface ProcessedImage {
  buffer: Buffer;
  metadata: ImageMetadata;
  originalPath?: string;
}

export interface FaceProcessingJobData {
  userId: string;
  requestId: string;
  mediaType: 'image' | 'video';
  storagePath: string;
  config?: {
    minConfidence?: number;
    maxFaces?: number;
    enableLandmarks?: boolean;
  };
}

export interface FaceProcessingJobResult {
  requestId: string;
  status: 'completed' | 'failed';
  resultPath?: string;
  error?: string;
  processingTimeMs: number;
}
