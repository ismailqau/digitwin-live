import { TTSProvider } from '@clone/shared-types';

import { TrainingJobProcessor } from '../services/TrainingJobProcessor';
import { TrainingJobData, TrainingStage } from '../types';

// Mock dependencies
jest.mock('@clone/database');
jest.mock('@clone/logger');

const mockPrisma = {
  voiceModel: {
    create: jest.fn(),
  },
} as any;

const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
} as any;

jest.mock('@clone/logger', () => ({
  createLogger: jest.fn(() => mockLogger),
}));

describe('TrainingJobProcessor', () => {
  let processor: TrainingJobProcessor;

  beforeEach(() => {
    jest.clearAllMocks();
    processor = new TrainingJobProcessor(mockPrisma, mockLogger);
  });

  describe('estimateTrainingCost', () => {
    it('should estimate XTTS-v2 training cost', async () => {
      const voiceSamples = [
        { duration: 120, sizeBytes: 1024000 },
        { duration: 180, sizeBytes: 1536000 },
      ];

      const estimate = await processor.estimateTrainingCost(voiceSamples, TTSProvider.XTTS_V2, {
        epochs: 100,
      });

      expect(estimate.provider).toBe(TTSProvider.XTTS_V2);
      expect(estimate.estimatedCost).toBeGreaterThan(0);
      expect(estimate.estimatedTimeMs).toBeGreaterThan(0);
      expect(estimate.gpuHours).toBeGreaterThan(0);
      expect(estimate.breakdown).toBeDefined();
      expect(estimate.breakdown.compute).toBeGreaterThan(0);
    });

    it('should estimate Google Cloud TTS training cost', async () => {
      const voiceSamples = [
        { duration: 1800, sizeBytes: 15360000 }, // 30 minutes
      ];

      const estimate = await processor.estimateTrainingCost(
        voiceSamples,
        TTSProvider.GOOGLE_CLOUD_TTS
      );

      expect(estimate.provider).toBe(TTSProvider.GOOGLE_CLOUD_TTS);
      expect(estimate.estimatedCost).toBeGreaterThanOrEqual(300); // Base cost
      expect(estimate.breakdown.compute).toBeGreaterThanOrEqual(300);
    });

    it('should estimate OpenAI TTS training cost', async () => {
      const voiceSamples = [
        { duration: 300, sizeBytes: 2560000 }, // 5 minutes
      ];

      const estimate = await processor.estimateTrainingCost(voiceSamples, TTSProvider.OPENAI_TTS);

      expect(estimate.provider).toBe(TTSProvider.OPENAI_TTS);
      expect(estimate.estimatedCost).toBeGreaterThan(0);
      expect(estimate.breakdown.compute).toBeGreaterThan(0);
    });

    it('should throw error for unsupported provider', async () => {
      const voiceSamples = [{ duration: 120, sizeBytes: 1024000 }];

      await expect(
        processor.estimateTrainingCost(voiceSamples, 'unsupported' as TTSProvider)
      ).rejects.toThrow('Unsupported provider for training');
    });
  });

  describe('processTraining', () => {
    beforeEach(() => {
      // Mock the time-consuming private methods to avoid timeouts
      jest.spyOn(processor as any, 'preprocessVoiceSamples').mockResolvedValue(['processed1.wav']);
      jest.spyOn(processor as any, 'initializeXTTSEnvironment').mockResolvedValue(undefined);
      jest.spyOn(processor as any, 'simulateTrainingEpoch').mockResolvedValue(undefined);
      jest.spyOn(processor as any, 'simulateTrainingStep').mockResolvedValue(undefined);
      jest.spyOn(processor as any, 'uploadSamplesToGoogleCloud').mockResolvedValue(undefined);
      jest.spyOn(processor as any, 'prepareOpenAITrainingData').mockResolvedValue(undefined);
    });

    it('should process XTTS-v2 training successfully', async () => {
      const jobData: TrainingJobData = {
        voiceSamplePaths: ['gs://bucket/sample1.wav', 'gs://bucket/sample2.wav'],
        outputModelPath: 'gs://bucket/models/user-123/model',
        provider: TTSProvider.XTTS_V2,
        options: { epochs: 50, qualityThreshold: 0.8 },
        userId: 'user-123',
        estimatedCost: 15.5,
        estimatedTimeMs: 1800000,
      };

      const mockVoiceModel = {
        id: 'model-123',
        userId: 'user-123',
        provider: TTSProvider.XTTS_V2,
        modelPath: jobData.outputModelPath,
        sampleRate: 22050,
        qualityScore: 0.87,
        status: 'completed',
      };

      mockPrisma.voiceModel.create.mockResolvedValue(mockVoiceModel);

      const progressUpdates: any[] = [];
      const progressCallback = (progress: unknown) => {
        progressUpdates.push(progress);
      };

      const result = await processor.processTraining(jobData, progressCallback);

      expect(result.voiceModelId).toBe('model-123');
      expect(result.modelPath).toBe(jobData.outputModelPath);
      expect(result.qualityMetrics.overall).toBeGreaterThan(0.8);
      expect(result.actualCost).toBeGreaterThanOrEqual(0);

      // Check progress updates
      expect(progressUpdates.length).toBeGreaterThan(0);
      expect(progressUpdates[0].stage).toBe(TrainingStage.PREPROCESSING);
      expect(progressUpdates.some((p) => p.stage === TrainingStage.TRAINING)).toBe(true);
      expect(progressUpdates.some((p) => p.stage === TrainingStage.FINALIZING)).toBe(true);
    });

    it('should process Google Cloud TTS training successfully', async () => {
      const jobData: TrainingJobData = {
        voiceSamplePaths: ['gs://bucket/sample1.wav'],
        outputModelPath: 'gs://bucket/models/user-123/model',
        provider: TTSProvider.GOOGLE_CLOUD_TTS,
        options: { qualityThreshold: 0.8 },
        userId: 'user-123',
        estimatedCost: 350.0,
        estimatedTimeMs: 7200000, // 2 hours
      };

      const mockVoiceModel = {
        id: 'model-456',
        userId: 'user-123',
        provider: TTSProvider.GOOGLE_CLOUD_TTS,
        modelPath: jobData.outputModelPath,
        sampleRate: 24000,
        qualityScore: 0.89,
        status: 'completed',
      };

      mockPrisma.voiceModel.create.mockResolvedValue(mockVoiceModel);

      const progressCallback = jest.fn();
      const result = await processor.processTraining(jobData, progressCallback);

      expect(result.voiceModelId).toBe('model-456');
      expect(result.qualityMetrics.overall).toBeGreaterThan(0.8);
      expect(progressCallback).toHaveBeenCalled();
    });

    it('should process OpenAI TTS training successfully', async () => {
      const jobData: TrainingJobData = {
        voiceSamplePaths: ['gs://bucket/sample1.wav'],
        outputModelPath: 'gs://bucket/models/user-123/model',
        provider: TTSProvider.OPENAI_TTS,
        options: { qualityThreshold: 0.8 },
        userId: 'user-123',
        estimatedCost: 50.0,
        estimatedTimeMs: 5400000, // 1.5 hours
      };

      const mockVoiceModel = {
        id: 'model-789',
        userId: 'user-123',
        provider: TTSProvider.OPENAI_TTS,
        modelPath: jobData.outputModelPath,
        sampleRate: 24000,
        qualityScore: 0.83,
        status: 'completed',
      };

      mockPrisma.voiceModel.create.mockResolvedValue(mockVoiceModel);

      const progressCallback = jest.fn();
      const result = await processor.processTraining(jobData, progressCallback);

      expect(result.voiceModelId).toBe('model-789');
      expect(result.qualityMetrics.overall).toBeGreaterThan(0.8);
    });

    it('should throw error for unsupported provider', async () => {
      const jobData: TrainingJobData = {
        voiceSamplePaths: ['gs://bucket/sample1.wav'],
        outputModelPath: 'gs://bucket/models/user-123/model',
        provider: 'unsupported' as TTSProvider,
        options: {},
        userId: 'user-123',
        estimatedCost: 0,
        estimatedTimeMs: 0,
      };

      const progressCallback = jest.fn();

      await expect(processor.processTraining(jobData, progressCallback)).rejects.toThrow(
        'Unsupported provider for training'
      );
    });

    it('should fail if model validation fails', async () => {
      const jobData: TrainingJobData = {
        voiceSamplePaths: ['gs://bucket/sample1.wav'],
        outputModelPath: 'gs://bucket/models/user-123/model',
        provider: TTSProvider.XTTS_V2,
        options: { qualityThreshold: 0.95 }, // Very high threshold
        userId: 'user-123',
        estimatedCost: 15.5,
        estimatedTimeMs: 1800000,
      };

      const mockVoiceModel = {
        id: 'model-123',
        userId: 'user-123',
        provider: TTSProvider.XTTS_V2,
        modelPath: jobData.outputModelPath,
        sampleRate: 22050,
        qualityScore: 0.7, // Low quality
        status: 'completed',
      };

      mockPrisma.voiceModel.create.mockResolvedValue(mockVoiceModel);

      const progressCallback = jest.fn();

      await expect(processor.processTraining(jobData, progressCallback)).rejects.toThrow(
        'Model validation failed'
      );
    });
  });
});
