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
export type VoiceConfigInput = z.infer<typeof voiceConfigSchema>;
export type FaceModelUploadInput = z.infer<typeof faceModelUploadSchema>;
export type UserSettingsInput = z.infer<typeof userSettingsSchema>;
