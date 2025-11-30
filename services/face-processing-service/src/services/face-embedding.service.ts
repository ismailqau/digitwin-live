import { FaceProcessingError } from '@clone/errors';
import { createLogger } from '@clone/logger';
import { FaceEmbedding, FacialKeypoint } from '@clone/shared-types';

const logger = createLogger('face-embedding-service');

/**
 * Face identity representation from multiple samples
 */
export interface FaceIdentity {
  id: string;
  userId: string;
  embeddings: FaceEmbedding[];
  averageEmbedding: number[];
  confidence: number;
  sampleCount: number;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  metadata?: FaceIdentityMetadata;
}

/**
 * Metadata for face identity
 */
export interface FaceIdentityMetadata {
  modelVersion: string;
  embeddingDimension: number;
  consistencyScore: number;
  qualityDistribution: QualityDistribution;
}

/**
 * Quality distribution across samples
 */
export interface QualityDistribution {
  min: number;
  max: number;
  mean: number;
  stdDev: number;
}

/**
 * Embedding comparison result
 */
export interface EmbeddingComparisonResult {
  similarity: number;
  isMatch: boolean;
  confidence: number;
  matchStrength: 'strong' | 'moderate' | 'weak' | 'no_match';
}

/**
 * Embedding validation result
 */
export interface EmbeddingValidationResult {
  isValid: boolean;
  issues: string[];
  qualityScore: number;
  dimensionValid: boolean;
  magnitudeValid: boolean;
  valuesValid: boolean;
}

/**
 * Embedding consistency check result
 */
export interface ConsistencyCheckResult {
  isConsistent: boolean;
  consistencyScore: number;
  outlierIndices: number[];
  pairwiseSimilarities: number[][];
  recommendations: string[];
}

/**
 * Cluster result for identity grouping
 */
export interface EmbeddingCluster {
  clusterId: string;
  centroid: number[];
  embeddings: FaceEmbedding[];
  memberIndices: number[];
  intraClusterSimilarity: number;
  size: number;
}

/**
 * Identity verification result
 */
export interface IdentityVerificationResult {
  isVerified: boolean;
  similarity: number;
  confidence: number;
  matchStrength: 'strong' | 'moderate' | 'weak' | 'no_match';
  bestMatchIndex: number;
  allSimilarities: number[];
}

/**
 * Embedding generation config
 */
export interface EmbeddingConfig {
  embeddingDimension: number;
  similarityThreshold: number;
  strongMatchThreshold: number;
  moderateMatchThreshold: number;
  minSamplesForIdentity: number;
  maxSamplesForIdentity: number;
  outlierThreshold: number;
  minConsistencyScore: number;
  modelVersion: string;
}

const DEFAULT_CONFIG: EmbeddingConfig = {
  embeddingDimension: 512, // FaceNet/ArcFace standard dimension
  similarityThreshold: 0.6, // Cosine similarity threshold for identity match
  strongMatchThreshold: 0.85, // Strong match threshold
  moderateMatchThreshold: 0.7, // Moderate match threshold
  minSamplesForIdentity: 3,
  maxSamplesForIdentity: 10,
  outlierThreshold: 0.4, // Below this similarity, consider as outlier
  minConsistencyScore: 0.7, // Minimum consistency for valid identity
  modelVersion: '1.0.0',
};

/**
 * Face Embedding Service
 * Generates face embeddings using FaceNet/ArcFace-style models
 * Handles identity creation, verification, clustering, and versioning
 */
export class FaceEmbeddingService {
  private config: EmbeddingConfig;

  constructor(config: Partial<EmbeddingConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    logger.info('FaceEmbeddingService initialized', { config: this.config });
  }

