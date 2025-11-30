// ASR Service - Automatic Speech Recognition using Google Chirp
export const ASR_SERVICE_VERSION = '1.0.0';

export { ASRService } from './asr-service';
export { ASRCacheService } from './cache';
export { ASRMetricsService } from './metrics';
export { ASRQuotaService } from './quota';
export { ASRErrorHandler, ASRError, ASRErrorCode } from './error-handler';
export { AudioPreprocessingService, audioPreprocessing } from './audio-preprocessing';
export * from './types';
export * from './config';

// Graceful shutdown handlers (for standalone mode)
if (require.main === module) {
  const shutdown = (signal: string) => {
    console.log(`${signal} received, shutting down gracefully`);
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}
