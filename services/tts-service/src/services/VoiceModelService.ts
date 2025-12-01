/* eslint-disable @typescript-eslint/no-explicit-any */
import { PrismaClient, VoiceModel } from '@clone/database';
import { logger } from '@clone/logger';
import { TTSProvider } from '@clone/shared-types';

export interface VoiceModelCreateRequest {
  userId: string;
  provider: TTSProvider;
  modelPath: string;
  sampleRate?: number;
  qualityScore?: number;
  metadata?: Record<string, unknown>;
}

export interface VoiceModelUpdateRequest {
  qualityScore?: number;
  metadata?: Record<string, unknown>;
  isActive?: boolean;
}

export interface VoiceModelSearchFilters {
  userId?: string;
  provider?: TTSProvider;
  isActive?: boolean;
  minQualityScore?: number;
  createdAfter?: Date;
  createdBefore?: Date;
}

export interface VoiceModelAnalytics {
  totalModels: number;
  activeModels: number;
  modelsByProvider: Record<TTSProvider, number>;
  averageQualityScore: number;
  totalUsageCount: number;
  totalCost: number;
  storageUsedMb: number;
  lastUsed?: Date;
}

export interface VoiceModelUsageStats {
  modelId: string;
  usageCount: number;
  totalCost: number;
  averageLatency: number;
  lastUsed?: Date;
  qualityRating: number;
}

export interface VoiceModelExportData {
  model: VoiceModel;
  metadata: Record<string, unknown>;
  trainingData?: {
    sampleIds: string[];
    trainingJobId?: string;
  };
  analytics?: VoiceModelUsageStats;
}

export interface VoiceModelBackup {
  id: string;
  userId: string;
  models: VoiceModelExportData[];
  createdAt: Date;
  backupPath: string;
  sizeBytes: number;
}

