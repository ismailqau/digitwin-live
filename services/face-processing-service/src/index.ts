// Face Processing Service - Face detection and model creation
export const FACE_PROCESSING_SERVICE_VERSION = '1.0.0';

// Graceful shutdown handlers (for standalone mode)
if (require.main === module) {
  const shutdown = (signal: string) => {
    console.log(`${signal} received, shutting down gracefully`);
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}
