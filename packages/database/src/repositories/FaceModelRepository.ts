import { PrismaClient, FaceModel, Prisma } from '@prisma/client';
import { BaseRepository } from './BaseRepository';

/**
 * Face Model Repository
 * Handles all database operations for face models
 */
export class FaceModelRepository implements BaseRepository<FaceModel> {
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

  async findById(id: string, includeDeleted = false): Promise<FaceModel | null> {
    return this.prisma.faceModel.findFirst({
      where: this.buildWhereClause({ id }, includeDeleted),
    });
  }

  async findMany(where: any = {}, includeDeleted = false): Promise<FaceModel[]> {
    return this.prisma.faceModel.findMany({
      where: this.buildWhereClause(where, includeDeleted),
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(where: any, includeDeleted = false): Promise<FaceModel | null> {
    return this.prisma.faceModel.findFirst({
      where: this.buildWhereClause(where, includeDeleted),
    });
  }

  async create(data: Prisma.FaceModelCreateInput): Promise<FaceModel> {
    return this.prisma.faceModel.create({
      data,
    });
  }

  async update(id: string, data: Prisma.FaceModelUpdateInput): Promise<FaceModel> {
    return this.prisma.faceModel.update({
      where: { id },
      data: {
        ...data,
        updatedAt: new Date(),
      },
    });
  }

  async delete(id: string): Promise<FaceModel> {
    return this.prisma.faceModel.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        updatedAt: new Date(),
      },
    });
  }

  async hardDelete(id: string): Promise<FaceModel> {
    return this.prisma.faceModel.delete({
      where: { id },
    });
  }

  async restore(id: string): Promise<FaceModel> {
    return this.prisma.faceModel.update({
      where: { id },
      data: {
        deletedAt: null,
        updatedAt: new Date(),
      },
    });
  }

  async count(where: any = {}, includeDeleted = false): Promise<number> {
    return this.prisma.faceModel.count({
      where: this.buildWhereClause(where, includeDeleted),
    });
  }

  async exists(where: any, includeDeleted = false): Promise<boolean> {
    const count = await this.count(where, includeDeleted);
    return count > 0;
  }

  /**
   * Find face models by user ID
   */
  async findByUserId(userId: string, includeDeleted = false): Promise<FaceModel[]> {
    return this.findMany({ userId }, includeDeleted);
  }

  /**
   * Get active face model for a user
   */
  async getActiveModel(userId: string): Promise<FaceModel | null> {
    return this.findOne({ userId, isActive: true }, false);
  }

  /**
   * Set a face model as active (deactivates others)
   */
  async setActive(id: string, userId: string): Promise<FaceModel> {
    // Deactivate all other models for this user
    await this.prisma.faceModel.updateMany({
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
    return this.prisma.faceModel.update({
      where: { id },
      data: {
        isActive: true,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Update quality score
   */
  async updateQualityScore(id: string, qualityScore: number): Promise<FaceModel> {
    return this.prisma.faceModel.update({
      where: { id },
      data: {
        qualityScore,
        updatedAt: new Date(),
      },
    });
  }
}
