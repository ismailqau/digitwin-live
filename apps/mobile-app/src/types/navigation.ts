/**
 * Navigation Types
 *
 * Type definitions for React Navigation routes and params
 */

import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps, NavigatorScreenParams } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { VoiceSample } from '../services/VoiceSampleManager';

// Auth Navigator Stack
export type AuthStackParamList = {
  Splash: undefined;
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
  EmailVerification: { email: string };
};

// Onboarding Navigator Stack
export type OnboardingStackParamList = {
  Welcome: undefined;
  Permissions: undefined;
  PersonalitySetup: undefined;
  VoiceSetupPrompt: undefined;
  VoiceRecording: undefined;
  VoiceSampleReview: { samples: VoiceSample[] };
  VoiceUpload: { samples: VoiceSample[] };
  VoiceTrainingStatus: { modelId: string };
  VoicePreview: { modelId: string };
  FaceSetupPrompt: undefined;
  FaceCapture: undefined;
  FaceVideoRecord: undefined;
  FaceReview: undefined;
  FaceUpload: undefined;
  FaceProcessingStatus: { modelId: string };
  FacePreview: { modelId: string };
  OnboardingComplete: undefined;
};

// Face Model Stack (can be used standalone or in settings)
export type FaceStackParamList = {
  FaceCapture: undefined;
  FaceVideoRecord: undefined;
  FaceReview: undefined;
  FaceUpload: undefined;
  FaceProcessingStatus: { modelId: string };
  FacePreview: { modelId: string };
};

// Main Tab Navigator
export type MainTabParamList = {
  Conversation: undefined;
  History: undefined;
  Knowledge: undefined;
  Settings: undefined;
};

// Conversation Stack (nested in Main Tab)
export type ConversationStackParamList = {
  ConversationMain: undefined;
  ConversationDetail: { sessionId: string };
  VoiceOnlyConversation: undefined;
  TTSTest: undefined;
  VoiceLibrary: undefined;
  TranslateSynthesize: undefined;
  CloneAudioToAudio: undefined;
};

// History Stack (nested in Main Tab)
export type HistoryStackParamList = {
  HistoryList: undefined;
  HistoryDetail: { sessionId: string };
};

// Knowledge Stack (nested in Main Tab)
export type KnowledgeStackParamList = {
  KnowledgeMain: undefined;
  DocumentList: undefined;
  DocumentDetail: { documentId: string };
  DocumentUpload: undefined;
  FAQList: undefined;
  FAQDetail: { faqId: string };
  FAQCreate: undefined;
};

// Settings Stack (nested in Main Tab)
export type SettingsStackParamList = {
  SettingsMain: undefined;
  Profile: undefined;
  VoiceModel: undefined;
  FaceModel: undefined;
  Preferences: undefined;
  About: undefined;
};

// Root Navigator
export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList>;
  Onboarding: NavigatorScreenParams<OnboardingStackParamList>;
  Main: NavigatorScreenParams<MainTabParamList>;
};

// Screen Props Types
export type AuthScreenProps<T extends keyof AuthStackParamList> = NativeStackScreenProps<
  AuthStackParamList,
  T
>;

export type OnboardingScreenProps<T extends keyof OnboardingStackParamList> =
  NativeStackScreenProps<OnboardingStackParamList, T>;

export type FaceScreenProps<T extends keyof FaceStackParamList> = NativeStackScreenProps<
  FaceStackParamList,
  T
>;

export type MainTabScreenProps<T extends keyof MainTabParamList> = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, T>,
  NativeStackScreenProps<RootStackParamList>
>;

export type RootScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<
  RootStackParamList,
  T
>;

// Declare global navigation types for useNavigation hook

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface RootParamList extends RootStackParamList {}
  }
}
