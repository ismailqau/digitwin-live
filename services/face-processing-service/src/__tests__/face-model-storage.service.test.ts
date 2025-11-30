import { FaceModel } from '@clone/shared-types';

import { FaceModelStorageService } from '../services/face-model-storage.service';

describe('FaceModelStorageService', () => {
  let service: FaceModelStorageService;

  beforeEach(() => {
    service = new FaceModelStorageService();
  });

  // Helper to create mock model data
  const createMockModelData = (): Omit<FaceModel, 'id' | 'createdAt' | 'qualityScore'> => ({
    userId: 'user_123',
    modelPath: '',
    resolution: { width: 512, height: 512 },
    keypoints: Array(468)
      .fill(null)
      .map((_, i) => ({
        x: i % 256,
        y: Math.floor(i / 2),
        confidence: 0.95,
        landmark: `landmark_${i}`,
      })),
    embeddings: [
      { vector: new Array(512).fill(0.1), confidence: 0.9 },
      { vector: new Array(512).fill(0.2), confidence: 0.85 },
      { vector: new Array(512).fill(0.15), confidence: 0.92 },
    ],
    neutralPose: 'base64_image_data',
    expressionTemplates: [
      { name: 'neutral', keypoints: [], blendshapes: new Array(52).fill(0) },
      { name: 'talking', keypoints: [], blendshapes: new Array(52).fill(0.5) },
    ],
  });

  describe('createModel', () => {
    it('should create a new face model', async () => {
      const modelData = createMockModelData();
      const model = await service.createModel('user_123', modelData);

      expect(model.id).toBeDefined();
      expect(model.userId).toBe('user_123');
      expect(model.qualityScore).toBeGreaterThan(0);
      expect(model.createdAt).toBeInstanceOf(Date);
    });

    it('should calculate quality score', async () => {
      const modelData = createMockModelData();
      const model = await service.createModel('user_123', modelData);

      expect(model.qualityScore).toBeGreaterThanOrEqual(0);
      expect(model.qualityScore).toBeLessThanOrEqual(100);
    });

    it('should enforce max models per user', async () => {
      const modelData = createMockModelData();

      // Create max models
      for (let i = 0; i < 5; i++) {
        await service.createModel('user_limit', modelData);
      }

      // Should throw on exceeding limit
      await expect(service.createModel('user_limit', modelData)).rejects.toThrow();
    });
  });

  describe('getModel', () => {
    it('should retrieve model by ID', async () => {
      const modelData = createMockModelData();
      const created = await service.createModel('user_123', modelData);

      const retrieved = await service.getModel(created.id);

      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe(created.id);
    });

    it('should return null for non-existent model', async () => {
      const result = await service.getModel('non_existent');
      expect(result).toBeNull();
    });
  });

  describe('getModelsByUser', () => {
    it('should return all models for a user', async () => {
      const modelData = createMockModelData();
      await service.createModel('user_multi', modelData);
      await service.createModel('user_multi', modelData);

      const models = service.getModelsByUser('user_multi');

      expect(models).toHaveLength(2);
      models.forEach((m) => expect(m.userId).toBe('user_multi'));
    });

    it('should return empty array for user with no models', () => {
      const models = service.getModelsByUser('no_models_user');
      expect(models).toHaveLength(0);
    });
  });

  describe('updateModel', () => {
    it('should update model properties', async () => {
      const modelData = createMockModelData();
      const model = await service.createModel('user_123', modelData);

      const updated = await service.updateModel(model.id, {
        resolution: { width: 1024, height: 1024 },
      });

      expect(updated.resolution.width).toBe(1024);
      expect(updated.resolution.height).toBe(1024);
    });

    it('should increment version on update', async () => {
      const modelData = createMockModelData();
      const model = await service.createModel('user_123', modelData);
      const metaBefore = await service.getModelMetadata(model.id);

      await service.updateModel(model.id, { neutralPose: 'new_pose' });
      const metaAfter = await service.getModelMetadata(model.id);

      expect(metaAfter?.version).toBe((metaBefore?.version || 0) + 1);
    });

    it('should throw for non-existent model', async () => {
      await expect(service.updateModel('non_existent', {})).rejects.toThrow();
    });
  });

  describe('deleteModel', () => {
    it('should soft delete model', async () => {
      const modelData = createMockModelData();
      const model = await service.createModel('user_123', modelData);

      await service.deleteModel(model.id);
      const meta = await service.getModelMetadata(model.id);

      expect(meta?.status).toBe('inactive');
    });
  });

  describe('activateModel / deactivateModel', () => {
    it('should activate model', async () => {
      const modelData = createMockModelData();
      const model = await service.createModel('user_123', modelData);

      await service.activateModel(model.id);
      const meta = await service.getModelMetadata(model.id);

      expect(meta?.status).toBe('active');
      expect(meta?.activatedAt).toBeInstanceOf(Date);
    });

    it('should deactivate other models when activating', async () => {
      const modelData = createMockModelData();
      const model1 = await service.createModel('user_switch', modelData);
      const model2 = await service.createModel('user_switch', modelData);

      await service.activateModel(model1.id);
      await service.activateModel(model2.id);

      const meta1 = await service.getModelMetadata(model1.id);
      const meta2 = await service.getModelMetadata(model2.id);

      expect(meta1?.status).toBe('inactive');
      expect(meta2?.status).toBe('active');
    });

    it('should deactivate model', async () => {
      const modelData = createMockModelData();
      const model = await service.createModel('user_123', modelData);
      await service.activateModel(model.id);

      await service.deactivateModel(model.id);
      const meta = await service.getModelMetadata(model.id);

      expect(meta?.status).toBe('inactive');
    });
  });

  describe('getActiveModel', () => {
    it('should return active model for user', async () => {
      const modelData = createMockModelData();
      const model = await service.createModel('user_active', modelData);
      await service.activateModel(model.id);

      const active = await service.getActiveModel('user_active');

      expect(active).not.toBeNull();
      expect(active?.id).toBe(model.id);
    });

    it('should return null if no active model', async () => {
      const active = await service.getActiveModel('no_active_user');
      expect(active).toBeNull();
    });
  });

  describe('assessModelQuality', () => {
    it('should return quality assessment', async () => {
      const modelData = createMockModelData();
      const model = await service.createModel('user_123', modelData);

      const assessment = service.assessModelQuality(model);

      expect(assessment).toHaveProperty('overallScore');
      expect(assessment).toHaveProperty('embeddingQuality');
      expect(assessment).toHaveProperty('keypointQuality');
      expect(assessment).toHaveProperty('expressionCoverage');
      expect(assessment).toHaveProperty('resolutionScore');
      expect(assessment).toHaveProperty('recommendations');
    });
  });

  describe('recordUsage', () => {
    it('should record model usage', async () => {
      const modelData = createMockModelData();
      const model = await service.createModel('user_123', modelData);

      await service.recordUsage(model.id, 100, true);
      await service.recordUsage(model.id, 150, true);

      const analytics = await service.getModelAnalytics(model.id);

      expect(analytics?.usageCount).toBe(2);
      expect(analytics?.averageGenerationTimeMs).toBe(125);
      expect(analytics?.successRate).toBe(1);
    });

    it('should track errors', async () => {
      const modelData = createMockModelData();
      const model = await service.createModel('user_123', modelData);

      await service.recordUsage(model.id, 100, true);
      await service.recordUsage(model.id, 200, false);

      const analytics = await service.getModelAnalytics(model.id);

      expect(analytics?.errorCount).toBe(1);
      expect(analytics?.successRate).toBe(0.5);
    });
  });

  describe('backupModel / restoreModel', () => {
    it('should backup and restore model', async () => {
      const modelData = createMockModelData();
      const model = await service.createModel('user_123', modelData);

      const backup = await service.backupModel(model.id);

      // Delete original
      await service.permanentlyDeleteModel(model.id);
      expect(await service.getModel(model.id)).toBeNull();

      // Restore
      const restored = await service.restoreModel(backup);

      expect(restored.id).toBe(model.id);
      expect(await service.getModel(model.id)).not.toBeNull();
    });
  });

  describe('getUserStorageStats', () => {
    it('should return storage statistics', async () => {
      const modelData = createMockModelData();
      await service.createModel('user_stats', modelData);
      await service.createModel('user_stats', modelData);

      const stats = service.getUserStorageStats('user_stats');

      expect(stats.modelCount).toBe(2);
      expect(stats.oldestModel).toBeInstanceOf(Date);
      expect(stats.newestModel).toBeInstanceOf(Date);
    });
  });

  describe('configuration', () => {
    it('should return configuration', () => {
      const config = service.getConfig();

      expect(config).toHaveProperty('bucket');
      expect(config).toHaveProperty('basePath');
      expect(config).toHaveProperty('maxModelsPerUser');
      expect(config).toHaveProperty('expirationDays');
    });

    it('should accept custom configuration', () => {
      const customService = new FaceModelStorageService({
        maxModelsPerUser: 10,
        minQualityScore: 80,
      });

      const config = customService.getConfig();
      expect(config.maxModelsPerUser).toBe(10);
      expect(config.minQualityScore).toBe(80);
    });
  });
});
