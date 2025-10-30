import { PrismaClient, VoiceModel, Prisma } from '@prisma/client';

import { BaseRepository } from './BaseRepository';

/**
 * Voice Model Repository
 * Handles all database operations for voice models
 */
export class VoiceModelRepository implements BaseRepository<VoiceModel> {
  constructor(private prisma: PrismaClient) {}

  private buildWhereClause(where: any = {}, includeDeleted = false): any {
    if (includeDeleted) {
      return where;
    }
    return {
      ...where,
      deletedAt: null,
    };
  }

  async findById(id: string, includeDeleted = false): Promise<VoiceModel | null> {
    return this.prisma.voiceModel.findFirst({
      where: this.buildWhereClause({ id }, includeDeleted),
    });
  }

  async findMany(where: any = {}, includeDeleted = false): Promise<VoiceModel[]> {
    return this.prisma.voiceModel.findMany({
      where: this.buildWhereClause(where, includeDeleted),
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(where: any, includeDeleted = false): Promise<VoiceModel | null> {
    return this.prisma.voiceModel.findFirst({
      where: this.buildWhereClause(where, includeDeleted),
    });
  }

  async create(data: Prisma.VoiceModelCreateInput): Promise<VoiceModel> {
    return this.prisma.voiceModel.create({
      data,
    });
  }

  async update(id: string, data: Prisma.VoiceModelUpdateInput): Promise<VoiceModel> {
    return this.prisma.voiceModel.update({
      where: { id },
      data: {
        ...data,
        updatedAt: new Date(),
      },
    });
  }

  async delete(id: string): Promise<VoiceModel> {
    return this.prisma.voiceModel.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        updatedAt: new Date(),
      },
    });
  }

  async hardDelete(id: string): Promise<VoiceModel> {
    return this.prisma.voiceModel.delete({
      where: { id },
    });
  }

  async restore(id: string): Promise<VoiceModel> {
    return this.prisma.voiceModel.update({
      where: { id },
      data: {
        deletedAt: null,
        updatedAt: new Date(),
      },
    });
  }

  async count(where: any = {}, includeDeleted = false): Promise<number> {
    return this.prisma.voiceModel.count({
      where: this.buildWhereClause(where, includeDeleted),
    });
  }

  async exists(where: any, includeDeleted = false): Promise<boolean> {
    const count = await this.count(where, includeDeleted);
    return count > 0;
  }

  /**
   * Find voice models by user ID
   */
  async findByUserId(userId: string, includeDeleted = false): Promise<VoiceModel[]> {
    return this.findMany({ userId }, includeDeleted);
  }

  /**
   * Get active voice model for a user
   */
  async getActiveModel(userId: string): Promise<VoiceModel | null> {
    return this.findOne({ userId, isActive: true }, false);
  }

  /**
   * Set a voice model as active (deactivates others)
   */
  async setActive(id: string, userId: string): Promise<VoiceModel> {
    // Deactivate all other models for this user
    await this.prisma.voiceModel.updateMany({
      where: {
        userId,
        isActive: true,
        deletedAt: null,
      },
      data: {
        isActive: false,
        updatedAt: new Date(),
      },
    });

    // Activate the selected model
    return this.prisma.voiceModel.update({
      where: { id },
      data: {
        isActive: true,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Find voice models by provider
   */
  async findByProvider(
    userId: string,
    provider: string,
    includeDeleted = false
  ): Promise<VoiceModel[]> {
    return this.findMany({ userId, provider }, includeDeleted);
  }

  /**
   * Update quality score
   */
  async updateQualityScore(id: string, qualityScore: number): Promise<VoiceModel> {
    return this.prisma.voiceModel.update({
      where: { id },
      data: {
        qualityScore,
        updatedAt: new Date(),
      },
    });
  }
}
