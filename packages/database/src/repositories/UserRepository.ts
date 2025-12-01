import { PrismaClient, User, Prisma } from '@prisma/client';

import { BaseRepository, PaginatedResult, PaginationOptions } from './BaseRepository';

/**
 * User Repository
 * Handles all database operations for users
 */
export class UserRepository implements BaseRepository<User> {
  constructor(private prisma: PrismaClient) {}

  /**
   * Build where clause with soft delete filter
   */
  private buildWhereClause(
    where: Prisma.UserWhereInput = {},
    includeDeleted = false
  ): Prisma.UserWhereInput {
    if (includeDeleted) {
      return where;
    }
    return {
      ...where,
      deletedAt: null,
    };
  }

  async findById(id: string, includeDeleted = false): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: this.buildWhereClause({ id }, includeDeleted),
    });
  }

  async findByEmail(email: string, includeDeleted = false): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: this.buildWhereClause({ email }, includeDeleted),
    });
  }

  async findMany(where: Prisma.UserWhereInput = {}, includeDeleted = false): Promise<User[]> {
    return this.prisma.user.findMany({
      where: this.buildWhereClause(where, includeDeleted),
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(where: Prisma.UserWhereInput, includeDeleted = false): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: this.buildWhereClause(where, includeDeleted),
    });
  }

  async findWithPagination(
    where: Prisma.UserWhereInput = {},
    options: PaginationOptions,
    includeDeleted = false
  ): Promise<PaginatedResult<User>> {
    const { page, pageSize, orderBy = { createdAt: 'desc' } } = options;
    const skip = (page - 1) * pageSize;

    const whereClause = this.buildWhereClause(where, includeDeleted);

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where: whereClause,
        skip,
        take: pageSize,
        orderBy,
      }),
      this.prisma.user.count({ where: whereClause }),
    ]);

    const totalPages = Math.ceil(total / pageSize);

    return {
      data,
      total,
      page,
      pageSize,
      totalPages,
      hasNext: page < totalPages,
      hasPrevious: page > 1,
    };
  }

  async create(data: Prisma.UserCreateInput): Promise<User> {
    return this.prisma.user.create({
      data,
    });
  }

  async update(id: string, data: Prisma.UserUpdateInput): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data: {
        ...data,
        updatedAt: new Date(),
      },
    });
  }

  async delete(id: string): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        updatedAt: new Date(),
      },
    });
  }

  async hardDelete(id: string): Promise<User> {
    return this.prisma.user.delete({
      where: { id },
    });
  }

  async restore(id: string): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data: {
        deletedAt: null,
        updatedAt: new Date(),
      },
    });
  }

  async count(where: Prisma.UserWhereInput = {}, includeDeleted = false): Promise<number> {
    return this.prisma.user.count({
      where: this.buildWhereClause(where, includeDeleted),
    });
  }

  async exists(where: Prisma.UserWhereInput, includeDeleted = false): Promise<boolean> {
    const count = await this.prisma.user.count({
      where: this.buildWhereClause(where, includeDeleted),
    });
    return count > 0;
  }

  /**
   * Update user settings
   */
  async updateSettings(id: string, settings: Prisma.JsonValue): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data: {
        settings: settings as Prisma.InputJsonValue,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Increment conversation minutes used
   */
  async incrementConversationMinutes(id: string, minutes: number): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data: {
        conversationMinutesUsed: {
          increment: minutes,
        },
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Update subscription tier
   */
  async updateSubscriptionTier(id: string, tier: string): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data: {
        subscriptionTier: tier,
        updatedAt: new Date(),
      },
    });
  }
}
