import { config } from '@clone/config';
import { PrismaClient } from '@clone/database';
import { createLogger } from '@clone/logger';
import { TTSProvider } from '@clone/shared-types';

import { TTSCacheService } from './services/TTSCacheService';
import { TTSService } from './services/TTSService';

// TTS Service - Text-to-Speech with voice cloning
export const TTS_SERVICE_VERSION = '1.0.0';

// Export types and interfaces
export * from './types';
export * from './interfaces/ITTSProvider';
export * from './services/TTSService';
export * from './services/TTSCacheService';
export * from './services/TTSOptimizationService';
export * from './services/ProviderSelectionService';
export * from './services/VoiceModelService';
export * from './providers/GoogleCloudTTSProvider';
export * from './providers/OpenAITTSProvider';
export * from './providers/XTTSProvider';
export * from './providers/ElevenLabsProvider';

// Main service initialization
export async function createTTSService(): Promise<{
  ttsService: TTSService;
  cacheService: TTSCacheService;
}> {
  const logger = createLogger('tts-service');
  const prisma = new PrismaClient();

  // Initialize services
  const ttsService = new TTSService(logger);
  const cacheService = new TTSCacheService(prisma, logger, { ttlMedium: config.cache.ttlMedium });

  // Initialize providers based on configuration
  const providerConfigs = [
    {
      provider: TTSProvider.GOOGLE_CLOUD_TTS,
      options: {
        projectId: config.gcp.projectId,
        keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
      },
    },
    {
      provider: TTSProvider.OPENAI_TTS,
      options: {
        apiKey: config.ai.openaiApiKey,
      },
    },
    {
      provider: TTSProvider.XTTS_V2,
      options: {
        modelPath: process.env.XTTS_MODEL_PATH,
        gpuEnabled: process.env.GPU_ENABLED === 'true',
      },
    },
    {
      provider: TTSProvider.ELEVENLABS,
      options: {
        apiKey: process.env.ELEVENLABS_API_KEY,
      },
    },
  ];

  // Initialize each provider
  for (const providerConfig of providerConfigs) {
    try {
      await ttsService.initializeProvider(providerConfig);
      logger.info(`Provider ${providerConfig.provider} initialized successfully`);
    } catch (error) {
      logger.warn(`Failed to initialize provider ${providerConfig.provider}`, { error });
      // Continue with other providers
    }
  }

  return { ttsService, cacheService };
}

// Graceful shutdown handlers (for standalone mode)
if (require.main === module) {
  const shutdown = (signal: string) => {
    console.log(`${signal} received, shutting down gracefully`);
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

// Health check function
export async function healthCheck(): Promise<{
  status: 'healthy' | 'degraded' | 'unhealthy';
  providers: Record<TTSProvider, boolean>;
  cache: boolean;
}> {
  try {
    const { ttsService, cacheService } = await createTTSService();

    const providerHealth = await ttsService.healthCheck();
    const healthyProviders = Object.values(providerHealth).filter(Boolean).length;

    let status: 'healthy' | 'degraded' | 'unhealthy';
    if (healthyProviders === 0) {
      status = 'unhealthy';
    } else if (healthyProviders < Object.keys(providerHealth).length) {
      status = 'degraded';
    } else {
      status = 'healthy';
    }

    // Test cache
    let cacheHealthy = true;
    try {
      await cacheService.getStats();
    } catch {
      cacheHealthy = false;
    }

    return {
      status,
      providers: providerHealth,
      cache: cacheHealthy,
    };
  } catch {
    return {
      status: 'unhealthy',
      providers: {} as Record<TTSProvider, boolean>,
      cache: false,
    };
  }
}
