import { PrismaClient } from '@clone/database';
import { logger } from '@clone/logger';
import { TTSProvider } from '@clone/shared-types';

import { VoiceModelService } from '../services/VoiceModelService';

// Mock Prisma Client
const mockPrisma = {
  user: {
    findUnique: jest.fn(),
  },
  voiceModel: {
    create: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  conversationTurn: {
    aggregate: jest.fn(),
    findFirst: jest.fn(),
  },
  trainingJob: {
    findMany: jest.fn(),
  },
} as unknown as PrismaClient;

const mockLogger = logger;

describe('VoiceModelService', () => {
  let voiceModelService: VoiceModelService;

  beforeEach(() => {
    voiceModelService = new VoiceModelService(mockPrisma, mockLogger);
    jest.clearAllMocks();
  });

  describe('createVoiceModel', () => {
    const mockUser = {
      id: 'user-1',
      email: 'test@example.com',
      name: 'Test User',
    };

    const createRequest = {
      userId: 'user-1',
      provider: TTSProvider.XTTS_V2,
      modelPath: 'gs://bucket/model.pth',
      sampleRate: 22050,
      qualityScore: 0.85,
      metadata: { version: '1.0' },
    };

    it('should create a voice model successfully', async () => {
      const mockVoiceModel = {
        id: 'model-1',
        ...createRequest,
        isActive: true,
        status: 'completed',
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };

      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (mockPrisma.voiceModel.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrisma.voiceModel.create as jest.Mock).mockResolvedValue(mockVoiceModel);

      const result = await voiceModelService.createVoiceModel(createRequest);

      expect(result).toEqual(mockVoiceModel);
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-1' },
      });
      expect(mockPrisma.voiceModel.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          provider: TTSProvider.XTTS_V2,
          modelPath: 'gs://bucket/model.pth',
          sampleRate: 22050,
          qualityScore: 0.85,
          isActive: true,
          status: 'completed',
          metadata: { version: '1.0' },
        },
      });
    });

    it('should throw error if user not found', async () => {
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(voiceModelService.createVoiceModel(createRequest)).rejects.toThrow(
        'User not found: user-1'
      );
    });

    it('should deactivate existing models when creating high-quality model', async () => {
      const existingModel = {
        id: 'existing-model',
        userId: 'user-1',
        isActive: true,
      };

      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (mockPrisma.voiceModel.findMany as jest.Mock).mockResolvedValue([existingModel]);
      (mockPrisma.voiceModel.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
      (mockPrisma.voiceModel.create as jest.Mock).mockResolvedValue({
        id: 'model-1',
        ...createRequest,
        isActive: true,
      });

      await voiceModelService.createVoiceModel(createRequest);

      expect(mockPrisma.voiceModel.updateMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-1',
          isActive: true,
          deletedAt: null,
        },
        data: { isActive: false },
      });
    });
  });

  describe('getVoiceModel', () => {
    it('should get voice model by id', async () => {
      const mockModel = {
        id: 'model-1',
        userId: 'user-1',
        provider: TTSProvider.XTTS_V2,
        isActive: true,
      };

      (mockPrisma.voiceModel.findFirst as jest.Mock).mockResolvedValue(mockModel);

      const result = await voiceModelService.getVoiceModel('model-1', 'user-1');

      expect(result).toEqual(mockModel);
      expect(mockPrisma.voiceModel.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'model-1',
          userId: 'user-1',
          deletedAt: null,
        },
      });
    });

    it('should return null if model not found', async () => {
      (mockPrisma.voiceModel.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await voiceModelService.getVoiceModel('nonexistent', 'user-1');

      expect(result).toBeNull();
    });
  });

  describe('getUserVoiceModels', () => {
    it('should get user voice models with pagination', async () => {
      const mockModels = [
        {
          id: 'model-1',
          userId: 'user-1',
          provider: TTSProvider.XTTS_V2,
          isActive: true,
          qualityScore: 0.9,
        },
        {
          id: 'model-2',
          userId: 'user-1',
          provider: TTSProvider.OPENAI_TTS,
          isActive: false,
          qualityScore: 0.7,
        },
      ];

      (mockPrisma.voiceModel.findMany as jest.Mock).mockResolvedValue(mockModels);
      (mockPrisma.voiceModel.count as jest.Mock).mockResolvedValue(2);

      const result = await voiceModelService.getUserVoiceModels('user-1', {}, 10, 0);

      expect(result).toEqual({
        models: mockModels,
        total: 2,
      });
      expect(mockPrisma.voiceModel.findMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-1',
          deletedAt: null,
        },
        orderBy: [{ isActive: 'desc' }, { qualityScore: 'desc' }, { createdAt: 'desc' }],
        take: 10,
        skip: 0,
      });
    });

    it('should apply filters correctly', async () => {
      const filters = {
        provider: TTSProvider.XTTS_V2,
        isActive: true,
        minQualityScore: 0.8,
      };

      (mockPrisma.voiceModel.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrisma.voiceModel.count as jest.Mock).mockResolvedValue(0);

      await voiceModelService.getUserVoiceModels('user-1', filters);

      expect(mockPrisma.voiceModel.findMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-1',
          deletedAt: null,
          provider: TTSProvider.XTTS_V2,
          isActive: true,
          qualityScore: { gte: 0.8 },
        },
        orderBy: [{ isActive: 'desc' }, { qualityScore: 'desc' }, { createdAt: 'desc' }],
        take: 20,
        skip: 0,
      });
    });
  });

  describe('updateVoiceModel', () => {
    const mockModel = {
      id: 'model-1',
      userId: 'user-1',
      provider: TTSProvider.XTTS_V2,
      isActive: false,
    };

    it('should update voice model successfully', async () => {
      const updates = {
        qualityScore: 0.9,
        metadata: { updated: true },
      };

      (mockPrisma.voiceModel.findFirst as jest.Mock).mockResolvedValue(mockModel);
      (mockPrisma.voiceModel.update as jest.Mock).mockResolvedValue({
        ...mockModel,
        ...updates,
      });

      const result = await voiceModelService.updateVoiceModel('model-1', 'user-1', updates);

      expect(result).toEqual({
        ...mockModel,
        ...updates,
      });
      expect(mockPrisma.voiceModel.update).toHaveBeenCalledWith({
        where: { id: 'model-1' },
        data: {
          ...updates,
          updatedAt: expect.any(Date),
        },
      });
    });

    it('should deactivate other models when activating', async () => {
      const updates = { isActive: true };

      (mockPrisma.voiceModel.findFirst as jest.Mock).mockResolvedValue(mockModel);
      (mockPrisma.voiceModel.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
      (mockPrisma.voiceModel.update as jest.Mock).mockResolvedValue({
        ...mockModel,
        isActive: true,
      });

      await voiceModelService.updateVoiceModel('model-1', 'user-1', updates);

      expect(mockPrisma.voiceModel.updateMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-1',
          isActive: true,
          id: { not: 'model-1' },
          deletedAt: null,
        },
        data: { isActive: false },
      });
    });

    it('should throw error if model not found', async () => {
      (mockPrisma.voiceModel.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(voiceModelService.updateVoiceModel('nonexistent', 'user-1', {})).rejects.toThrow(
        'Voice model not found or access denied: nonexistent'
      );
    });
  });

  describe('deleteVoiceModel', () => {
    const mockActiveModel = {
      id: 'model-1',
      userId: 'user-1',
      isActive: true,
    };

    const mockNextBestModel = {
      id: 'model-2',
      userId: 'user-1',
      isActive: false,
      qualityScore: 0.8,
    };

    it('should soft delete voice model', async () => {
      (mockPrisma.voiceModel.findFirst as jest.Mock)
        .mockResolvedValueOnce(mockActiveModel)
        .mockResolvedValueOnce(mockNextBestModel);
      (mockPrisma.voiceModel.update as jest.Mock).mockResolvedValue({});

      await voiceModelService.deleteVoiceModel('model-1', 'user-1');

      expect(mockPrisma.voiceModel.update).toHaveBeenCalledWith({
        where: { id: 'model-1' },
        data: {
          deletedAt: expect.any(Date),
          isActive: false,
        },
      });
    });

    it('should activate next best model when deleting active model', async () => {
      (mockPrisma.voiceModel.findFirst as jest.Mock)
        .mockResolvedValueOnce(mockActiveModel)
        .mockResolvedValueOnce(mockNextBestModel);
      (mockPrisma.voiceModel.update as jest.Mock).mockResolvedValue({});

      await voiceModelService.deleteVoiceModel('model-1', 'user-1');

      expect(mockPrisma.voiceModel.update).toHaveBeenCalledWith({
        where: { id: 'model-2' },
        data: { isActive: true },
      });
    });
  });

  describe('getActiveVoiceModel', () => {
    it('should get active voice model for user', async () => {
      const mockActiveModel = {
        id: 'model-1',
        userId: 'user-1',
        isActive: true,
      };

      (mockPrisma.voiceModel.findFirst as jest.Mock).mockResolvedValue(mockActiveModel);

      const result = await voiceModelService.getActiveVoiceModel('user-1');

      expect(result).toEqual(mockActiveModel);
      expect(mockPrisma.voiceModel.findFirst).toHaveBeenCalledWith({
        where: {
          userId: 'user-1',
          isActive: true,
          deletedAt: null,
        },
      });
    });

    it('should return null if no active model', async () => {
      (mockPrisma.voiceModel.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await voiceModelService.getActiveVoiceModel('user-1');

      expect(result).toBeNull();
    });
  });

  describe('compareVoiceModels', () => {
    it('should compare voice models with usage stats', async () => {
      const mockModels = [
        { id: 'model-1', userId: 'user-1', qualityScore: 0.9 },
        { id: 'model-2', userId: 'user-1', qualityScore: 0.7 },
      ];

      (mockPrisma.voiceModel.findMany as jest.Mock).mockResolvedValue(mockModels);
      (mockPrisma.conversationTurn.aggregate as jest.Mock).mockResolvedValue({
        _count: { id: 10 },
        _sum: { ttsCost: 5.0 },
        _avg: { ttsLatencyMs: 500 },
        _max: { timestamp: new Date() },
      });

      const result = await voiceModelService.compareVoiceModels(['model-1', 'model-2'], 'user-1');

      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('usageStats');
    });
  });

  describe('getVoiceModelAnalytics', () => {
    it('should get comprehensive analytics for user', async () => {
      const mockModels = [
        {
          id: 'model-1',
          provider: TTSProvider.XTTS_V2,
          isActive: true,
          qualityScore: 0.9,
        },
        {
          id: 'model-2',
          provider: TTSProvider.OPENAI_TTS,
          isActive: false,
          qualityScore: 0.7,
        },
      ];

      const mockAggregateResult = {
        _sum: { ttsCost: 10.5 },
        _count: { id: 25 },
        _max: { timestamp: new Date() },
      };

      (mockPrisma.voiceModel.findMany as jest.Mock).mockResolvedValue(mockModels);
      (mockPrisma.conversationTurn.aggregate as jest.Mock).mockResolvedValue(mockAggregateResult);

      const result = await voiceModelService.getVoiceModelAnalytics('user-1');

      expect(result).toEqual({
        totalModels: 2,
        activeModels: 1,
        modelsByProvider: {
          [TTSProvider.XTTS_V2]: 1,
          [TTSProvider.OPENAI_TTS]: 1,
        },
        averageQualityScore: 0.8,
        totalUsageCount: 25,
        totalCost: 10.5,
        storageUsedMb: 100, // 2 models * 50MB estimate
        lastUsed: mockAggregateResult._max.timestamp,
      });
    });
  });

  describe('cleanupExpiredModels', () => {
    it('should cleanup old, inactive, low-quality models', async () => {
      const mockExpiredModels = [
        {
          id: 'expired-1',
          userId: 'user-1',
          isActive: false,
          qualityScore: 0.3,
          createdAt: new Date('2023-01-01'),
        },
      ];

      (mockPrisma.voiceModel.findMany as jest.Mock).mockResolvedValue(mockExpiredModels);
      (mockPrisma.conversationTurn.findFirst as jest.Mock).mockResolvedValue(null);
      (mockPrisma.voiceModel.update as jest.Mock).mockResolvedValue({});

      const result = await voiceModelService.cleanupExpiredModels();

      expect(result).toBe(1);
      expect(mockPrisma.voiceModel.update).toHaveBeenCalledWith({
        where: { id: 'expired-1' },
        data: { deletedAt: expect.any(Date) },
      });
    });

    it('should not cleanup recently used models', async () => {
      const mockExpiredModels = [
        {
          id: 'expired-1',
          userId: 'user-1',
          isActive: false,
          qualityScore: 0.3,
          createdAt: new Date('2023-01-01'),
        },
      ];

      const mockRecentUsage = {
        id: 'turn-1',
        timestamp: new Date(),
      };

      (mockPrisma.voiceModel.findMany as jest.Mock).mockResolvedValue(mockExpiredModels);
      (mockPrisma.conversationTurn.findFirst as jest.Mock).mockResolvedValue(mockRecentUsage);

      const result = await voiceModelService.cleanupExpiredModels();

      expect(result).toBe(0);
      expect(mockPrisma.voiceModel.update).not.toHaveBeenCalled();
    });
  });
});
