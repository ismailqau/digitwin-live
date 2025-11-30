// Lip-sync Service - Video generation with lip synchronization
export const LIPSYNC_SERVICE_VERSION = '1.0.0';

// Export types
export * from './types';

// Export services
export * from './services';

// Graceful shutdown handlers (for standalone mode)
if (require.main === module) {
  const shutdown = (signal: string) => {
    console.log(`${signal} received, shutting down gracefully`);
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}
