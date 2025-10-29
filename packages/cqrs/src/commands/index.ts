import { Command } from '../types';

/**
 * Create User Command
 */
export interface CreateUserCommand extends Command {
  commandType: 'user.create';
  payload: {
    email: string;
    name: string;
    password: string;
    subscriptionTier: 'free' | 'pro' | 'enterprise';
  };
}

/**
 * Update User Command
 */
export interface UpdateUserCommand extends Command {
  commandType: 'user.update';
  payload: {
    userId: string;
    name?: string;
    personalityTraits?: string[];
    speakingStyle?: string;
  };
}

/**
 * Create Voice Model Command
 */
export interface CreateVoiceModelCommand extends Command {
  commandType: 'voice_model.create';
  payload: {
    userId: string;
    provider: 'xtts-v2' | 'google-cloud-tts' | 'openai-tts';
    audioSamples: string[]; // Storage paths
  };
}

/**
 * Create Face Model Command
 */
export interface CreateFaceModelCommand extends Command {
  commandType: 'face_model.create';
  payload: {
    userId: string;
    mediaType: 'images' | 'video';
    mediaPaths: string[]; // Storage paths
  };
}

/**
 * Upload Document Command
 */
export interface UploadDocumentCommand extends Command {
  commandType: 'document.upload';
  payload: {
    userId: string;
    filename: string;
    contentType: string;
    storagePath: string;
    sizeBytes: number;
  };
}

/**
 * Delete Document Command
 */
export interface DeleteDocumentCommand extends Command {
  commandType: 'document.delete';
  payload: {
    userId: string;
    documentId: string;
  };
}

/**
 * Start Conversation Command
 */
export interface StartConversationCommand extends Command {
  commandType: 'conversation.start';
  payload: {
    userId: string;
    voiceModelId: string;
    faceModelId?: string;
    llmProvider: string;
    ttsProvider: string;
  };
}

/**
 * End Conversation Command
 */
export interface EndConversationCommand extends Command {
  commandType: 'conversation.end';
  payload: {
    userId: string;
    sessionId: string;
  };
}

/**
 * Record Conversation Turn Command
 */
export interface RecordConversationTurnCommand extends Command {
  commandType: 'conversation.record_turn';
  payload: {
    sessionId: string;
    userId: string;
    userTranscript: string;
    systemResponse: string;
    latencyMs: number;
    cost: number;
    retrievedChunks: string[];
  };
}

/**
 * Union type of all commands
 */
export type AllCommands =
  | CreateUserCommand
  | UpdateUserCommand
  | CreateVoiceModelCommand
  | CreateFaceModelCommand
  | UploadDocumentCommand
  | DeleteDocumentCommand
  | StartConversationCommand
  | EndConversationCommand
  | RecordConversationTurnCommand;

export type CommandType = AllCommands['commandType'];
