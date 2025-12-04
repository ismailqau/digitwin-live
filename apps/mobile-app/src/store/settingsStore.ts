/**
 * Settings Store
 *
 * Zustand store for user settings and preferences
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type VideoQuality = 'low' | 'medium' | 'high' | 'auto';
export type LLMProvider = 'gemini-flash' | 'gemini-pro' | 'gpt4-turbo' | 'gpt4' | 'groq-llama';
export type TTSProvider = 'xtts-v2' | 'google-cloud-tts' | 'openai-tts';

export interface SettingsState {
  // Voice settings
  voiceModelId: string | null;
  ttsProvider: TTSProvider;
  voiceSpeed: number;
  voicePitch: number;

  // Face settings
  faceModelId: string | null;
  videoQuality: VideoQuality;

  // AI settings
  llmProvider: LLMProvider;
  enableConversationHistory: boolean;
  autoLanguageDetection: boolean;

  // Conversation settings
  interruptionSensitivity: number;
  maxResponseLength: number;

  // Notification settings
  enablePushNotifications: boolean;
  enableSoundEffects: boolean;
  enableHapticFeedback: boolean;

  // Privacy settings
  saveConversationHistory: boolean;
  shareAnalytics: boolean;

  // Actions
  setVoiceModelId: (id: string | null) => void;
  setTTSProvider: (provider: TTSProvider) => void;
  setVoiceSpeed: (speed: number) => void;
  setVoicePitch: (pitch: number) => void;
  setFaceModelId: (id: string | null) => void;
  setVideoQuality: (quality: VideoQuality) => void;
  setLLMProvider: (provider: LLMProvider) => void;
  setEnableConversationHistory: (enabled: boolean) => void;
  setAutoLanguageDetection: (enabled: boolean) => void;
  setInterruptionSensitivity: (sensitivity: number) => void;
  setMaxResponseLength: (length: number) => void;
  setEnablePushNotifications: (enabled: boolean) => void;
  setEnableSoundEffects: (enabled: boolean) => void;
  setEnableHapticFeedback: (enabled: boolean) => void;
  setSaveConversationHistory: (enabled: boolean) => void;
  setShareAnalytics: (enabled: boolean) => void;
  resetToDefaults: () => void;
}

// In-memory storage for React Native (will be replaced with AsyncStorage in production)
const memoryStorage: Record<string, string> = {};

const asyncStorage = {
  getItem: async (name: string): Promise<string | null> => {
    return memoryStorage[name] ?? null;
  },
  setItem: async (name: string, value: string): Promise<void> => {
    memoryStorage[name] = value;
  },
  removeItem: async (name: string): Promise<void> => {
    delete memoryStorage[name];
  },
};

const defaultSettings = {
  voiceModelId: null,
  ttsProvider: 'xtts-v2' as TTSProvider,
  voiceSpeed: 1.0,
  voicePitch: 1.0,
  faceModelId: null,
  videoQuality: 'auto' as VideoQuality,
  llmProvider: 'gemini-flash' as LLMProvider,
  enableConversationHistory: true,
  autoLanguageDetection: true,
  interruptionSensitivity: 0.5,
  maxResponseLength: 150,
  enablePushNotifications: true,
  enableSoundEffects: true,
  enableHapticFeedback: true,
  saveConversationHistory: true,
  shareAnalytics: false,
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...defaultSettings,

      // Actions
      setVoiceModelId: (id) => set({ voiceModelId: id }),
      setTTSProvider: (provider) => set({ ttsProvider: provider }),
      setVoiceSpeed: (speed) => set({ voiceSpeed: speed }),
      setVoicePitch: (pitch) => set({ voicePitch: pitch }),
      setFaceModelId: (id) => set({ faceModelId: id }),
      setVideoQuality: (quality) => set({ videoQuality: quality }),
      setLLMProvider: (provider) => set({ llmProvider: provider }),
      setEnableConversationHistory: (enabled) => set({ enableConversationHistory: enabled }),
      setAutoLanguageDetection: (enabled) => set({ autoLanguageDetection: enabled }),
      setInterruptionSensitivity: (sensitivity) => set({ interruptionSensitivity: sensitivity }),
      setMaxResponseLength: (length) => set({ maxResponseLength: length }),
      setEnablePushNotifications: (enabled) => set({ enablePushNotifications: enabled }),
      setEnableSoundEffects: (enabled) => set({ enableSoundEffects: enabled }),
      setEnableHapticFeedback: (enabled) => set({ enableHapticFeedback: enabled }),
      setSaveConversationHistory: (enabled) => set({ saveConversationHistory: enabled }),
      setShareAnalytics: (enabled) => set({ shareAnalytics: enabled }),
      resetToDefaults: () => set(defaultSettings),
    }),
    {
      name: 'settings-storage',
      storage: createJSONStorage(() => asyncStorage),
    }
  )
);
