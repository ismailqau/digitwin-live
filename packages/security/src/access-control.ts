/**
 * Access Control for user data isolation and resource ownership validation
 */

import { UnauthorizedError, ForbiddenError } from '@clone/errors';
import { PrismaClient } from '@prisma/client';

import { AuditLogger } from './audit-logger';
import { ResourceType } from './types';

export class AccessControl {
  private prisma: PrismaClient;
  private auditLogger: AuditLogger;

  constructor(prisma: PrismaClient, auditLogger: AuditLogger) {
    this.prisma = prisma;
    this.auditLogger = auditLogger;
  }

  /**
   * Verify user owns a document
   */
  async verifyDocumentOwnership(
    userId: string,
    documentId: string,
    ipAddress?: string
  ): Promise<void> {
    const document = await this.prisma.knowledgeDocument.findUnique({
      where: { id: documentId },
      select: { userId: true, deletedAt: true },
    });

    if (!document) {
      await this.auditLogger.logUnauthorizedAccess(
        userId,
        ResourceType.DOCUMENT,
        documentId,
        ipAddress,
        { reason: 'document_not_found' }
      );
      throw new UnauthorizedError('Document not found');
    }

    if (document.deletedAt) {
      await this.auditLogger.logUnauthorizedAccess(
        userId,
        ResourceType.DOCUMENT,
        documentId,
        ipAddress,
        { reason: 'document_deleted' }
      );
      throw new UnauthorizedError('Document has been deleted');
    }

    if (document.userId !== userId) {
      await this.auditLogger.logCrossUserAccessAttempt(
        userId,
        document.userId,
        ResourceType.DOCUMENT,
        documentId,
        ipAddress
      );
      throw new ForbiddenError('You do not have access to this document');
    }
  }

  /**
   * Verify user owns a voice model
   */
  async verifyVoiceModelOwnership(
    userId: string,
    voiceModelId: string,
    ipAddress?: string
  ): Promise<void> {
    const voiceModel = await this.prisma.voiceModel.findUnique({
      where: { id: voiceModelId },
      select: { userId: true, deletedAt: true },
    });

    if (!voiceModel) {
      await this.auditLogger.logUnauthorizedAccess(
        userId,
        ResourceType.VOICE_MODEL,
        voiceModelId,
        ipAddress,
        { reason: 'voice_model_not_found' }
      );
      throw new UnauthorizedError('Voice model not found');
    }

    if (voiceModel.deletedAt) {
      await this.auditLogger.logUnauthorizedAccess(
        userId,
        ResourceType.VOICE_MODEL,
        voiceModelId,
        ipAddress,
        { reason: 'voice_model_deleted' }
      );
      throw new UnauthorizedError('Voice model has been deleted');
    }

    if (voiceModel.userId !== userId) {
      await this.auditLogger.logCrossUserAccessAttempt(
        userId,
        voiceModel.userId,
        ResourceType.VOICE_MODEL,
        voiceModelId,
        ipAddress
      );
      throw new ForbiddenError('You do not have access to this voice model');
    }
  }

  /**
   * Verify user owns a voice sample
   */
  async verifyVoiceSampleOwnership(
    userId: string,
    voiceSampleId: string,
    ipAddress?: string
  ): Promise<void> {
    const voiceSample = await this.prisma.voiceSample.findUnique({
      where: { id: voiceSampleId },
      select: { userId: true, deletedAt: true },
    });

    if (!voiceSample) {
      await this.auditLogger.logUnauthorizedAccess(
        userId,
        ResourceType.VOICE_SAMPLE,
        voiceSampleId,
        ipAddress,
        { reason: 'voice_sample_not_found' }
      );
      throw new UnauthorizedError('Voice sample not found');
    }

    if (voiceSample.deletedAt) {
      await this.auditLogger.logUnauthorizedAccess(
        userId,
        ResourceType.VOICE_SAMPLE,
        voiceSampleId,
        ipAddress,
        { reason: 'voice_sample_deleted' }
      );
      throw new UnauthorizedError('Voice sample has been deleted');
    }

    if (voiceSample.userId !== userId) {
      await this.auditLogger.logCrossUserAccessAttempt(
        userId,
        voiceSample.userId,
        ResourceType.VOICE_SAMPLE,
        voiceSampleId,
        ipAddress
      );
      throw new ForbiddenError('You do not have access to this voice sample');
    }
  }