  /**
   * Generate face embedding from facial landmarks
   * In production, this would use FaceNet or ArcFace model
   */
  async generateEmbedding(
    _imageBuffer: Buffer,
    landmarks: FacialKeypoint[]
  ): Promise<FaceEmbedding> {
    try {
      // In production, use FaceNet/ArcFace model for embedding generation
      // For development, generate simulated embedding based on landmarks
      const embedding = this.generateSimulatedEmbedding(landmarks);

      // Calculate confidence based on landmark quality
      const avgConfidence =
        landmarks.reduce((sum, lm) => sum + lm.confidence, 0) / landmarks.length;

      logger.debug('Face embedding generated', {
        dimension: embedding.length,
        confidence: avgConfidence,
      });

      return {
        vector: embedding,
        confidence: avgConfidence,
      };
    } catch (error) {
      logger.error('Failed to generate face embedding', { error });
      throw new FaceProcessingError('Face embedding generation failed', {
        originalError: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Generate embeddings from multiple face samples
   */
  async generateEmbeddingsFromSamples(
    samples: Array<{ imageBuffer: Buffer; landmarks: FacialKeypoint[] }>
  ): Promise<FaceEmbedding[]> {
    const embeddings: FaceEmbedding[] = [];

    for (const sample of samples) {
      try {
        const embedding = await this.generateEmbedding(sample.imageBuffer, sample.landmarks);
        embeddings.push(embedding);
      } catch (error) {
        logger.warn('Failed to generate embedding for sample', { error });
        // Continue with other samples
      }
    }

    if (embeddings.length === 0) {
      throw new FaceProcessingError('Failed to generate any embeddings from samples');
    }

    return embeddings;
  }

  /**
   * Generate simulated embedding based on facial landmarks
   * Creates a deterministic embedding from landmark positions
   */
  private generateSimulatedEmbedding(landmarks: FacialKeypoint[]): number[] {
    const embedding: number[] = new Array(this.config.embeddingDimension).fill(0);

    // Use landmark positions to generate embedding features
    landmarks.forEach((lm, index) => {
      const baseIndex = index % this.config.embeddingDimension;
      embedding[baseIndex] += lm.x * 0.001;
      embedding[(baseIndex + 1) % this.config.embeddingDimension] += lm.y * 0.001;
      embedding[(baseIndex + 2) % this.config.embeddingDimension] += lm.confidence;
    });

    // Normalize the embedding vector
    return this.normalizeVector(embedding);
  }

  /**
   * Normalize vector to unit length (L2 normalization)
   */
  private normalizeVector(vector: number[]): number[] {
    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    if (magnitude === 0) return vector;
    return vector.map((val) => val / magnitude);
  }

  /**
   * Calculate cosine similarity between two embeddings
   */
  calculateSimilarity(embedding1: number[], embedding2: number[]): number {
    if (embedding1.length !== embedding2.length) {
      throw new FaceProcessingError('Embedding dimensions must match');
    }

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i];
      norm1 += embedding1[i] * embedding1[i];
      norm2 += embedding2[i] * embedding2[i];
    }

    const magnitude = Math.sqrt(norm1) * Math.sqrt(norm2);
    if (magnitude === 0) return 0;

    return dotProduct / magnitude;
  }

  /**
   * Calculate Euclidean distance between two embeddings
   */
  calculateEuclideanDistance(embedding1: number[], embedding2: number[]): number {
    if (embedding1.length !== embedding2.length) {
      throw new FaceProcessingError('Embedding dimensions must match');
    }

    let sumSquaredDiff = 0;
    for (let i = 0; i < embedding1.length; i++) {
      const diff = embedding1[i] - embedding2[i];
      sumSquaredDiff += diff * diff;
    }

    return Math.sqrt(sumSquaredDiff);
  }

  /**
   * Determine match strength based on similarity score
   */
  private getMatchStrength(similarity: number): 'strong' | 'moderate' | 'weak' | 'no_match' {
    if (similarity >= this.config.strongMatchThreshold) return 'strong';
    if (similarity >= this.config.moderateMatchThreshold) return 'moderate';
    if (similarity >= this.config.similarityThreshold) return 'weak';
    return 'no_match';
  }

  /**
   * Compare two face embeddings with detailed result
   */
  compareEmbeddings(
    embedding1: FaceEmbedding,
    embedding2: FaceEmbedding
  ): EmbeddingComparisonResult {
    const similarity = this.calculateSimilarity(embedding1.vector, embedding2.vector);
    const isMatch = similarity >= this.config.similarityThreshold;
    const confidence = Math.min(embedding1.confidence, embedding2.confidence);
    const matchStrength = this.getMatchStrength(similarity);

    return {
      similarity,
      isMatch,
      confidence,
      matchStrength,
    };
  }

  /**
   * Validate embedding quality
   */
  validateEmbedding(embedding: FaceEmbedding): EmbeddingValidationResult {
    const issues: string[] = [];
    let qualityScore = 100;

    // Check dimension
    const dimensionValid = embedding.vector.length === this.config.embeddingDimension;
    if (!dimensionValid) {
      issues.push(
        `Invalid embedding dimension: expected ${this.config.embeddingDimension}, got ${embedding.vector.length}`
      );
      qualityScore -= 50;
    }

    // Check for NaN or Infinity values
    const valuesValid = !embedding.vector.some((v) => !isFinite(v));
    if (!valuesValid) {
      issues.push('Embedding contains invalid values (NaN or Infinity)');
      qualityScore -= 30;
    }

    // Check vector magnitude (should be close to 1 for normalized vectors)
    const magnitude = Math.sqrt(embedding.vector.reduce((sum, v) => sum + v * v, 0));
    const magnitudeValid = Math.abs(magnitude - 1) <= 0.1;
    if (!magnitudeValid) {
      issues.push(
        `Embedding vector is not properly normalized (magnitude: ${magnitude.toFixed(4)})`
      );
      qualityScore -= 20;
    }

    // Check confidence
    if (embedding.confidence < 0.5) {
      issues.push('Low embedding confidence');
      qualityScore -= 10;
    }

    // Check for zero vector
    const isZeroVector = embedding.vector.every((v) => v === 0);
    if (isZeroVector) {
      issues.push('Embedding is a zero vector');
      qualityScore = 0;
    }

    return {
      isValid: issues.length === 0,
      issues,
      qualityScore: Math.max(0, qualityScore),
      dimensionValid,
      magnitudeValid,
      valuesValid,
    };
  }

  /**
   * Check consistency across multiple embeddings
   * Ensures all embeddings belong to the same identity
   */
  checkConsistency(embeddings: FaceEmbedding[]): ConsistencyCheckResult {
    if (embeddings.length < 2) {
      return {
        isConsistent: true,
        consistencyScore: 1.0,
        outlierIndices: [],
        pairwiseSimilarities: [],
        recommendations: [],
      };
    }

    const n = embeddings.length;
    const pairwiseSimilarities: number[][] = Array(n)
      .fill(null)
      .map(() => Array(n).fill(0));
    const avgSimilarities: number[] = [];

    // Calculate pairwise similarities
    for (let i = 0; i < n; i++) {
      let sum = 0;
      let count = 0;
      for (let j = 0; j < n; j++) {
        if (i !== j) {
          const sim = this.calculateSimilarity(embeddings[i].vector, embeddings[j].vector);
          pairwiseSimilarities[i][j] = sim;
          sum += sim;
          count++;
        }
      }
      avgSimilarities.push(count > 0 ? sum / count : 0);
    }

    // Find outliers (embeddings with low average similarity to others)
    const outlierIndices: number[] = [];
    const recommendations: string[] = [];

    avgSimilarities.forEach((avgSim, index) => {
      if (avgSim < this.config.outlierThreshold) {
        outlierIndices.push(index);
      }
    });

    // Calculate overall consistency score
    const validSimilarities = avgSimilarities.filter((_, i) => !outlierIndices.includes(i));
    const consistencyScore =
      validSimilarities.length > 0
        ? validSimilarities.reduce((a, b) => a + b, 0) / validSimilarities.length
        : 0;

    // Generate recommendations
    if (outlierIndices.length > 0) {
      recommendations.push(
        `${outlierIndices.length} sample(s) appear to be outliers and may not belong to the same identity`
      );
      recommendations.push('Consider removing outlier samples and re-uploading');
    }

    if (consistencyScore < this.config.minConsistencyScore) {
      recommendations.push('Overall consistency is low. Ensure all samples are of the same person');
    }

    return {
      isConsistent:
        consistencyScore >= this.config.minConsistencyScore && outlierIndices.length === 0,
      consistencyScore,
      outlierIndices,
      pairwiseSimilarities,
      recommendations,
    };
  }

  /**
   * Create face identity from multiple embeddings with validation
   */
  createIdentity(userId: string, embeddings: FaceEmbedding[]): FaceIdentity {
    if (embeddings.length < this.config.minSamplesForIdentity) {
      throw new FaceProcessingError(
        `Minimum ${this.config.minSamplesForIdentity} samples required for identity creation`
      );
    }

    // Validate all embeddings
    const validEmbeddings: FaceEmbedding[] = [];
    for (const embedding of embeddings) {
      const validation = this.validateEmbedding(embedding);
      if (validation.isValid) {
        validEmbeddings.push(embedding);
      } else {
        logger.warn('Skipping invalid embedding', { issues: validation.issues });
      }
    }

    if (validEmbeddings.length < this.config.minSamplesForIdentity) {
      throw new FaceProcessingError(
        `Only ${validEmbeddings.length} valid embeddings, need at least ${this.config.minSamplesForIdentity}`
      );
    }

    // Check consistency
    const consistency = this.checkConsistency(validEmbeddings);
    if (!consistency.isConsistent) {
      logger.warn('Embeddings have low consistency', {
        consistencyScore: consistency.consistencyScore,
        outlierCount: consistency.outlierIndices.length,
      });
    }

    // Remove outliers if any
    const cleanEmbeddings = validEmbeddings.filter(
      (_, i) => !consistency.outlierIndices.includes(i)
    );

    // Limit to max samples
    const limitedEmbeddings = cleanEmbeddings.slice(0, this.config.maxSamplesForIdentity);

    // Calculate average embedding
    const averageEmbedding = this.calculateAverageEmbedding(limitedEmbeddings.map((e) => e.vector));

    // Calculate quality distribution
    const confidences = limitedEmbeddings.map((e) => e.confidence);
    const qualityDistribution = this.calculateQualityDistribution(confidences);

    // Calculate overall confidence
    const avgConfidence =
      limitedEmbeddings.reduce((sum, e) => sum + e.confidence, 0) / limitedEmbeddings.length;

    const identity: FaceIdentity = {
      id: `identity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      embeddings: limitedEmbeddings,
      averageEmbedding,
      confidence: avgConfidence,
      sampleCount: limitedEmbeddings.length,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: {
        modelVersion: this.config.modelVersion,
        embeddingDimension: this.config.embeddingDimension,
        consistencyScore: consistency.consistencyScore,
        qualityDistribution,
      },
    };

    logger.info('Face identity created', {
      userId,
      identityId: identity.id,
      sampleCount: identity.sampleCount,
      confidence: identity.confidence,
      consistencyScore: consistency.consistencyScore,
    });

    return identity;
  }

  /**
   * Calculate quality distribution statistics
   */
  private calculateQualityDistribution(values: number[]): QualityDistribution {
    if (values.length === 0) {
      return { min: 0, max: 0, mean: 0, stdDev: 0 };
    }

    const min = Math.min(...values);
    const max = Math.max(...values);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);

    return { min, max, mean, stdDev };
  }

  /**
   * Calculate average embedding from multiple vectors
   */
  private calculateAverageEmbedding(vectors: number[][]): number[] {
    if (vectors.length === 0) return [];

    const dimension = vectors[0].length;
    const average = new Array(dimension).fill(0);

    vectors.forEach((vector) => {
      vector.forEach((val, i) => {
        average[i] += val;
      });
    });

    return this.normalizeVector(average.map((val) => val / vectors.length));
  }

  /**
   * Verify if a face matches an identity with detailed result
   */
  verifyIdentity(embedding: FaceEmbedding, identity: FaceIdentity): IdentityVerificationResult {
    // Compare against average embedding
    const avgSimilarity = this.calculateSimilarity(embedding.vector, identity.averageEmbedding);

    // Compare against all stored embeddings
    const allSimilarities = identity.embeddings.map((stored) =>
      this.calculateSimilarity(embedding.vector, stored.vector)
    );

    // Find best match
    const maxSimilarity = Math.max(...allSimilarities);
    const bestMatchIndex = allSimilarities.indexOf(maxSimilarity);

    // Use the higher of average or best match similarity
    const similarity = Math.max(avgSimilarity, maxSimilarity);
    const isVerified = similarity >= this.config.similarityThreshold;
    const matchStrength = this.getMatchStrength(similarity);

    return {
      isVerified,
      similarity,
      confidence: Math.min(embedding.confidence, identity.confidence),
      matchStrength,
      bestMatchIndex,
      allSimilarities,
    };
  }

  /**
   * Validate a new embedding against existing identity samples
   */
  validateAgainstIdentity(
    embedding: FaceEmbedding,
    identity: FaceIdentity
  ): { isValid: boolean; similarity: number; recommendation: string } {
    const verification = this.verifyIdentity(embedding, identity);

    let recommendation = '';
    if (!verification.isVerified) {
      recommendation =
        'The face does not match the existing identity. Please ensure you are uploading photos of the same person.';
    } else if (verification.matchStrength === 'weak') {
      recommendation =
        'The match is weak. Consider uploading a clearer photo with better lighting.';
    } else if (verification.matchStrength === 'moderate') {
      recommendation = 'Good match. The photo has been accepted.';
    } else {
      recommendation = 'Excellent match. The photo has been accepted.';
    }

    return {
      isValid: verification.isVerified,
      similarity: verification.similarity,
      recommendation,
    };
  }

  /**
   * Update identity with new embedding (with version increment)
   */
  updateIdentity(identity: FaceIdentity, newEmbedding: FaceEmbedding): FaceIdentity {
    // Validate the new embedding
    const validation = this.validateEmbedding(newEmbedding);
    if (!validation.isValid) {
      throw new FaceProcessingError('New embedding is invalid', {
        issues: validation.issues,
      });
    }

    // Verify the new embedding matches the identity
    const verification = this.verifyIdentity(newEmbedding, identity);
    if (!verification.isVerified) {
      throw new FaceProcessingError('New embedding does not match existing identity', {
        similarity: verification.similarity,
        threshold: this.config.similarityThreshold,
      });
    }

    // Add new embedding (up to max)
    const updatedEmbeddings = [...identity.embeddings];
    if (updatedEmbeddings.length < this.config.maxSamplesForIdentity) {
      updatedEmbeddings.push(newEmbedding);
    } else {
      // Replace oldest embedding (FIFO)
      updatedEmbeddings.shift();
      updatedEmbeddings.push(newEmbedding);
    }

    // Recalculate average
    const averageEmbedding = this.calculateAverageEmbedding(updatedEmbeddings.map((e) => e.vector));

    // Recalculate confidence
    const avgConfidence =
      updatedEmbeddings.reduce((sum, e) => sum + e.confidence, 0) / updatedEmbeddings.length;

    // Recalculate quality distribution
    const confidences = updatedEmbeddings.map((e) => e.confidence);
    const qualityDistribution = this.calculateQualityDistribution(confidences);

    // Recalculate consistency
    const consistency = this.checkConsistency(updatedEmbeddings);

    const updatedIdentity: FaceIdentity = {
      ...identity,
      embeddings: updatedEmbeddings,
      averageEmbedding,
      confidence: avgConfidence,
      sampleCount: updatedEmbeddings.length,
      version: identity.version + 1,
      updatedAt: new Date(),
      metadata: {
        modelVersion: identity.metadata?.modelVersion || this.config.modelVersion,
        embeddingDimension: identity.metadata?.embeddingDimension || this.config.embeddingDimension,
        consistencyScore: consistency.consistencyScore,
        qualityDistribution,
      },
    };

    logger.info('Face identity updated', {
      identityId: identity.id,
      newVersion: updatedIdentity.version,
      sampleCount: updatedIdentity.sampleCount,
    });

    return updatedIdentity;
  }

  /**
   * Cluster embeddings to find distinct identities
   * Uses simple agglomerative clustering
   */
  clusterEmbeddings(embeddings: FaceEmbedding[]): EmbeddingCluster[] {
    if (embeddings.length === 0) return [];

    const clusters: EmbeddingCluster[] = [];
    const assigned = new Set<number>();

    embeddings.forEach((embedding, i) => {
      if (assigned.has(i)) return;

      const memberIndices: number[] = [i];
      const clusterEmbeddings: FaceEmbedding[] = [embedding];
      assigned.add(i);

      // Find similar embeddings
      embeddings.forEach((other, j) => {
        if (i === j || assigned.has(j)) return;

        const similarity = this.calculateSimilarity(embedding.vector, other.vector);
        if (similarity >= this.config.similarityThreshold) {
          clusterEmbeddings.push(other);
          memberIndices.push(j);
          assigned.add(j);
        }
      });

      // Calculate cluster centroid
      const centroid = this.calculateAverageEmbedding(clusterEmbeddings.map((e) => e.vector));

      // Calculate intra-cluster similarity
      let intraClusterSimilarity = 1.0;
      if (clusterEmbeddings.length > 1) {
        let totalSim = 0;
        let count = 0;
        for (let a = 0; a < clusterEmbeddings.length; a++) {
          for (let b = a + 1; b < clusterEmbeddings.length; b++) {
            totalSim += this.calculateSimilarity(
              clusterEmbeddings[a].vector,
              clusterEmbeddings[b].vector
            );
            count++;
          }
        }
        intraClusterSimilarity = count > 0 ? totalSim / count : 1.0;
      }

      clusters.push({
        clusterId: `cluster_${clusters.length}`,
        centroid,
        embeddings: clusterEmbeddings,
        memberIndices,
        intraClusterSimilarity,
        size: clusterEmbeddings.length,
      });
    });

    logger.debug('Embeddings clustered', {
      totalEmbeddings: embeddings.length,
      clusterCount: clusters.length,
      clusterSizes: clusters.map((c) => c.size),
    });

    return clusters;
  }

  /**
   * Find the best matching identity from a list
   */
  findBestMatch(
    embedding: FaceEmbedding,
    identities: FaceIdentity[]
  ): { identity: FaceIdentity | null; verification: IdentityVerificationResult | null } {
    if (identities.length === 0) {
      return { identity: null, verification: null };
    }

    let bestIdentity: FaceIdentity | null = null;
    let bestVerification: IdentityVerificationResult | null = null;
    let bestSimilarity = -1;

    for (const identity of identities) {
      const verification = this.verifyIdentity(embedding, identity);
      if (verification.similarity > bestSimilarity) {
        bestSimilarity = verification.similarity;
        bestIdentity = identity;
        bestVerification = verification;
      }
    }

    // Only return if it meets the threshold
    if (bestVerification && bestVerification.isVerified) {
      return { identity: bestIdentity, verification: bestVerification };
    }

    return { identity: null, verification: bestVerification };
  }

  /**
   * Merge two identities (when confirmed to be the same person)
   */
  mergeIdentities(identity1: FaceIdentity, identity2: FaceIdentity): FaceIdentity {
    // Combine embeddings
    const allEmbeddings = [...identity1.embeddings, ...identity2.embeddings];

    // Check consistency of merged embeddings
    const consistency = this.checkConsistency(allEmbeddings);
    if (!consistency.isConsistent) {
      throw new FaceProcessingError('Cannot merge identities: embeddings are not consistent', {
        consistencyScore: consistency.consistencyScore,
      });
    }

    // Remove outliers and limit to max
    const cleanEmbeddings = allEmbeddings
      .filter((_, i) => !consistency.outlierIndices.includes(i))
      .slice(0, this.config.maxSamplesForIdentity);

    // Calculate new average
    const averageEmbedding = this.calculateAverageEmbedding(cleanEmbeddings.map((e) => e.vector));

    const avgConfidence =
      cleanEmbeddings.reduce((sum, e) => sum + e.confidence, 0) / cleanEmbeddings.length;

    const confidences = cleanEmbeddings.map((e) => e.confidence);
    const qualityDistribution = this.calculateQualityDistribution(confidences);

    const mergedIdentity: FaceIdentity = {
      id: identity1.id, // Keep the first identity's ID
      userId: identity1.userId,
      embeddings: cleanEmbeddings,
      averageEmbedding,
      confidence: avgConfidence,
      sampleCount: cleanEmbeddings.length,
      version: Math.max(identity1.version, identity2.version) + 1,
      createdAt: identity1.createdAt,
      updatedAt: new Date(),
      metadata: {
        modelVersion: this.config.modelVersion,
        embeddingDimension: this.config.embeddingDimension,
        consistencyScore: consistency.consistencyScore,
        qualityDistribution,
      },
    };

    logger.info('Identities merged', {
      identity1Id: identity1.id,
      identity2Id: identity2.id,
      mergedId: mergedIdentity.id,
      newSampleCount: mergedIdentity.sampleCount,
    });

    return mergedIdentity;
  }

  /**
   * Serialize identity for storage
   */
  serializeIdentity(identity: FaceIdentity): string {
    return JSON.stringify({
      ...identity,
      createdAt: identity.createdAt.toISOString(),
      updatedAt: identity.updatedAt.toISOString(),
    });
  }

  /**
   * Deserialize identity from storage
   */
  deserializeIdentity(data: string): FaceIdentity {
    const parsed = JSON.parse(data);
    return {
      ...parsed,
      createdAt: new Date(parsed.createdAt),
      updatedAt: new Date(parsed.updatedAt),
    };
  }

  /**
   * Check if identity needs re-embedding (model version mismatch)
   */
  needsReEmbedding(identity: FaceIdentity): boolean {
    if (!identity.metadata) return true;
    return identity.metadata.modelVersion !== this.config.modelVersion;
  }

  /**
   * Get embedding dimension
   */
  getEmbeddingDimension(): number {
    return this.config.embeddingDimension;
  }

  /**
   * Get similarity threshold
   */
  getSimilarityThreshold(): number {
    return this.config.similarityThreshold;
  }

  /**
   * Get current model version
   */
  getModelVersion(): string {
    return this.config.modelVersion;
  }

  /**
   * Get configuration
   */
  getConfig(): EmbeddingConfig {
    return { ...this.config };
  }
}
