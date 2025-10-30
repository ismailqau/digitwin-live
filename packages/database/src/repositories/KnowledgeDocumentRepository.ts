import { PrismaClient, KnowledgeDocument, Prisma } from '@prisma/client';

import { BaseRepository, PaginatedResult, PaginationOptions } from './BaseRepository';

/**
 * Knowledge Document Repository
 * Handles all database operations for knowledge documents
 */
export class KnowledgeDocumentRepository implements BaseRepository<KnowledgeDocument> {
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

  async findById(id: string, includeDeleted = false): Promise<KnowledgeDocument | null> {
    return this.prisma.knowledgeDocument.findFirst({
      where: this.buildWhereClause({ id }, includeDeleted),
    });
  }

  async findMany(where: any = {}, includeDeleted = false): Promise<KnowledgeDocument[]> {
    return this.prisma.knowledgeDocument.findMany({
      where: this.buildWhereClause(where, includeDeleted),
      orderBy: { uploadedAt: 'desc' },
    });
  }

  async findOne(where: any, includeDeleted = false): Promise<KnowledgeDocument | null> {
    return this.prisma.knowledgeDocument.findFirst({
      where: this.buildWhereClause(where, includeDeleted),
    });
  }

  async findByUserId(
    userId: string,
    options?: PaginationOptions,
    includeDeleted = false
  ): Promise<PaginatedResult<KnowledgeDocument> | KnowledgeDocument[]> {
    if (options) {
      return this.findWithPagination({ userId }, options, includeDeleted);
    }

    return this.findMany({ userId }, includeDeleted);
  }

  async findWithPagination(
    where: any = {},
    options: PaginationOptions,
    includeDeleted = false
  ): Promise<PaginatedResult<KnowledgeDocument>> {
    const { page, pageSize, orderBy = { uploadedAt: 'desc' } } = options;
    const skip = (page - 1) * pageSize;

    const whereClause = this.buildWhereClause(where, includeDeleted);

    const [data, total] = await Promise.all([
      this.prisma.knowledgeDocument.findMany({
        where: whereClause,
        skip,
        take: pageSize,
        orderBy,
      }),
      this.prisma.knowledgeDocument.count({ where: whereClause }),
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

  async create(data: Prisma.KnowledgeDocumentCreateInput): Promise<KnowledgeDocument> {
    return this.prisma.knowledgeDocument.create({
      data,
    });
  }

  async update(id: string, data: Prisma.KnowledgeDocumentUpdateInput): Promise<KnowledgeDocument> {
    return this.prisma.knowledgeDocument.update({
      where: { id },
      data,
    });
  }

  async delete(id: string): Promise<KnowledgeDocument> {
    return this.prisma.knowledgeDocument.update({
      where: { id },
      data: {
        deletedAt: new Date(),
      },
    });
  }

  async hardDelete(id: string): Promise<KnowledgeDocument> {
    return this.prisma.knowledgeDocument.delete({
      where: { id },
    });
  }

  async restore(id: string): Promise<KnowledgeDocument> {
    return this.prisma.knowledgeDocument.update({
      where: { id },
      data: {
        deletedAt: null,
      },
    });
  }

  async count(where: any = {}, includeDeleted = false): Promise<number> {
    return this.prisma.knowledgeDocument.count({
      where: this.buildWhereClause(where, includeDeleted),
    });
  }

  async exists(where: any, includeDeleted = false): Promise<boolean> {
    const count = await this.count(where, includeDeleted);
    return count > 0;
  }

  /**
   * Update document processing status
   */
  async updateStatus(
    id: string,
    status: string,
    errorMessage?: string
  ): Promise<KnowledgeDocument> {
    return this.prisma.knowledgeDocument.update({
      where: { id },
      data: {
        status,
        errorMessage,
        processedAt: status === 'completed' ? new Date() : undefined,
      },
    });
  }

  /**
   * Update vector IDs after embedding
   */
  async updateVectorIds(id: string, vectorIds: string[]): Promise<KnowledgeDocument> {
    return this.prisma.knowledgeDocument.update({
      where: { id },
      data: {
        vectorIds,
        chunkCount: vectorIds.length,
      },
    });
  }

  /**
   * Find documents by status
   */
  async findByStatus(status: string, includeDeleted = false): Promise<KnowledgeDocument[]> {
    return this.findMany({ status }, includeDeleted);
  }

  /**
   * Find pending documents for processing
   */
  async findPendingDocuments(limit = 10): Promise<KnowledgeDocument[]> {
    return this.prisma.knowledgeDocument.findMany({
      where: {
        status: 'pending',
        deletedAt: null,
      },
      orderBy: { uploadedAt: 'asc' },
      take: limit,
    });
  }

  /**
   * Search documents by tags
   */
  async searchByTags(
    userId: string,
    tags: string[],
    includeDeleted = false
  ): Promise<KnowledgeDocument[]> {
    return this.prisma.knowledgeDocument.findMany({
      where: this.buildWhereClause(
        {
          userId,
          tags: {
            hasSome: tags,
          },
        },
        includeDeleted
      ),
      orderBy: { uploadedAt: 'desc' },
    });
  }

  /**
   * Get user document statistics
   */
  async getUserStatistics(userId: string): Promise<{
    totalDocuments: number;
    totalSizeBytes: number;
    totalChunks: number;
    documentsByStatus: Record<string, number>;
  }> {
    const documents = await this.findMany({ userId }, false);

    const totalDocuments = documents.length;
    const totalSizeBytes = documents.reduce((sum, d) => sum + d.sizeBytes, 0);
    const totalChunks = documents.reduce((sum, d) => sum + d.chunkCount, 0);

    const documentsByStatus = documents.reduce(
      (acc, d) => {
        acc[d.status] = (acc[d.status] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    return {
      totalDocuments,
      totalSizeBytes,
      totalChunks,
      documentsByStatus,
    };
  }
}
