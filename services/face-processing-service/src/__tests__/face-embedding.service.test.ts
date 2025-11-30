import { FaceEmbedding, FacialKeypoint } from '@clone/shared-types';

import { FaceEmbeddingService } from '../services/face-embedding.service';

describe('FaceEmbeddingService', () => {
  let service: FaceEmbeddingService;

  beforeEach(() => {
    service = new FaceEmbeddingService();
  });

  // Helper to create mock landmarks
  const createMockLandmarks = (seed: number = 1): FacialKeypoint[] => {
    const landmarks: FacialKeypoint[] = [];
    for (let i = 0; i < 468; i++) {
      landmarks.push({
        x: (i * seed * 0.5) % 256,
        y: (i * seed * 0.7) % 256,
        confidence: 0.9 + (i % 10) * 0.01,
        landmark: `landmark_${i}`,
      });
    }
    return landmarks;
  };

  // Helper to create mock embedding
  const createMockEmbedding = (seed: number = 1): FaceEmbedding => {
    const vector = new Array(512).fill(0).map((_, i) => Math.sin(i * seed * 0.1));
    const magnitude = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
    return {
      vector: vector.map((v) => v / magnitude),
      confidence: 0.9,
    };
  };

  describe('generateEmbedding', () => {
    it('should generate embedding from landmarks', async () => {
      const landmarks = createMockLandmarks();
      const imageBuffer = Buffer.from('test');

      const embedding = await service.generateEmbedding(imageBuffer, landmarks);

      expect(embedding).toBeDefined();
      expect(embedding.vector).toHaveLength(512);
      expect(embedding.confidence).toBeGreaterThan(0);
    });

    it('should generate normalized embedding vector', async () => {
      const landmarks = createMockLandmarks();
      const imageBuffer = Buffer.from('test');

      const embedding = await service.generateEmbedding(imageBuffer, landmarks);

      const magnitude = Math.sqrt(embedding.vector.reduce((sum, v) => sum + v * v, 0));
      expect(magnitude).toBeCloseTo(1, 2);
    });
  });

  describe('calculateSimilarity', () => {
    it('should return 1 for identical embeddings', () => {
      const embedding = createMockEmbedding();
      const similarity = service.calculateSimilarity(embedding.vector, embedding.vector);
      expect(similarity).toBeCloseTo(1, 5);
    });

    it('should return value between -1 and 1', () => {
      const embedding1 = createMockEmbedding(1);
      const embedding2 = createMockEmbedding(2);
      const similarity = service.calculateSimilarity(embedding1.vector, embedding2.vector);
      expect(similarity).toBeGreaterThanOrEqual(-1);
      expect(similarity).toBeLessThanOrEqual(1);
    });

    it('should throw for mismatched dimensions', () => {
      const embedding1 = { vector: [1, 2, 3], confidence: 0.9 };
      const embedding2 = { vector: [1, 2], confidence: 0.9 };
      expect(() => service.calculateSimilarity(embedding1.vector, embedding2.vector)).toThrow();
    });
  });

  describe('compareEmbeddings', () => {
    it('should return comparison result with all fields', () => {
      const embedding1 = createMockEmbedding(1);
      const embedding2 = createMockEmbedding(1.1);

      const result = service.compareEmbeddings(embedding1, embedding2);

      expect(result).toHaveProperty('similarity');
      expect(result).toHaveProperty('isMatch');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('matchStrength');
    });

    it('should identify strong match for similar embeddings', () => {
      const embedding = createMockEmbedding(1);
      const result = service.compareEmbeddings(embedding, embedding);

      expect(result.isMatch).toBe(true);
      expect(result.matchStrength).toBe('strong');
    });
  });

  describe('validateEmbedding', () => {
    it('should validate correct embedding', () => {
      const embedding = createMockEmbedding();
      const result = service.validateEmbedding(embedding);

      expect(result.isValid).toBe(true);
      expect(result.issues).toHaveLength(0);
      expect(result.dimensionValid).toBe(true);
      expect(result.magnitudeValid).toBe(true);
      expect(result.valuesValid).toBe(true);
    });

    it('should detect invalid dimension', () => {
      const embedding = { vector: [1, 2, 3], confidence: 0.9 };
      const result = service.validateEmbedding(embedding);

      expect(result.isValid).toBe(false);
      expect(result.dimensionValid).toBe(false);
    });

    it('should detect NaN values', () => {
      const embedding = createMockEmbedding();
      embedding.vector[0] = NaN;
      const result = service.validateEmbedding(embedding);

      expect(result.isValid).toBe(false);
      expect(result.valuesValid).toBe(false);
    });
  });

  describe('checkConsistency', () => {
    it('should return consistent for similar embeddings', () => {
      const embeddings = [
        createMockEmbedding(1),
        createMockEmbedding(1.01),
        createMockEmbedding(1.02),
      ];

      const result = service.checkConsistency(embeddings);

      expect(result.consistencyScore).toBeGreaterThan(0);
      expect(result.pairwiseSimilarities).toHaveLength(3);
    });

    it('should identify outliers', () => {
      const embeddings = [
        createMockEmbedding(1),
        createMockEmbedding(1.01),
        createMockEmbedding(100), // Very different
      ];

      const result = service.checkConsistency(embeddings);

      expect(result.outlierIndices.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle single embedding', () => {
      const embeddings = [createMockEmbedding(1)];
      const result = service.checkConsistency(embeddings);

      expect(result.isConsistent).toBe(true);
      expect(result.consistencyScore).toBe(1.0);
    });
  });

  describe('createIdentity', () => {
    it('should create identity from valid embeddings', () => {
      const embeddings = [
        createMockEmbedding(1),
        createMockEmbedding(1.01),
        createMockEmbedding(1.02),
      ];

      const identity = service.createIdentity('user123', embeddings);

      expect(identity.id).toBeDefined();
      expect(identity.userId).toBe('user123');
      expect(identity.sampleCount).toBe(3);
      expect(identity.averageEmbedding).toHaveLength(512);
      expect(identity.version).toBe(1);
      expect(identity.metadata).toBeDefined();
    });

    it('should throw for insufficient samples', () => {
      const embeddings = [createMockEmbedding(1), createMockEmbedding(2)];

      expect(() => service.createIdentity('user123', embeddings)).toThrow();
    });
  });

  describe('verifyIdentity', () => {
    it('should verify matching embedding', () => {
      const embeddings = [
        createMockEmbedding(1),
        createMockEmbedding(1.01),
        createMockEmbedding(1.02),
      ];
      const identity = service.createIdentity('user123', embeddings);
      const testEmbedding = createMockEmbedding(1.015);

      const result = service.verifyIdentity(testEmbedding, identity);

      expect(result).toHaveProperty('isVerified');
      expect(result).toHaveProperty('similarity');
      expect(result).toHaveProperty('matchStrength');
      expect(result).toHaveProperty('allSimilarities');
    });
  });

  describe('updateIdentity', () => {
    it('should update identity with new embedding', () => {
      const embeddings = [
        createMockEmbedding(1),
        createMockEmbedding(1.01),
        createMockEmbedding(1.02),
      ];
      const identity = service.createIdentity('user123', embeddings);
      const newEmbedding = createMockEmbedding(1.015);

      const updated = service.updateIdentity(identity, newEmbedding);

      expect(updated.version).toBe(2);
      expect(updated.sampleCount).toBe(4);
    });
  });

  describe('clusterEmbeddings', () => {
    it('should cluster similar embeddings together', () => {
      const embeddings = [
        createMockEmbedding(1),
        createMockEmbedding(1.01),
        createMockEmbedding(100),
        createMockEmbedding(100.01),
      ];

      const clusters = service.clusterEmbeddings(embeddings);

      expect(clusters.length).toBeGreaterThanOrEqual(1);
      clusters.forEach((cluster) => {
        expect(cluster.clusterId).toBeDefined();
        expect(cluster.size).toBeGreaterThan(0);
        expect(cluster.centroid).toHaveLength(512);
      });
    });

    it('should return empty array for empty input', () => {
      const clusters = service.clusterEmbeddings([]);
      expect(clusters).toHaveLength(0);
    });
  });

  describe('serializeIdentity / deserializeIdentity', () => {
    it('should serialize and deserialize identity correctly', () => {
      const embeddings = [
        createMockEmbedding(1),
        createMockEmbedding(1.01),
        createMockEmbedding(1.02),
      ];
      const identity = service.createIdentity('user123', embeddings);

      const serialized = service.serializeIdentity(identity);
      const deserialized = service.deserializeIdentity(serialized);

      expect(deserialized.id).toBe(identity.id);
      expect(deserialized.userId).toBe(identity.userId);
      expect(deserialized.sampleCount).toBe(identity.sampleCount);
      expect(deserialized.createdAt).toBeInstanceOf(Date);
    });
  });

  describe('configuration', () => {
    it('should return correct embedding dimension', () => {
      expect(service.getEmbeddingDimension()).toBe(512);
    });

    it('should return correct similarity threshold', () => {
      expect(service.getSimilarityThreshold()).toBe(0.6);
    });

    it('should return model version', () => {
      expect(service.getModelVersion()).toBe('1.0.0');
    });

    it('should accept custom configuration', () => {
      const customService = new FaceEmbeddingService({
        embeddingDimension: 256,
        similarityThreshold: 0.7,
      });

      expect(customService.getEmbeddingDimension()).toBe(256);
      expect(customService.getSimilarityThreshold()).toBe(0.7);
    });
  });
});
