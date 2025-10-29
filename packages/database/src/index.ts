/**
 * Database Package
 * Provides database access layer with Prisma ORM and repository pattern
 */

// Export Prisma client and types
export * from '@prisma/client';

// Export connection manager
export { DatabaseConnection, handlePrismaError } from './connection';

// Export repositories
export { BaseRepository, PaginatedResult, PaginationOptions } from './repositories/BaseRepository';
export { UserRepository } from './repositories/UserRepository';
export { ConversationSessionRepository } from './repositories/ConversationSessionRepository';
export { KnowledgeDocumentRepository } from './repositories/KnowledgeDocumentRepository';
export { VoiceModelRepository } from './repositories/VoiceModelRepository';
export { FaceModelRepository } from './repositories/FaceModelRepository';
export { CacheRepository } from './repositories/CacheRepository';
export { RateLimitRepository } from './repositories/RateLimitRepository';
export { AuditLogRepository } from './repositories/AuditLogRepository';

// Export repository factory
import { PrismaClient } from '@prisma/client';
import { UserRepository } from './repositories/UserRepository';
import { ConversationSessionRepository } from './repositories/ConversationSessionRepository';
import { KnowledgeDocumentRepository } from './repositories/KnowledgeDocumentRepository';
import { VoiceModelRepository } from './repositories/VoiceModelRepository';
import { FaceModelRepository } from './repositories/FaceModelRepository';
import { CacheRepository } from './repositories/CacheRepository';
import { RateLimitRepository } from './repositories/RateLimitRepository';
import { AuditLogRepository } from './repositories/AuditLogRepository';

/**
 * Repository Factory
 * Creates repository instances with a shared Prisma client
 */
export class RepositoryFactory {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  getUserRepository(): UserRepository {
    return new UserRepository(this.prisma);
  }

  getConversationSessionRepository(): ConversationSessionRepository {
    return new ConversationSessionRepository(this.prisma);
  }

  getKnowledgeDocumentRepository(): KnowledgeDocumentRepository {
    return new KnowledgeDocumentRepository(this.prisma);
  }

  getVoiceModelRepository(): VoiceModelRepository {
    return new VoiceModelRepository(this.prisma);
  }

  getFaceModelRepository(): FaceModelRepository {
    return new FaceModelRepository(this.prisma);
  }

  getCacheRepository(): CacheRepository {
    return new CacheRepository(this.prisma);
  }

  getRateLimitRepository(): RateLimitRepository {
    return new RateLimitRepository(this.prisma);
  }

  getAuditLogRepository(): AuditLogRepository {
    return new AuditLogRepository(this.prisma);
  }
}
