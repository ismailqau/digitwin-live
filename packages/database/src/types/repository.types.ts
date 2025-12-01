import { Prisma } from '@prisma/client';

/**
 * Generic where clause type for Prisma queries
 */
export type WhereClause<T> = Partial<T> & {
  AND?: WhereClause<T>[];
  OR?: WhereClause<T>[];
  NOT?: WhereClause<T>;
};

/**
 * Prisma where input types for each model
 */
export type UserWhereInput = Prisma.UserWhereInput;
export type FaceModelWhereInput = Prisma.FaceModelWhereInput;
export type VoiceModelWhereInput = Prisma.VoiceModelWhereInput;
export type KnowledgeDocumentWhereInput = Prisma.KnowledgeDocumentWhereInput;
export type ConversationSessionWhereInput = Prisma.ConversationSessionWhereInput;
export type AuditLogWhereInput = Prisma.AuditLogWhereInput;

/**
 * Prisma create input types
 */
export type UserCreateInput = Prisma.UserCreateInput;
export type FaceModelCreateInput = Prisma.FaceModelCreateInput;
export type VoiceModelCreateInput = Prisma.VoiceModelCreateInput;
export type KnowledgeDocumentCreateInput = Prisma.KnowledgeDocumentCreateInput;
export type ConversationSessionCreateInput = Prisma.ConversationSessionCreateInput;
export type AuditLogCreateInput = Prisma.AuditLogCreateInput;

/**
 * Prisma update input types
 */
export type UserUpdateInput = Prisma.UserUpdateInput;
export type FaceModelUpdateInput = Prisma.FaceModelUpdateInput;
export type VoiceModelUpdateInput = Prisma.VoiceModelUpdateInput;
export type KnowledgeDocumentUpdateInput = Prisma.KnowledgeDocumentUpdateInput;
export type ConversationSessionUpdateInput = Prisma.ConversationSessionUpdateInput;

/**
 * Prisma order by types
 */
export type UserOrderByInput = Prisma.UserOrderByWithRelationInput;
export type FaceModelOrderByInput = Prisma.FaceModelOrderByWithRelationInput;
export type VoiceModelOrderByInput = Prisma.VoiceModelOrderByWithRelationInput;
export type KnowledgeDocumentOrderByInput = Prisma.KnowledgeDocumentOrderByWithRelationInput;
export type ConversationSessionOrderByInput = Prisma.ConversationSessionOrderByWithRelationInput;
export type AuditLogOrderByInput = Prisma.AuditLogOrderByWithRelationInput;

/**
 * JSON value type for metadata fields
 */
export type JsonValue = Prisma.JsonValue;

/**
 * Pagination options
 */
export interface PaginationOptions {
  page: number;
  pageSize: number;
  orderBy?: Record<string, 'asc' | 'desc'>;
}

/**
 * Paginated result
 */
export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * Audio chunk cache pattern
 */
export interface AudioChunkCachePattern {
  sessionId?: string;
  userId?: string;
  chunkIndex?: number;
}

/**
 * Error with code property
 */
export interface PrismaErrorWithCode extends Error {
  code?: string;
  meta?: Record<string, unknown>;
}
