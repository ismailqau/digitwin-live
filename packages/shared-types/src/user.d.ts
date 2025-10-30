export type SubscriptionTier = 'free' | 'pro' | 'enterprise';
export interface UserProfile {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  personalityTraits: string[];
  speakingStyle: string;
  voiceModels: VoiceModelReference[];
  activeVoiceModelId: string;
  faceModels: FaceModelReference[];
  activeFaceModelId: string;
  preferredLLMProvider: string;
  preferredTTSProvider: string;
  conversationMinutesUsed: number;
  subscriptionTier: SubscriptionTier;
  settings: UserSettings;
}
export interface UserSettings {
  enableConversationHistory: boolean;
  autoLanguageDetection: boolean;
  videoQuality: 'low' | 'medium' | 'high' | 'auto';
  interruptionSensitivity: number;
}
export interface VoiceModelReference {
  id: string;
  provider: string;
  modelPath: string;
  qualityScore: number;
  createdAt: Date;
}
export interface FaceModelReference {
  id: string;
  modelPath: string;
  qualityScore: number;
  createdAt: Date;
}
//# sourceMappingURL=user.d.ts.map
