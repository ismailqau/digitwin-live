import { status as GrpcStatus } from '@grpc/grpc-js';

export enum ServiceErrorCode {
  // Client errors (4xx)
  BAD_REQUEST = 'BAD_REQUEST',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  VALIDATION_ERROR = 'VALIDATION_ERROR',

  // Server errors (5xx)
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  TIMEOUT = 'TIMEOUT',
  CIRCUIT_OPEN = 'CIRCUIT_OPEN',

  // Service-specific errors
  ASR_FAILED = 'ASR_FAILED',
  AUDIO_PROCESSING_FAILED = 'AUDIO_PROCESSING_FAILED',
  RAG_FAILED = 'RAG_FAILED',
  LLM_FAILED = 'LLM_FAILED',
  TTS_FAILED = 'TTS_FAILED',
  LIPSYNC_FAILED = 'LIPSYNC_FAILED',

  // Resource errors
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  RESOURCE_EXHAUSTED = 'RESOURCE_EXHAUSTED',
}

export class ServiceError extends Error {
  public readonly code: ServiceErrorCode;
  public readonly grpcStatus: GrpcStatus;
  public readonly serviceName: string;
  public readonly retryable: boolean;
  public readonly metadata?: Record<string, unknown>;

  constructor(
    code: ServiceErrorCode,
    message: string,
    serviceName: string,
    options?: {
      retryable?: boolean;
      metadata?: Record<string, unknown>;
      cause?: Error;
    }
  ) {
    super(message);
    this.name = 'ServiceError';
    this.code = code;
    this.serviceName = serviceName;
    this.retryable = options?.retryable ?? this.isRetryableByDefault(code);
    this.metadata = options?.metadata;
    this.grpcStatus = this.mapToGrpcStatus(code);

    if (options?.cause) {
      this.cause = options.cause;
    }

    // Maintains proper stack trace
    Error.captureStackTrace(this, this.constructor);
  }

  private isRetryableByDefault(code: ServiceErrorCode): boolean {
    const retryableCodes = [
      ServiceErrorCode.TIMEOUT,
      ServiceErrorCode.SERVICE_UNAVAILABLE,
      ServiceErrorCode.INTERNAL_ERROR,
      ServiceErrorCode.RESOURCE_EXHAUSTED,
    ];
    return retryableCodes.includes(code);
  }

  private mapToGrpcStatus(code: ServiceErrorCode): GrpcStatus {
    const mapping: Record<ServiceErrorCode, GrpcStatus> = {
      [ServiceErrorCode.BAD_REQUEST]: GrpcStatus.INVALID_ARGUMENT,
      [ServiceErrorCode.UNAUTHORIZED]: GrpcStatus.UNAUTHENTICATED,
      [ServiceErrorCode.FORBIDDEN]: GrpcStatus.PERMISSION_DENIED,
      [ServiceErrorCode.NOT_FOUND]: GrpcStatus.NOT_FOUND,
      [ServiceErrorCode.CONFLICT]: GrpcStatus.ALREADY_EXISTS,
      [ServiceErrorCode.VALIDATION_ERROR]: GrpcStatus.INVALID_ARGUMENT,
      [ServiceErrorCode.INTERNAL_ERROR]: GrpcStatus.INTERNAL,
      [ServiceErrorCode.SERVICE_UNAVAILABLE]: GrpcStatus.UNAVAILABLE,
      [ServiceErrorCode.TIMEOUT]: GrpcStatus.DEADLINE_EXCEEDED,
      [ServiceErrorCode.CIRCUIT_OPEN]: GrpcStatus.UNAVAILABLE,
      [ServiceErrorCode.ASR_FAILED]: GrpcStatus.INTERNAL,
      [ServiceErrorCode.AUDIO_PROCESSING_FAILED]: GrpcStatus.INTERNAL,
      [ServiceErrorCode.RAG_FAILED]: GrpcStatus.INTERNAL,
      [ServiceErrorCode.LLM_FAILED]: GrpcStatus.INTERNAL,
      [ServiceErrorCode.TTS_FAILED]: GrpcStatus.INTERNAL,
      [ServiceErrorCode.LIPSYNC_FAILED]: GrpcStatus.INTERNAL,
      [ServiceErrorCode.RATE_LIMIT_EXCEEDED]: GrpcStatus.RESOURCE_EXHAUSTED,
      [ServiceErrorCode.QUOTA_EXCEEDED]: GrpcStatus.RESOURCE_EXHAUSTED,
      [ServiceErrorCode.RESOURCE_EXHAUSTED]: GrpcStatus.RESOURCE_EXHAUSTED,
    };

    return mapping[code] || GrpcStatus.UNKNOWN;
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      serviceName: this.serviceName,
      retryable: this.retryable,
      grpcStatus: this.grpcStatus,
      metadata: this.metadata,
    };
  }
}

/**
 * Audio Processing Error
 * Specialized error for audio preprocessing and enhancement operations
 */
export class AudioProcessingError extends ServiceError {
  constructor(
    message: string,
    options?: {
      retryable?: boolean;
      metadata?: Record<string, unknown>;
      cause?: Error;
    }
  ) {
    super(ServiceErrorCode.AUDIO_PROCESSING_FAILED, message, 'audio-preprocessing', options);
    this.name = 'AudioProcessingError';
  }
}