  /**
   * Verify user owns a face model
   */
  async verifyFaceModelOwnership(
    userId: string,
    faceModelId: string,
    ipAddress?: string
  ): Promise<void> {
    const faceModel = await this.prisma.faceModel.findUnique({
      where: { id: faceModelId },
      select: { userId: true, deletedAt: true },
    });

    if (!faceModel) {
      await this.auditLogger.logUnauthorizedAccess(
        userId,
        ResourceType.FACE_MODEL,
        faceModelId,
        ipAddress,
        { reason: 'face_model_not_found' }
      );
      throw new UnauthorizedError('Face model not found');
    }

    if (faceModel.deletedAt) {
      await this.auditLogger.logUnauthorizedAccess(
        userId,
        ResourceType.FACE_MODEL,
        faceModelId,
        ipAddress,
        { reason: 'face_model_deleted' }
      );
      throw new UnauthorizedError('Face model has been deleted');
    }

    if (faceModel.userId !== userId) {
      await this.auditLogger.logCrossUserAccessAttempt(
        userId,
        faceModel.userId,
        ResourceType.FACE_MODEL,
        faceModelId,
        ipAddress
      );
      throw new ForbiddenError('You do not have access to this face model');
    }
  }

  /**
   * Verify user owns a conversation session
   */
  async verifyConversationOwnership(
    userId: string,
    sessionId: string,
    ipAddress?: string
  ): Promise<void> {
    const session = await this.prisma.conversationSession.findUnique({
      where: { id: sessionId },
      select: { userId: true },
    });

    if (!session) {
      await this.auditLogger.logUnauthorizedAccess(
        userId,
        ResourceType.CONVERSATION,
        sessionId,
        ipAddress,
        { reason: 'conversation_not_found' }
      );
      throw new UnauthorizedError('Conversation not found');
    }

    if (session.userId !== userId) {
      await this.auditLogger.logCrossUserAccessAttempt(
        userId,
        session.userId,
        ResourceType.CONVERSATION,
        sessionId,
        ipAddress
      );
      throw new ForbiddenError('You do not have access to this conversation');
    }
  }

  /**
   * Verify user owns an FAQ
   */
  async verifyFAQOwnership(userId: string, faqId: string, ipAddress?: string): Promise<void> {
    const faq = await this.prisma.fAQ.findUnique({
      where: { id: faqId },
      select: { userId: true, deletedAt: true },
    });

    if (!faq) {
      await this.auditLogger.logUnauthorizedAccess(userId, ResourceType.FAQ, faqId, ipAddress, {
        reason: 'faq_not_found',
      });
      throw new UnauthorizedError('FAQ not found');
    }

    if (faq.deletedAt) {
      await this.auditLogger.logUnauthorizedAccess(userId, ResourceType.FAQ, faqId, ipAddress, {
        reason: 'faq_deleted',
      });
      throw new UnauthorizedError('FAQ has been deleted');
    }

    if (faq.userId !== userId) {
      await this.auditLogger.logCrossUserAccessAttempt(
        userId,
        faq.userId,
        ResourceType.FAQ,
        faqId,
        ipAddress
      );
      throw new ForbiddenError('You do not have access to this FAQ');
    }
  }

  /**
   * Get user's resource IDs for bulk operations
   * This ensures queries are filtered by userId
   */
  async getUserDocumentIds(userId: string): Promise<string[]> {
    const documents = await this.prisma.knowledgeDocument.findMany({
      where: {
        userId,
        deletedAt: null,
      },
      select: { id: true },
    });
    return documents.map((d: { id: string }) => d.id);
  }

  /**
   * Get user's voice model IDs
   */
  async getUserVoiceModelIds(userId: string): Promise<string[]> {
    const models = await this.prisma.voiceModel.findMany({
      where: {
        userId,
        deletedAt: null,
      },
      select: { id: true },
    });
    return models.map((m: { id: string }) => m.id);
  }

  /**
   * Get user's face model IDs
   */
  async getUserFaceModelIds(userId: string): Promise<string[]> {
    const models = await this.prisma.faceModel.findMany({
      where: {
        userId,
        deletedAt: null,
      },
      select: { id: true },
    });
    return models.map((m: { id: string }) => m.id);
  }

  /**
   * Get user's conversation session IDs
   */
  async getUserConversationIds(userId: string): Promise<string[]> {
    const sessions = await this.prisma.conversationSession.findMany({
      where: { userId },
      select: { id: true },
    });
    return sessions.map((s: { id: string }) => s.id);
  }
}
