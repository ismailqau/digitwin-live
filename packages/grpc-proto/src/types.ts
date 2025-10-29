/**
 * Common types for gRPC services
 */

export interface ServiceConfig {
  host: string;
  port: number;
  useTLS?: boolean;
  maxRetries?: number;
  timeout?: number;
}

export interface GrpcClientOptions {
  serviceId: string;
  serviceName: string;
  permissions: string[];
  enableAuth?: boolean;
  enableRetry?: boolean;
  enableCircuitBreaker?: boolean;
}

export enum ServiceName {
  ASR = 'asr',
  LLM = 'llm',
  RAG = 'rag',
  TTS = 'tts',
  LIPSYNC = 'lipsync',
}

export interface HealthCheckResult {
  status: string;
  version: string;
  timestamp: Date;
}
