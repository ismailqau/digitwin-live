import { z } from 'zod';

// User schemas
export const userProfileSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(255),
  personalityTraits: z.array(z.string()).optional(),
  speakingStyle: z.string().optional(),
});

// Conversation schemas
export const audioChunkSchema = z.object({
  type: z.literal('audio_chunk'),
  sessionId: z.string(),
  sequenceNumber: z.number().int().positive(),
  audioData: z.string(),
  timestamp: z.number(),
});

export const interruptionSchema = z.object({
  type: z.literal('interruption'),
  sessionId: z.string(),
  timestamp: z.number(),
});

// Document schemas
export const documentUploadSchema = z.object({
  filename: z.string().min(1).max(255),
  contentType: z.string(),
  sizeBytes: z
    .number()
    .int()
    .positive()
    .max(50 * 1024 * 1024), // 50MB
});

export const documentUpdateSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  tags: z.array(z.string()).optional(),
  sourceUrl: z.string().url().optional().or(z.literal('')),
});

export const documentSearchSchema = z.object({
  q: z.string().optional(),
  status: z.enum(['pending', 'processing', 'completed', 'failed']).optional(),
  fileType: z.string().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  sortBy: z.enum(['uploadedAt', 'processedAt', 'filename', 'sizeBytes', 'relevance']).optional(),
  order: z.enum(['asc', 'desc']).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const faqCreateSchema = z.object({
  question: z.string().min(1).max(500),
  answer: z.string().min(1).max(2000),
  priority: z.number().int().min(0).max(100).default(50),
  tags: z.array(z.string()).optional(),
});

export const faqUpdateSchema = z.object({
  question: z.string().min(1).max(500).optional(),
  answer: z.string().min(1).max(2000).optional(),
  priority: z.number().int().min(0).max(100).optional(),
  tags: z.array(z.string()).optional(),
});

// Voice model schemas
export const voiceConfigSchema = z.object({
  provider: z.enum(['xtts-v2', 'google-cloud-tts', 'openai-tts']),
  voiceModelId: z.string(),
  sampleRate: z.number().int().positive(),
  speed: z.number().min(0.5).max(2.0).default(1.0),
  pitch: z.number().min(-20).max(20).default(0),
});

// Face model schemas
export const faceModelUploadSchema = z.object({
  mediaType: z.enum(['images', 'video']),
  fileCount: z.number().int().min(3).max(10).optional(),
  duration: z.number().positive().optional(),
});

// Settings schemas
export const userSettingsSchema = z.object({
  enableConversationHistory: z.boolean().default(true),
  autoLanguageDetection: z.boolean().default(true),
  videoQuality: z.enum(['low', 'medium', 'high', 'auto']).default('auto'),
  interruptionSensitivity: z.number().min(0).max(1).default(0.5),
});

// Export types
export type UserProfileInput = z.infer<typeof userProfileSchema>;
export type AudioChunkInput = z.infer<typeof audioChunkSchema>;
export type DocumentUploadInput = z.infer<typeof documentUploadSchema>;
export type DocumentUpdateInput = z.infer<typeof documentUpdateSchema>;
export type DocumentSearchInput = z.infer<typeof documentSearchSchema>;
export type FAQCreateInput = z.infer<typeof faqCreateSchema>;
export type FAQUpdateInput = z.infer<typeof faqUpdateSchema>;
export type VoiceConfigInput = z.infer<typeof voiceConfigSchema>;
export type FaceModelUploadInput = z.infer<typeof faceModelUploadSchema>;
export type UserSettingsInput = z.infer<typeof userSettingsSchema>;
