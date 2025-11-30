import { BaseError } from './base-error';

export class ASRError extends BaseError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'ASR_ERROR', 500, true, details);
  }
}

export class RAGError extends BaseError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'RAG_ERROR', 500, true, details);
  }
}

export class LLMError extends BaseError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'LLM_ERROR', 500, true, details);
  }
}

export class TTSError extends BaseError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'TTS_ERROR', 500, true, details);
  }
}

export class LipSyncError extends BaseError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'LIPSYNC_ERROR', 500, true, details);
  }
}

export class FaceProcessingError extends BaseError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'FACE_PROCESSING_ERROR', 500, true, details);
  }
}

export class FaceDetectionError extends BaseError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'FACE_DETECTION_ERROR', 400, true, details);
  }
}

export class FaceQualityError extends BaseError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'FACE_QUALITY_ERROR', 400, true, details);
  }
}

export class ConnectionError extends BaseError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'CONNECTION_ERROR', 503, true, details);
  }
}

export class TimeoutError extends BaseError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'TIMEOUT', 504, true, details);
  }
}

export class APIError extends BaseError {
  constructor(message: string, statusCode: number = 500, details?: Record<string, unknown>) {
    super(message, 'API_ERROR', statusCode, false, details);
  }
}
