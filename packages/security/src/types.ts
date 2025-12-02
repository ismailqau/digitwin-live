/**
 * Security types for audit logging and access control
 */

export interface AuditLogEntry {
  userId: string;
  action: string;
  resource: string;
  result: 'success' | 'failure';
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
}

export interface DataRetentionPolicy {
  conversationHistoryDays: number;
  auditLogDays: number;
  cacheTTL: {
    short: number; // seconds
    medium: number;
    long: number;
  };
}

export interface ResourceOwnership {
  userId: string;
  resourceId: string;
  resourceType: string;
}

export enum AuditAction {
  // Authentication
  USER_LOGIN = 'user.login',
  USER_LOGOUT = 'user.logout',
  USER_REGISTER = 'user.register',
  AUTH_FAILED = 'auth.failed',

  // Documents
  DOCUMENT_UPLOAD = 'document.upload',
  DOCUMENT_DELETE = 'document.delete',
  DOCUMENT_UPDATE = 'document.update',
  DOCUMENT_VIEW = 'document.view',

  // Voice Models
  VOICE_MODEL_CREATE = 'voice_model.create',
  VOICE_MODEL_DELETE = 'voice_model.delete',
  VOICE_MODEL_ACTIVATE = 'voice_model.activate',
  VOICE_SAMPLE_UPLOAD = 'voice_sample.upload',

  // Face Models
  FACE_MODEL_CREATE = 'face_model.create',
  FACE_MODEL_DELETE = 'face_model.delete',
  FACE_MODEL_ACTIVATE = 'face_model.activate',

  // Rate Limiting
  RATE_LIMIT_EXCEEDED = 'rate_limit.exceeded',

  // Content Policy
  CONTENT_POLICY_VIOLATION = 'content_policy.violation',

  // Conversations
  CONVERSATION_START = 'conversation.start',
  CONVERSATION_END = 'conversation.end',

  // Data Access
  UNAUTHORIZED_ACCESS = 'access.unauthorized',
  CROSS_USER_ACCESS_ATTEMPT = 'access.cross_user_attempt',
}

export enum ResourceType {
  USER = 'user',
  DOCUMENT = 'document',
  VOICE_MODEL = 'voice_model',
  VOICE_SAMPLE = 'voice_sample',
  FACE_MODEL = 'face_model',
  CONVERSATION = 'conversation',
  FAQ = 'faq',
}
