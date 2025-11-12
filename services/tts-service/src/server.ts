import { createLogger } from '@clone/logger';
import { TTSProvider } from '@clone/shared-types';
import express, { Express } from 'express';

import { TrainingJobQueue } from './services/TrainingJobQueue';
import { TTSCacheService } from './services/TTSCacheService';
import { TTSService } from './services/TTSService';
import { VoiceModelService } from './services/VoiceModelService';
import { TTSRequest } from './types';
import { TrainingJobRequest } from './types';

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
let trainingQueue: TrainingJobQueue;
let voiceModelService: VoiceModelService;

async function initializeServices() {
  try {
    const services = await createTTSService();
    ttsService = services.ttsService;
    cacheService = services.cacheService;

    // Initialize training queue and voice model service
    const { PrismaClient } = await import('@clone/database');
    const prisma = new PrismaClient();
    trainingQueue = new TrainingJobQueue(prisma, logger);
    voiceModelService = new VoiceModelService(prisma, logger);

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

// TTS synthesis with optimization endpoint
app.post('/synthesize/optimized', async (req, res) => {
  try {
    if (!ttsService) {
      return res.status(503).json({ error: 'TTS service not initialized' });
    }

    const { request, qualityConfig, criteria } = req.body;

    // Validate request
    if (!request?.text) {
      return res.status(400).json({ error: 'Request with text is required' });
    }

    if (!qualityConfig) {
      return res.status(400).json({ error: 'Quality configuration is required' });
    }

    // Check cache first
    const cached = await cacheService.get(request);
    if (cached) {
      logger.info('Serving cached optimized TTS result');
      return res.json({
        ...cached,
        audioData: cached.audioData.toString('base64'),
        cached: true,
        optimizations: ['Cache hit - no optimization needed'],
      });
    }

    // Synthesize with optimization
    const response = await ttsService.synthesizeOptimized(request, qualityConfig, criteria);

    // Cache the result
    await cacheService.set(request, response);

    return res.json({
      ...response,
      audioData: response.audioData.toString('base64'),
      cached: false,
    });
  } catch (error) {
    logger.error('Optimized TTS synthesis failed', { error, request: req.body });
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

// Text analysis endpoint
app.post('/analyze-text', async (req, res) => {
  try {
    if (!ttsService) {
      return res.status(503).json({ error: 'TTS service not initialized' });
    }

    const { text } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    const analysis = ttsService.analyzeText(text);
    return res.json(analysis);
  } catch (error) {
    logger.error('Failed to analyze text', { error });
    return res.status(500).json({ error: (error as Error).message });
  }
});

// Get optimization metrics
app.get('/optimization/metrics', async (_req, res) => {
  try {
    if (!ttsService) {
      return res.status(503).json({ error: 'TTS service not initialized' });
    }

    const metrics = ttsService.getOptimizationMetrics();
    return res.json({
      providerCapabilities: Object.fromEntries(metrics.providerCapabilities),
      recommendedConfigs: metrics.recommendedConfigs,
    });
  } catch (error) {
    logger.error('Failed to get optimization metrics', { error });
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

// Cache optimization endpoint
app.post('/cache/optimize', async (_req, res) => {
  try {
    if (!cacheService) {
      return res.status(503).json({ error: 'Cache service not initialized' });
    }

    const result = await cacheService.optimizeCache();
    return res.json(result);
  } catch (error) {
    logger.error('Failed to optimize cache', { error });
    return res.status(500).json({ error: (error as Error).message });
  }
});

// Cache cost savings endpoint
app.get('/cache/savings', async (_req, res) => {
  try {
    if (!cacheService) {
      return res.status(503).json({ error: 'Cache service not initialized' });
    }

    const savings = await cacheService.getCostSavings();
    return res.json(savings);
  } catch (error) {
    logger.error('Failed to get cache savings', { error });
    return res.status(500).json({ error: (error as Error).message });
  }
});

// Pregenerate common phrases endpoint
app.post('/cache/pregenerate', async (req, res) => {
  try {
    if (!cacheService || !ttsService) {
      return res.status(503).json({ error: 'Services not initialized' });
    }

    const { voiceModelId, provider } = req.body;

    const synthesizeFunction = async (request: TTSRequest) => {
      return await ttsService.synthesize(request);
    };

    const count = await cacheService.pregenerateCommonPhrases(
      synthesizeFunction,
      voiceModelId,
      provider
    );

    return res.json({ pregeneratedCount: count });
  } catch (error) {
    logger.error('Failed to pregenerate common phrases', { error });
    return res.status(500).json({ error: (error as Error).message });
  }
});

// Warm cache endpoint
app.post('/cache/warm', async (req, res) => {
  try {
    if (!cacheService || !ttsService) {
      return res.status(503).json({ error: 'Services not initialized' });
    }

    const { phrases, voiceModelId, provider } = req.body;

    if (!phrases || !Array.isArray(phrases)) {
      return res.status(400).json({ error: 'Phrases array is required' });
    }

    const synthesizeFunction = async (request: TTSRequest) => {
      return await ttsService.synthesize(request);
    };

    const count = await cacheService.warmCache(phrases, synthesizeFunction, voiceModelId, provider);

    return res.json({ warmedCount: count });
  } catch (error) {
    logger.error('Failed to warm cache', { error });
    return res.status(500).json({ error: (error as Error).message });
  }
});

// Get common phrases endpoint
app.get('/cache/common-phrases', async (req, res) => {
  try {
    if (!cacheService) {
      return res.status(503).json({ error: 'Cache service not initialized' });
    }

    const limit = parseInt(req.query.limit as string) || 50;
    const phrases = await cacheService.getCommonPhrases(limit);

    return res.json({ phrases });
  } catch (error) {
    logger.error('Failed to get common phrases', { error });
    return res.status(500).json({ error: (error as Error).message });
  }
});

// ============================================================================
// Voice Model Management Endpoints
// ============================================================================

// Create voice model
app.post('/voice-models', async (req, res) => {
  try {
    if (!voiceModelService) {
      return res.status(503).json({ error: 'Voice model service not initialized' });
    }

    const { userId, provider, modelPath, sampleRate, qualityScore, metadata } = req.body;

    if (!userId || !provider || !modelPath) {
      return res.status(400).json({
        error: 'userId, provider, and modelPath are required',
      });
    }

    const voiceModel = await voiceModelService.createVoiceModel({
      userId,
      provider,
      modelPath,
      sampleRate,
      qualityScore,
      metadata,
    });

    return res.status(201).json(voiceModel);
  } catch (error) {
    logger.error('Failed to create voice model', { error, request: req.body });
    return res.status(500).json({ error: (error as Error).message });
  }
});

// Get user's voice models
app.get('/voice-models/user/:userId', async (req, res) => {
  try {
    if (!voiceModelService) {
      return res.status(503).json({ error: 'Voice model service not initialized' });
    }

    const { userId } = req.params;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;

    const filters: any = {};
    if (req.query.provider) filters.provider = req.query.provider;
    if (req.query.isActive !== undefined) filters.isActive = req.query.isActive === 'true';
    if (req.query.minQualityScore)
      filters.minQualityScore = parseFloat(req.query.minQualityScore as string);

    const result = await voiceModelService.getUserVoiceModels(userId, filters, limit, offset);

    return res.json({
      models: result.models,
      pagination: {
        limit,
        offset,
        total: result.total,
      },
    });
  } catch (error) {
    logger.error('Failed to get user voice models', { error, userId: req.params.userId });
    return res.status(500).json({ error: (error as Error).message });
  }
});

// Get specific voice model
app.get('/voice-models/:id', async (req, res) => {
  try {
    if (!voiceModelService) {
      return res.status(503).json({ error: 'Voice model service not initialized' });
    }

    const { id } = req.params;
    const { userId } = req.query;

    const voiceModel = await voiceModelService.getVoiceModel(id, userId as string);

    if (!voiceModel) {
      return res.status(404).json({ error: 'Voice model not found' });
    }

    return res.json(voiceModel);
  } catch (error) {
    logger.error('Failed to get voice model', { error, id: req.params.id });
    return res.status(500).json({ error: (error as Error).message });
  }
});

// Update voice model
app.put('/voice-models/:id', async (req, res) => {
  try {
    if (!voiceModelService) {
      return res.status(503).json({ error: 'Voice model service not initialized' });
    }

    const { id } = req.params;
    const { userId, ...updates } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const updatedModel = await voiceModelService.updateVoiceModel(id, userId, updates);

    return res.json(updatedModel);
  } catch (error) {
    logger.error('Failed to update voice model', { error, id: req.params.id });
    return res.status(500).json({ error: (error as Error).message });
  }
});

// Delete voice model
app.delete('/voice-models/:id', async (req, res) => {
  try {
    if (!voiceModelService) {
      return res.status(503).json({ error: 'Voice model service not initialized' });
    }

    const { id } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    await voiceModelService.deleteVoiceModel(id, userId);

    return res.json({ success: true, message: 'Voice model deleted successfully' });
  } catch (error) {
    logger.error('Failed to delete voice model', { error, id: req.params.id });
    return res.status(500).json({ error: (error as Error).message });
  }
});

// Activate voice model
app.post('/voice-models/:id/activate', async (req, res) => {
  try {
    if (!voiceModelService) {
      return res.status(503).json({ error: 'Voice model service not initialized' });
    }

    const { id } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const activatedModel = await voiceModelService.activateVoiceModel(id, userId);

    return res.json(activatedModel);
  } catch (error) {
    logger.error('Failed to activate voice model', { error, id: req.params.id });
    return res.status(500).json({ error: (error as Error).message });
  }
});

// Deactivate voice model
app.post('/voice-models/:id/deactivate', async (req, res) => {
  try {
    if (!voiceModelService) {
      return res.status(503).json({ error: 'Voice model service not initialized' });
    }

    const { id } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const deactivatedModel = await voiceModelService.deactivateVoiceModel(id, userId);

    return res.json(deactivatedModel);
  } catch (error) {
    logger.error('Failed to deactivate voice model', { error, id: req.params.id });
    return res.status(500).json({ error: (error as Error).message });
  }
});

// Get active voice model
app.get('/voice-models/user/:userId/active', async (req, res) => {
  try {
    if (!voiceModelService) {
      return res.status(503).json({ error: 'Voice model service not initialized' });
    }

    const { userId } = req.params;

    const activeModel = await voiceModelService.getActiveVoiceModel(userId);

    if (!activeModel) {
      return res.status(404).json({ error: 'No active voice model found' });
    }

    return res.json(activeModel);
  } catch (error) {
    logger.error('Failed to get active voice model', { error, userId: req.params.userId });
    return res.status(500).json({ error: (error as Error).message });
  }
});

// Compare voice models
app.post('/voice-models/compare', async (req, res) => {
  try {
    if (!voiceModelService) {
      return res.status(503).json({ error: 'Voice model service not initialized' });
    }

    const { modelIds, userId } = req.body;

    if (!modelIds || !Array.isArray(modelIds) || modelIds.length === 0) {
      return res.status(400).json({ error: 'modelIds array is required' });
    }

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const comparison = await voiceModelService.compareVoiceModels(modelIds, userId);

    return res.json(comparison);
  } catch (error) {
    logger.error('Failed to compare voice models', { error, request: req.body });
    return res.status(500).json({ error: (error as Error).message });
  }
});

// Select best voice model
app.post('/voice-models/select-best', async (req, res) => {
  try {
    if (!voiceModelService) {
      return res.status(503).json({ error: 'Voice model service not initialized' });
    }

    const { userId, criteria } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const bestModel = await voiceModelService.selectBestVoiceModel(userId, criteria);

    if (!bestModel) {
      return res.status(404).json({ error: 'No suitable voice model found' });
    }

    return res.json(bestModel);
  } catch (error) {
    logger.error('Failed to select best voice model', { error, request: req.body });
    return res.status(500).json({ error: (error as Error).message });
  }
});

// Get voice model analytics
app.get('/voice-models/user/:userId/analytics', async (req, res) => {
  try {
    if (!voiceModelService) {
      return res.status(503).json({ error: 'Voice model service not initialized' });
    }

    const { userId } = req.params;

    const analytics = await voiceModelService.getVoiceModelAnalytics(userId);

    return res.json(analytics);
  } catch (error) {
    logger.error('Failed to get voice model analytics', { error, userId: req.params.userId });
    return res.status(500).json({ error: (error as Error).message });
  }
});

// Get voice model usage stats
app.get('/voice-models/:id/usage-stats', async (req, res) => {
  try {
    if (!voiceModelService) {
      return res.status(503).json({ error: 'Voice model service not initialized' });
    }

    const { id } = req.params;

    const usageStats = await voiceModelService.getVoiceModelUsageStats(id);

    if (!usageStats) {
      return res.status(404).json({ error: 'No usage stats found for this model' });
    }

    return res.json(usageStats);
  } catch (error) {
    logger.error('Failed to get voice model usage stats', { error, id: req.params.id });
    return res.status(500).json({ error: (error as Error).message });
  }
});

// Export voice model
app.get('/voice-models/:id/export', async (req, res) => {
  try {
    if (!voiceModelService) {
      return res.status(503).json({ error: 'Voice model service not initialized' });
    }

    const { id } = req.params;
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ error: 'userId query parameter is required' });
    }

    const exportData = await voiceModelService.exportVoiceModel(id, userId as string);

    return res.json(exportData);
  } catch (error) {
    logger.error('Failed to export voice model', { error, id: req.params.id });
    return res.status(500).json({ error: (error as Error).message });
  }
});

// Create backup
app.post('/voice-models/user/:userId/backup', async (req, res) => {
  try {
    if (!voiceModelService) {
      return res.status(503).json({ error: 'Voice model service not initialized' });
    }

    const { userId } = req.params;

    const backup = await voiceModelService.createBackup(userId);

    return res.status(201).json(backup);
  } catch (error) {
    logger.error('Failed to create voice model backup', { error, userId: req.params.userId });
    return res.status(500).json({ error: (error as Error).message });
  }
});

// Restore from backup
app.post('/voice-models/user/:userId/restore', async (req, res) => {
  try {
    if (!voiceModelService) {
      return res.status(503).json({ error: 'Voice model service not initialized' });
    }

    const { userId } = req.params;
    const { backupPath, overwriteExisting, activateRestored } = req.body;

    if (!backupPath) {
      return res.status(400).json({ error: 'backupPath is required' });
    }

    const restoredModels = await voiceModelService.restoreFromBackup(userId, backupPath, {
      overwriteExisting,
      activateRestored,
    });

    return res.json({
      success: true,
      restoredCount: restoredModels.length,
      models: restoredModels,
    });
  } catch (error) {
    logger.error('Failed to restore from backup', { error, userId: req.params.userId });
    return res.status(500).json({ error: (error as Error).message });
  }
});

// Share voice model (optional - for teams)
app.post('/voice-models/:id/share', async (req, res) => {
  try {
    if (!voiceModelService) {
      return res.status(503).json({ error: 'Voice model service not initialized' });
    }

    const { id } = req.params;
    const { ownerId, targetUserIds, permissions } = req.body;

    if (!ownerId || !targetUserIds || !Array.isArray(targetUserIds)) {
      return res.status(400).json({
        error: 'ownerId and targetUserIds array are required',
      });
    }

    await voiceModelService.shareVoiceModel(id, ownerId, targetUserIds, permissions);

    return res.json({
      success: true,
      message: 'Voice model shared successfully',
    });
  } catch (error) {
    logger.error('Failed to share voice model', { error, id: req.params.id });
    return res.status(500).json({ error: (error as Error).message });
  }
});

// Get shared voice models
app.get('/voice-models/user/:userId/shared', async (req, res) => {
  try {
    if (!voiceModelService) {
      return res.status(503).json({ error: 'Voice model service not initialized' });
    }

    const { userId } = req.params;

    const sharedModels = await voiceModelService.getSharedVoiceModels(userId);

    return res.json(sharedModels);
  } catch (error) {
    logger.error('Failed to get shared voice models', { error, userId: req.params.userId });
    return res.status(500).json({ error: (error as Error).message });
  }
});

// Cleanup expired models (admin endpoint)
app.post('/voice-models/cleanup', async (_req, res) => {
  try {
    if (!voiceModelService) {
      return res.status(503).json({ error: 'Voice model service not initialized' });
    }

    const cleanedCount = await voiceModelService.cleanupExpiredModels();

    return res.json({
      success: true,
      cleanedCount,
      message: `Cleaned up ${cleanedCount} expired voice models`,
    });
  } catch (error) {
    logger.error('Failed to cleanup expired models', { error });
    return res.status(500).json({ error: (error as Error).message });
  }
});

// Get expiring models
app.get('/voice-models/expiring', async (req, res) => {
  try {
    if (!voiceModelService) {
      return res.status(503).json({ error: 'Voice model service not initialized' });
    }

    const { userId } = req.query;

    const expiringModels = await voiceModelService.getExpiringModels(userId as string);

    return res.json(expiringModels);
  } catch (error) {
    logger.error('Failed to get expiring models', { error });
    return res.status(500).json({ error: (error as Error).message });
  }
});

// ============================================================================
// Voice Model Training Endpoints
// ============================================================================

// Start voice model training
app.post('/training/start', async (req, res) => {
  try {
    if (!trainingQueue) {
      return res.status(503).json({ error: 'Training service not initialized' });
    }

    const request: TrainingJobRequest = req.body;

    // Validate request
    if (!request.userId || !request.voiceSampleIds || !request.provider) {
      return res.status(400).json({
        error: 'userId, voiceSampleIds, and provider are required',
      });
    }

    if (!Array.isArray(request.voiceSampleIds) || request.voiceSampleIds.length === 0) {
      return res.status(400).json({
        error: 'voiceSampleIds must be a non-empty array',
      });
    }

    const jobId = await trainingQueue.addTrainingJob(request);

    return res.status(201).json({
      jobId,
      message: 'Training job created successfully',
      status: 'queued',
    });
  } catch (error) {
    logger.error('Failed to start training job', { error, request: req.body });
    return res.status(500).json({ error: (error as Error).message });
  }
});

// Get training job status
app.get('/training/:jobId', async (req, res) => {
  try {
    if (!trainingQueue) {
      return res.status(503).json({ error: 'Training service not initialized' });
    }

    const { jobId } = req.params;
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ error: 'userId query parameter is required' });
    }

    const status = await trainingQueue.getTrainingJobStatus(jobId);

    if (!status) {
      return res.status(404).json({ error: 'Training job not found' });
    }

    // Check if user has access to this job
    if (status.userId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    return res.json(status);
  } catch (error) {
    logger.error('Failed to get training job status', { error, jobId: req.params.jobId });
    return res.status(500).json({ error: (error as Error).message });
  }
});

// Cancel training job
app.post('/training/:jobId/cancel', async (req, res) => {
  try {
    if (!trainingQueue) {
      return res.status(503).json({ error: 'Training service not initialized' });
    }

    const { jobId } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const success = await trainingQueue.cancelTrainingJob(jobId, userId);

    return res.json({
      success,
      message: success ? 'Training job cancelled successfully' : 'Failed to cancel training job',
    });
  } catch (error) {
    logger.error('Failed to cancel training job', { error, jobId: req.params.jobId });
    return res.status(500).json({ error: (error as Error).message });
  }
});

// Get user's training jobs
app.get('/training/user/:userId', async (req, res) => {
  try {
    if (!trainingQueue) {
      return res.status(503).json({ error: 'Training service not initialized' });
    }

    const { userId } = req.params;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;

    const jobs = await trainingQueue.getUserTrainingJobs(userId, limit, offset);

    return res.json({
      jobs,
      pagination: {
        limit,
        offset,
        total: jobs.length, // In real implementation, get actual total count
      },
    });
  } catch (error) {
    logger.error('Failed to get user training jobs', { error, userId: req.params.userId });
    return res.status(500).json({ error: (error as Error).message });
  }
});

// Get training queue statistics
app.get('/training/stats', async (_req, res) => {
  try {
    if (!trainingQueue) {
      return res.status(503).json({ error: 'Training service not initialized' });
    }

    const stats = await trainingQueue.getQueueStats();
    return res.json(stats);
  } catch (error) {
    logger.error('Failed to get training queue stats', { error });
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