export class VoiceModelService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly serviceLogger: typeof logger
  ) {}

  // ============================================================================
  // CRUD Operations
  // ============================================================================

  async createVoiceModel(request: VoiceModelCreateRequest): Promise<VoiceModel> {
    this.serviceLogger.info('Creating voice model', { request });

    try {
      // Validate user exists
      const user = await this.prisma.user.findUnique({
        where: { id: request.userId },
      });

      if (!user) {
        throw new Error(`User not found: ${request.userId}`);
      }

      // Deactivate other models if this is the first one or if quality is high
      const existingModels = await this.prisma.voiceModel.findMany({
        where: {
          userId: request.userId,
          deletedAt: null,
        },
      });

      const shouldActivate =
        existingModels.length === 0 || (request.qualityScore && request.qualityScore > 0.8);

      if (shouldActivate) {
        // Deactivate all existing models
        await this.prisma.voiceModel.updateMany({
          where: {
            userId: request.userId,
            isActive: true,
            deletedAt: null,
          },
          data: { isActive: false },
        });
      }

      const voiceModel = await this.prisma.voiceModel.create({
        data: {
          userId: request.userId,
          provider: request.provider,
          modelPath: request.modelPath,
          sampleRate: request.sampleRate || 22050,
          qualityScore: request.qualityScore || 0.0,
          isActive: Boolean(shouldActivate),
          status: 'completed',
          metadata: (request.metadata as any) || {},
        },
      });

      this.serviceLogger.info('Voice model created successfully', {
        modelId: voiceModel.id,
        userId: request.userId,
        provider: request.provider,
        isActive: voiceModel.isActive,
      });

      return voiceModel;
    } catch (error) {
      this.serviceLogger.error('Failed to create voice model', { error, request });
      throw error;
    }
  }

  async getVoiceModel(id: string, userId?: string): Promise<VoiceModel | null> {
    try {
      const where: any = {
        id,
        deletedAt: null,
      };

      if (userId) {
        where.userId = userId;
      }

      return await this.prisma.voiceModel.findFirst({ where });
    } catch (error) {
      this.serviceLogger.error('Failed to get voice model', { error, id, userId });
      throw error;
    }
  }

  async getUserVoiceModels(
    userId: string,
    filters?: VoiceModelSearchFilters,
    limit = 20,
    offset = 0
  ): Promise<{ models: VoiceModel[]; total: number }> {
    try {
      const where: any = {
        userId,
        deletedAt: null,
      };

      if (filters) {
        if (filters.provider) {
          where.provider = filters.provider;
        }
        if (filters.isActive !== undefined) {
          where.isActive = filters.isActive;
        }
        if (filters.minQualityScore) {
          where.qualityScore = { gte: filters.minQualityScore };
        }
        if (filters.createdAfter || filters.createdBefore) {
          where.createdAt = {};
          if (filters.createdAfter) {
            where.createdAt.gte = filters.createdAfter;
          }
          if (filters.createdBefore) {
            where.createdAt.lte = filters.createdBefore;
          }
        }
      }

      const [models, total] = await Promise.all([
        this.prisma.voiceModel.findMany({
          where,
          orderBy: [{ isActive: 'desc' }, { qualityScore: 'desc' }, { createdAt: 'desc' }],
          take: limit,
          skip: offset,
        }),
        this.prisma.voiceModel.count({ where }),
      ]);

      return { models, total };
    } catch (error) {
      this.serviceLogger.error('Failed to get user voice models', { error, userId, filters });
      throw error;
    }
  }

  async updateVoiceModel(
    id: string,
    userId: string,
    updates: VoiceModelUpdateRequest
  ): Promise<VoiceModel> {
    this.serviceLogger.info('Updating voice model', { id, userId, updates });

    try {
      // Verify ownership
      const existingModel = await this.getVoiceModel(id, userId);
      if (!existingModel) {
        throw new Error(`Voice model not found or access denied: ${id}`);
      }

      // If activating this model, deactivate others
      if (updates.isActive === true) {
        await this.prisma.voiceModel.updateMany({
          where: {
            userId,
            isActive: true,
            id: { not: id },
            deletedAt: null,
          },
          data: { isActive: false },
        });
      }

      const updatedModel = await this.prisma.voiceModel.update({
        where: { id },
        data: {
          ...updates,
          metadata: updates.metadata as any,
          updatedAt: new Date(),
        },
      });

      this.serviceLogger.info('Voice model updated successfully', {
        modelId: id,
        userId,
        updates,
      });

      return updatedModel;
    } catch (error) {
      this.serviceLogger.error('Failed to update voice model', { error, id, userId, updates });
      throw error;
    }
  }

  async deleteVoiceModel(id: string, userId: string): Promise<void> {
    this.serviceLogger.info('Deleting voice model', { id, userId });

    try {
      // Verify ownership
      const existingModel = await this.getVoiceModel(id, userId);
      if (!existingModel) {
        throw new Error(`Voice model not found or access denied: ${id}`);
      }

      // Soft delete
      await this.prisma.voiceModel.update({
        where: { id },
        data: {
          deletedAt: new Date(),
          isActive: false,
        },
      });

      // If this was the active model, activate the next best one
      if (existingModel.isActive) {
        const nextBestModel = await this.prisma.voiceModel.findFirst({
          where: {
            userId,
            deletedAt: null,
            id: { not: id },
          },
          orderBy: [{ qualityScore: 'desc' }, { createdAt: 'desc' }],
        });

        if (nextBestModel) {
          await this.prisma.voiceModel.update({
            where: { id: nextBestModel.id },
            data: { isActive: true },
          });

          this.serviceLogger.info('Activated next best voice model', {
            newActiveModelId: nextBestModel.id,
            userId,
          });
        }
      }

      this.serviceLogger.info('Voice model deleted successfully', { id, userId });
    } catch (error) {
      this.serviceLogger.error('Failed to delete voice model', { error, id, userId });
      throw error;
    }
  }

  // ============================================================================
  // Activation/Deactivation
  // ============================================================================

  async activateVoiceModel(id: string, userId: string): Promise<VoiceModel> {
    return this.updateVoiceModel(id, userId, { isActive: true });
  }

  async deactivateVoiceModel(id: string, userId: string): Promise<VoiceModel> {
    return this.updateVoiceModel(id, userId, { isActive: false });
  }

  async getActiveVoiceModel(userId: string): Promise<VoiceModel | null> {
    try {
      return await this.prisma.voiceModel.findFirst({
        where: {
          userId,
          isActive: true,
          deletedAt: null,
        },
      });
    } catch (error) {
      this.serviceLogger.error('Failed to get active voice model', { error, userId });
      throw error;
    }
  }

  // ============================================================================
  // Comparison and Selection
  // ============================================================================

  async compareVoiceModels(
    modelIds: string[],
    userId: string
  ): Promise<Array<VoiceModel & { usageStats?: VoiceModelUsageStats }>> {
    try {
      const models = await this.prisma.voiceModel.findMany({
        where: {
          id: { in: modelIds },
          userId,
          deletedAt: null,
        },
      });

      // Get usage stats for each model
      const modelsWithStats = await Promise.all(
        models.map(async (model) => {
          const usageStats = await this.getVoiceModelUsageStats(model.id);
          return {
            ...model,
            usageStats: usageStats || undefined,
          };
        })
      );

      return modelsWithStats;
    } catch (error) {
      this.serviceLogger.error('Failed to compare voice models', { error, modelIds, userId });
      throw error;
    }
  }

  async selectBestVoiceModel(
    userId: string,
    criteria?: {
      minQualityScore?: number;
      preferredProvider?: TTSProvider;
      maxLatency?: number;
    }
  ): Promise<VoiceModel | null> {
    try {
      const where: any = {
        userId,
        deletedAt: null,
      };

      if (criteria?.minQualityScore) {
        where.qualityScore = { gte: criteria.minQualityScore };
      }

      if (criteria?.preferredProvider) {
        where.provider = criteria.preferredProvider;
      }

      const models = await this.prisma.voiceModel.findMany({
        where,
        orderBy: [{ qualityScore: 'desc' }, { createdAt: 'desc' }],
      });

      if (models.length === 0) {
        return null;
      }

      // If latency criteria is specified, filter by usage stats
      if (criteria?.maxLatency) {
        for (const model of models) {
          const usageStats = await this.getVoiceModelUsageStats(model.id);
          if (!usageStats || usageStats.averageLatency <= criteria.maxLatency) {
            return model;
          }
        }
        return null;
      }

      return models[0];
    } catch (error) {
      this.serviceLogger.error('Failed to select best voice model', { error, userId, criteria });
      throw error;
    }
  }

  // ============================================================================
  // Analytics and Usage Stats
  // ============================================================================

  async getVoiceModelAnalytics(userId: string): Promise<VoiceModelAnalytics> {
    try {
      const models = await this.prisma.voiceModel.findMany({
        where: {
          userId,
          deletedAt: null,
        },
      });

      const totalModels = models.length;
      const activeModels = models.filter((m) => m.isActive).length;

      const modelsByProvider = models.reduce(
        (acc, model) => {
          acc[model.provider as TTSProvider] = (acc[model.provider as TTSProvider] || 0) + 1;
          return acc;
        },
        {} as Record<TTSProvider, number>
      );

      const averageQualityScore =
        totalModels > 0 ? models.reduce((sum, m) => sum + m.qualityScore, 0) / totalModels : 0;

      // Get usage stats from conversation turns (simplified)
      const usageStats = await this.prisma.conversationTurn.aggregate({
        where: {
          session: {
            userId,
            voiceModelId: { in: models.map((m) => m.id) },
          },
        },
        _sum: {
          ttsCost: true,
        },
        _count: {
          id: true,
        },
        _max: {
          timestamp: true,
        },
      });

      // Calculate storage usage (simplified - would need actual file sizes)
      const storageUsedMb = models.length * 50; // Estimate 50MB per model

      return {
        totalModels,
        activeModels,
        modelsByProvider,
        averageQualityScore,
        totalUsageCount: usageStats._count.id || 0,
        totalCost: usageStats._sum.ttsCost || 0,
        storageUsedMb,
        lastUsed: usageStats._max.timestamp || undefined,
      };
    } catch (error) {
      this.serviceLogger.error('Failed to get voice model analytics', { error, userId });
      throw error;
    }
  }

  async getVoiceModelUsageStats(modelId: string): Promise<VoiceModelUsageStats | null> {
    try {
      const usageStats = await this.prisma.conversationTurn.aggregate({
        where: {
          session: {
            voiceModelId: modelId,
          },
        },
        _count: {
          id: true,
        },
        _sum: {
          ttsCost: true,
        },
        _avg: {
          ttsLatencyMs: true,
        },
        _max: {
          timestamp: true,
        },
      });

      if (usageStats._count.id === 0) {
        return null;
      }

      return {
        modelId,
        usageCount: usageStats._count.id,
        totalCost: usageStats._sum.ttsCost || 0,
        averageLatency: usageStats._avg.ttsLatencyMs || 0,
        lastUsed: usageStats._max.timestamp || undefined,
        qualityRating: 0, // Would be calculated from user feedback
      };
    } catch (error) {
      this.serviceLogger.error('Failed to get voice model usage stats', { error, modelId });
      return null;
    }
  }

  // ============================================================================
  // Export and Backup
  // ============================================================================

  async exportVoiceModel(id: string, userId: string): Promise<VoiceModelExportData> {
    try {
      const model = await this.getVoiceModel(id, userId);
      if (!model) {
        throw new Error(`Voice model not found or access denied: ${id}`);
      }

      // Get training data
      const trainingJobs = await this.prisma.trainingJob.findMany({
        where: {
          voiceModelId: id,
          userId,
        },
        include: {
          trainingJobVoiceSamples: {
            include: {
              voiceSample: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 1,
      });

      const trainingData =
        trainingJobs.length > 0
          ? {
              sampleIds: trainingJobs[0].trainingJobVoiceSamples.map((tjs) => tjs.voiceSample.id),
              trainingJobId: trainingJobs[0].id,
            }
          : undefined;

      // Get analytics
      const analytics = await this.getVoiceModelUsageStats(id);

      return {
        model,
        metadata: model.metadata as Record<string, unknown>,
        trainingData,
        analytics: analytics || undefined,
      };
    } catch (error) {
      this.serviceLogger.error('Failed to export voice model', { error, id, userId });
      throw error;
    }
  }

  async createBackup(userId: string): Promise<VoiceModelBackup> {
    try {
      const { models } = await this.getUserVoiceModels(userId);

      const exportData = await Promise.all(
        models.map((model) => this.exportVoiceModel(model.id, userId))
      );

      const backupId = `backup_${userId}_${Date.now()}`;
      const backupPath = `gs://digitwin-live-voice-models/backups/${userId}/${backupId}.json`;

      // Store backup data (simplified - would use actual storage service)
      const backupData = {
        id: backupId,
        userId,
        models: exportData,
        createdAt: new Date(),
        version: '1.0',
      };

      // Calculate size (simplified)
      const sizeBytes = JSON.stringify(backupData).length;

      // In real implementation, would upload to GCS
      // await this.storageService.uploadJson(backupPath, backupData);

      this.serviceLogger.info('Voice model backup created', {
        backupId,
        userId,
        modelCount: models.length,
        sizeBytes,
      });

      return {
        id: backupId,
        userId,
        models: exportData,
        createdAt: new Date(),
        backupPath,
        sizeBytes,
      };
    } catch (error) {
      this.serviceLogger.error('Failed to create voice model backup', { error, userId });
      throw error;
    }
  }

  async restoreFromBackup(
    userId: string,
    backupPath: string,
    options?: {
      overwriteExisting?: boolean;
      activateRestored?: boolean;
    }
  ): Promise<VoiceModel[]> {
    try {
      // In real implementation, would download from GCS
      // const backupData = await this.storageService.downloadJson(backupPath);

      // For now, simulate backup data structure
      const backupData = {
        models: [] as VoiceModelExportData[],
      };

      const restoredModels: VoiceModel[] = [];

      for (const exportData of backupData.models) {
        // Check if model already exists
        const existingModel = await this.prisma.voiceModel.findFirst({
          where: {
            userId,
            provider: exportData.model.provider,
            modelPath: exportData.model.modelPath,
            deletedAt: null,
          },
        });

        if (existingModel && !options?.overwriteExisting) {
          this.serviceLogger.warn('Skipping existing model during restore', {
            modelId: existingModel.id,
            provider: exportData.model.provider,
          });
          continue;
        }

        // Create or update model
        const modelData = {
          userId,
          provider: exportData.model.provider,
          modelPath: exportData.model.modelPath,
          sampleRate: exportData.model.sampleRate,
          qualityScore: exportData.model.qualityScore,
          isActive: options?.activateRestored || false,
          metadata: exportData.metadata as any,
        };

        let restoredModel: VoiceModel;

        if (existingModel && options?.overwriteExisting) {
          restoredModel = await this.prisma.voiceModel.update({
            where: { id: existingModel.id },
            data: modelData,
          });
        } else {
          restoredModel = await this.prisma.voiceModel.create({
            data: modelData,
          });
        }

        restoredModels.push(restoredModel);
      }

      this.serviceLogger.info('Voice models restored from backup', {
        userId,
        backupPath,
        restoredCount: restoredModels.length,
      });

      return restoredModels;
    } catch (error) {
      this.serviceLogger.error('Failed to restore from backup', { error, userId, backupPath });
      throw error;
    }
  }

  // ============================================================================
  // Cleanup and Expiration
  // ============================================================================

  async cleanupExpiredModels(): Promise<number> {
    try {
      // Define expiration criteria
      const expirationDate = new Date();
      expirationDate.setMonth(expirationDate.getMonth() - 6); // 6 months old

      // Find models to clean up (inactive, old, low quality)
      const modelsToCleanup = await this.prisma.voiceModel.findMany({
        where: {
          deletedAt: null,
          isActive: false,
          qualityScore: { lt: 0.5 },
          createdAt: { lt: expirationDate },
        },
      });

      let cleanedCount = 0;

      for (const model of modelsToCleanup) {
        // Check if model has been used recently
        const recentUsage = await this.prisma.conversationTurn.findFirst({
          where: {
            session: {
              voiceModelId: model.id,
            },
            timestamp: {
              gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days
            },
          },
        });

        if (!recentUsage) {
          // Safe to delete
          await this.prisma.voiceModel.update({
            where: { id: model.id },
            data: { deletedAt: new Date() },
          });

          // In real implementation, would also delete model files from storage
          // await this.storageService.deleteFile(model.modelPath);

          cleanedCount++;

          this.serviceLogger.info('Cleaned up expired voice model', {
            modelId: model.id,
            userId: model.userId,
            provider: model.provider,
            qualityScore: model.qualityScore,
          });
        }
      }

      this.serviceLogger.info('Voice model cleanup completed', {
        cleanedCount,
        totalChecked: modelsToCleanup.length,
      });

      return cleanedCount;
    } catch (error) {
      this.serviceLogger.error('Failed to cleanup expired models', { error });
      throw error;
    }
  }

  async getExpiringModels(userId?: string): Promise<VoiceModel[]> {
    try {
      const warningDate = new Date();
      warningDate.setMonth(warningDate.getMonth() - 5); // Warn 1 month before expiration

      const where: any = {
        deletedAt: null,
        isActive: false,
        qualityScore: { lt: 0.5 },
        createdAt: { lt: warningDate },
      };

      if (userId) {
        where.userId = userId;
      }

      return await this.prisma.voiceModel.findMany({
        where,
        orderBy: { createdAt: 'asc' },
      });
    } catch (error) {
      this.serviceLogger.error('Failed to get expiring models', { error, userId });
      throw error;
    }
  }

  // ============================================================================
  // Sharing (Optional - for teams)
  // ============================================================================

  async shareVoiceModel(
    modelId: string,
    ownerId: string,
    targetUserIds: string[],
    permissions: 'read' | 'use' = 'use'
  ): Promise<void> {
    try {
      // Verify ownership
      const model = await this.getVoiceModel(modelId, ownerId);
      if (!model) {
        throw new Error(`Voice model not found or access denied: ${modelId}`);
      }

      // In a real implementation, would create sharing records
      // For now, just log the sharing action
      this.serviceLogger.info('Voice model shared', {
        modelId,
        ownerId,
        targetUserIds,
        permissions,
      });

      // Could implement via a separate VoiceModelSharing table
      // await this.prisma.voiceModelSharing.createMany({
      //   data: targetUserIds.map(userId => ({
      //     modelId,
      //     ownerId,
      //     sharedWithUserId: userId,
      //     permissions,
      //   })),
      // });
    } catch (error) {
      this.serviceLogger.error('Failed to share voice model', {
        error,
        modelId,
        ownerId,
        targetUserIds,
      });
      throw error;
    }
  }

  async getSharedVoiceModels(userId: string): Promise<VoiceModel[]> {
    try {
      // In a real implementation, would query sharing table
      // For now, return empty array
      this.serviceLogger.info('Getting shared voice models', { userId });
      return [];
    } catch (error) {
      this.serviceLogger.error('Failed to get shared voice models', { error, userId });
      throw error;
    }
  }
}
