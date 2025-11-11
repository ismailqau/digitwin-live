import { createLogger } from '@clone/logger';
import { TTSProvider } from '@clone/shared-types';
import express, { Express } from 'express';

import { TTSCacheService } from './services/TTSCacheService';
import { TTSService } from './services/TTSService';
import { TTSRequest } from './types';

import { createTTSService, healthCheck } from './index';

const app: Express = express();
const logger = createLogger('tts-server');
const port = process.env.PORT || 3005;

app.use(express.json());

// Health check endpoint
app.get('/health', async (_req, res) => {
  try {
    const health = await healthCheck();
    res.status(health.status === 'healthy' ? 200 : 503).json(health);
  } catch (error) {
    logger.error('Health check failed', { error });
    res.status(503).json({ status: 'unhealthy', error: (error as Error).message });
  }
});

// Initialize services
let ttsService: TTSService;
let cacheService: TTSCacheService;

async function initializeServices() {
  try {
    const services = await createTTSService();
    ttsService = services.ttsService;
    cacheService = services.cacheService;
    logger.info('TTS services initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize TTS services', { error });
    process.exit(1);
  }
}

// TTS synthesis endpoint
app.post('/synthesize', async (req, res) => {
  try {
    if (!ttsService) {
      return res.status(503).json({ error: 'TTS service not initialized' });
    }

    const request: TTSRequest = req.body;

    // Validate request
    if (!request.text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    // Check cache first
    const cached = await cacheService.get(request);
    if (cached) {
      logger.info('Serving cached TTS result');
      return res.json({
        ...cached,
        audioData: cached.audioData.toString('base64'),
        cached: true,
      });
    }

    // Synthesize
    const response = await ttsService.synthesize(request);

    // Cache the result
    await cacheService.set(request, response);

    return res.json({
      ...response,
      audioData: response.audioData.toString('base64'),
      cached: false,
    });
  } catch (error) {
    logger.error('TTS synthesis failed', { error, request: req.body });
    return res.status(500).json({ error: (error as Error).message });
  }
});

// TTS streaming endpoint
app.post('/synthesize/stream', async (req, res) => {
  try {
    if (!ttsService) {
      return res.status(503).json({ error: 'TTS service not initialized' });
    }

    const request: TTSRequest = req.body;

    // Validate request
    if (!request.text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Transfer-Encoding': 'chunked',
    });

    try {
      for await (const chunk of ttsService.synthesizeStream(request)) {
        const data = {
          chunk: chunk.chunk.toString('base64'),
          isLast: chunk.isLast,
          sequenceNumber: chunk.sequenceNumber,
          timestamp: chunk.timestamp,
        };
        res.write(JSON.stringify(data) + '\n');
      }
    } catch (streamError) {
      res.write(JSON.stringify({ error: (streamError as Error).message }) + '\n');
    }

    res.end();
    return;
  } catch (error) {
    logger.error('TTS streaming failed', { error, request: req.body });
    if (!res.headersSent) {
      res.status(500).json({ error: (error as Error).message });
    }
    return;
  }
});

// Get available voices
app.get('/voices', async (req, res) => {
  try {
    if (!ttsService) {
      return res.status(503).json({ error: 'TTS service not initialized' });
    }

    const provider = req.query.provider as TTSProvider;
    const voices = await ttsService.getAvailableVoices(provider);
    return res.json(voices);
  } catch (error) {
    logger.error('Failed to get available voices', { error });
    return res.status(500).json({ error: (error as Error).message });
  }
});

// Estimate cost
app.post('/estimate-cost', async (req, res) => {
  try {
    if (!ttsService) {
      return res.status(503).json({ error: 'TTS service not initialized' });
    }

    const { text, provider } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    const costs = await ttsService.estimateCost(text, provider);
    return res.json(costs);
  } catch (error) {
    logger.error('Failed to estimate cost', { error });
    return res.status(500).json({ error: (error as Error).message });
  }
});

// Get provider metrics
app.get('/metrics', async (_req, res) => {
  try {
    if (!ttsService) {
      return res.status(503).json({ error: 'TTS service not initialized' });
    }

    const metrics = await ttsService.getProviderMetrics();
    const performanceMetrics = ttsService.getProviderPerformanceMetrics();
    const cacheStats = await cacheService.getStats();

    return res.json({
      providers: metrics,
      performance: Object.fromEntries(performanceMetrics),
      cache: cacheStats,
    });
  } catch (error) {
    logger.error('Failed to get metrics', { error });
    return res.status(500).json({ error: (error as Error).message });
  }
});

// Compare costs across providers
app.post('/compare-costs', async (req, res) => {
  try {
    if (!ttsService) {
      return res.status(503).json({ error: 'TTS service not initialized' });
    }

    const { text } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    const costs = await ttsService.compareCosts(text);
    return res.json(Object.fromEntries(costs));
  } catch (error) {
    logger.error('Failed to compare costs', { error });
    return res.status(500).json({ error: (error as Error).message });
  }
});

// Get quota usage
app.get('/quota', async (_req, res) => {
  try {
    if (!ttsService) {
      return res.status(503).json({ error: 'TTS service not initialized' });
    }

    const quotas = await ttsService.getQuotaUsage();
    return res.json(quotas);
  } catch (error) {
    logger.error('Failed to get quota usage', { error });
    return res.status(500).json({ error: (error as Error).message });
  }
});

// Validate voice model compatibility
app.post('/validate-voice-model', async (req, res) => {
  try {
    if (!ttsService) {
      return res.status(503).json({ error: 'TTS service not initialized' });
    }

    const voiceModel = req.body;

    if (!voiceModel || !voiceModel.id) {
      return res.status(400).json({ error: 'Voice model data is required' });
    }

    const compatibility = await ttsService.validateVoiceModelCompatibility(voiceModel);
    return res.json(Object.fromEntries(compatibility));
  } catch (error) {
    logger.error('Failed to validate voice model compatibility', { error });
    return res.status(500).json({ error: (error as Error).message });
  }
});

// Cache management endpoints
app.delete('/cache', async (_req, res) => {
  try {
    if (!cacheService) {
      return res.status(503).json({ error: 'Cache service not initialized' });
    }

    const deletedCount = await cacheService.cleanup();
    return res.json({ deletedCount });
  } catch (error) {
    logger.error('Failed to cleanup cache', { error });
    return res.status(500).json({ error: (error as Error).message });
  }
});

// Start server
async function startServer() {
  await initializeServices();

  app.listen(port, () => {
    logger.info(`TTS service listening on port ${port}`);
  });
}

if (require.main === module) {
  startServer().catch((error) => {
    logger.error('Failed to start server', { error });
    process.exit(1);
  });
}

export { app, startServer };
