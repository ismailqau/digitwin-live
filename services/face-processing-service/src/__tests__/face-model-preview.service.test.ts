import { FaceModel } from '@clone/shared-types';

import { FaceModelPreviewService } from '../services/face-model-preview.service';

describe('FaceModelPreviewService', () => {
  let service: FaceModelPreviewService;

  beforeEach(() => {
    service = new FaceModelPreviewService();
  });

  // Helper to create mock face model
  const createMockModel = (overrides: Partial<FaceModel> = {}): FaceModel => ({
    id: `model_${Date.now()}`,
    userId: 'user_123',
    modelPath: '/path/to/model',
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
    createdAt: new Date(),
    qualityScore: 85,
    ...overrides,
  });

  describe('generatePreview', () => {
    it('should generate preview for a model', async () => {
      const model = createMockModel();
      const preview = await service.generatePreview(model);

      expect(preview.previewId).toBeDefined();
      expect(preview.modelId).toBe(model.id);
      expect(preview.duration).toBeGreaterThan(0);
      expect(preview.frameCount).toBeGreaterThan(0);
      expect(preview.generationTimeMs).toBeGreaterThanOrEqual(0);
      expect(preview.quality).toBeDefined();
    });

    it('should accept custom duration', async () => {
      const model = createMockModel();
      const preview = await service.generatePreview(model, { duration: 10000 });

      expect(preview.duration).toBe(10000);
    });

    it('should include quality assessment', async () => {
      const model = createMockModel();
      const preview = await service.generatePreview(model);

      expect(preview.quality).toHaveProperty('overallScore');
      expect(preview.quality).toHaveProperty('lipSyncScore');
      expect(preview.quality).toHaveProperty('faceQuality');
      expect(preview.quality).toHaveProperty('smoothness');
      expect(preview.quality).toHaveProperty('recommendations');
    });
  });

  describe('compareModels', () => {
    it('should compare two models', async () => {
      const modelA = createMockModel({ id: 'model_a' });
      const modelB = createMockModel({ id: 'model_b' });

      const comparison = await service.compareModels(modelA, modelB);

      expect(comparison.comparisonId).toBeDefined();
      expect(comparison.modelA.modelId).toBe('model_a');
      expect(comparison.modelB.modelId).toBe('model_b');
      expect(['A', 'B', 'tie']).toContain(comparison.winner);
      expect(comparison.metrics).toBeDefined();
    });

    it('should include comparison metrics', async () => {
      const modelA = createMockModel();
      const modelB = createMockModel();

      const comparison = await service.compareModels(modelA, modelB);

      expect(comparison.metrics).toHaveProperty('qualityDifference');
      expect(comparison.metrics).toHaveProperty('lipSyncDifference');
      expect(comparison.metrics).toHaveProperty('speedDifference');
      expect(comparison.metrics).toHaveProperty('recommendation');
    });
  });

  describe('validateModel', () => {
    it('should validate a model', async () => {
      const model = createMockModel();
      const validation = await service.validateModel(model);

      expect(validation.validationId).toBeDefined();
      expect(validation.modelId).toBe(model.id);
      expect(validation.checks).toBeInstanceOf(Array);
      expect(validation.checks.length).toBeGreaterThan(0);
      expect(typeof validation.overallScore).toBe('number');
      expect(typeof validation.canActivate).toBe('boolean');
    });

    it('should include all validation checks', async () => {
      const model = createMockModel();
      const validation = await service.validateModel(model);

      const checkNames = validation.checks.map((c) => c.name);
      expect(checkNames).toContain('Embedding Quality');
      expect(checkNames).toContain('Keypoint Coverage');
      expect(checkNames).toContain('Expression Templates');
      expect(checkNames).toContain('Resolution');
      expect(checkNames).toContain('Sample Count');
    });

    it('should fail validation for low quality model', async () => {
      const model = createMockModel({
        embeddings: [{ vector: new Array(512).fill(0), confidence: 0.5 }],
        keypoints: [],
        expressionTemplates: [],
        resolution: { width: 128, height: 128 },
      });

      const validation = await service.validateModel(model);

      expect(validation.isValid).toBe(false);
      expect(validation.canActivate).toBe(false);
    });
  });

  describe('getRecommendations', () => {
    it('should return recommendations for model improvement', () => {
      const model = createMockModel({
        qualityScore: 60,
        embeddings: [{ vector: new Array(512).fill(0), confidence: 0.7 }],
      });

      const recommendations = service.getRecommendations(model);

      expect(recommendations).toBeInstanceOf(Array);
      recommendations.forEach((rec) => {
        expect(rec).toHaveProperty('type');
        expect(rec).toHaveProperty('category');
        expect(rec).toHaveProperty('message');
        expect(rec).toHaveProperty('priority');
        expect(rec).toHaveProperty('actionable');
      });
    });

    it('should return fewer recommendations for high quality model', () => {
      const highQualityModel = createMockModel({
        qualityScore: 95,
        embeddings: Array(5)
          .fill(null)
          .map(() => ({
            vector: new Array(512).fill(0.1),
            confidence: 0.95,
          })),
        expressionTemplates: Array(5)
          .fill(null)
          .map((_, i) => ({
            name: `expression_${i}`,
            keypoints: [],
            blendshapes: new Array(52).fill(0),
          })),
      });

      const lowQualityModel = createMockModel({
        qualityScore: 50,
        embeddings: [{ vector: new Array(512).fill(0), confidence: 0.5 }],
      });

      const highQualityRecs = service.getRecommendations(highQualityModel);
      const lowQualityRecs = service.getRecommendations(lowQualityModel);

      expect(highQualityRecs.length).toBeLessThanOrEqual(lowQualityRecs.length);
    });
  });

  describe('approveModel / rejectModel', () => {
    it('should approve valid model', async () => {
      const model = createMockModel();
      const validation = await service.validateModel(model);

      if (validation.canActivate) {
        const approved = await service.approveModel(model.id, validation.validationId);
        expect(approved).toBe(true);
      }
    });

    it('should reject model with feedback', async () => {
      const model = createMockModel();
      const validation = await service.validateModel(model);

      const result = await service.rejectModel(
        model.id,
        validation.validationId,
        'Quality too low'
      );

      expect(result.rejected).toBe(true);
      expect(result.recommendations).toBeInstanceOf(Array);
    });

    it('should throw for invalid validation ID', async () => {
      await expect(service.approveModel('model_123', 'invalid_validation')).rejects.toThrow();
    });
  });

  describe('getPreview / getValidation / getComparison', () => {
    it('should retrieve stored preview', async () => {
      const model = createMockModel();
      const preview = await service.generatePreview(model);

      const retrieved = service.getPreview(preview.previewId);

      expect(retrieved).not.toBeNull();
      expect(retrieved?.previewId).toBe(preview.previewId);
    });

    it('should retrieve stored validation', async () => {
      const model = createMockModel();
      const validation = await service.validateModel(model);

      const retrieved = service.getValidation(validation.validationId);

      expect(retrieved).not.toBeNull();
      expect(retrieved?.validationId).toBe(validation.validationId);
    });

    it('should retrieve stored comparison', async () => {
      const modelA = createMockModel();
      const modelB = createMockModel();
      const comparison = await service.compareModels(modelA, modelB);

      const retrieved = service.getComparison(comparison.comparisonId);

      expect(retrieved).not.toBeNull();
      expect(retrieved?.comparisonId).toBe(comparison.comparisonId);
    });

    it('should return null for non-existent items', () => {
      expect(service.getPreview('non_existent')).toBeNull();
      expect(service.getValidation('non_existent')).toBeNull();
      expect(service.getComparison('non_existent')).toBeNull();
    });
  });

  describe('configuration', () => {
    it('should return configuration', () => {
      const config = service.getConfig();

      expect(config).toHaveProperty('defaultDuration');
      expect(config).toHaveProperty('defaultFrameRate');
      expect(config).toHaveProperty('thumbnailSize');
      expect(config).toHaveProperty('minQualityForApproval');
    });

    it('should accept custom configuration', () => {
      const customService = new FaceModelPreviewService({
        defaultDuration: 10000,
        minQualityForApproval: 80,
      });

      const config = customService.getConfig();
      expect(config.defaultDuration).toBe(10000);
      expect(config.minQualityForApproval).toBe(80);
    });
  });
});
