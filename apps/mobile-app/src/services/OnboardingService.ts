/**
 * Onboarding Service
 *
 * Manages onboarding progress and state persistence
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

export interface OnboardingProgress {
  currentStep: number;
  completedSteps: string[];
  personalityConfigured: boolean;
  voiceSetupStarted: boolean;
  voiceSetupCompleted: boolean;
  faceSetupStarted: boolean;
  faceSetupCompleted: boolean;
  onboardingComplete: boolean;
  lastUpdated: string;
}

const STORAGE_KEYS = {
  PROGRESS: 'onboarding_progress',
  COMPLETE: 'onboarding_complete',
  PERSONALITY: 'onboarding_personality',
  INTERRUPTED: 'onboarding_interrupted',
};

export class OnboardingService {
  /**
   * Get current onboarding progress
   */
  static async getProgress(): Promise<OnboardingProgress | null> {
    try {
      const progressData = await AsyncStorage.getItem(STORAGE_KEYS.PROGRESS);
      if (!progressData) return null;
      return JSON.parse(progressData);
    } catch (error) {
      console.error('Error getting onboarding progress:', error);
      return null;
    }
  }

  /**
   * Save onboarding progress
   */
  static async saveProgress(progress: Partial<OnboardingProgress>): Promise<void> {
    try {
      const currentProgress = await this.getProgress();
      const updatedProgress: OnboardingProgress = {
        ...currentProgress,
        ...progress,
        lastUpdated: new Date().toISOString(),
      } as OnboardingProgress;

      await AsyncStorage.setItem(STORAGE_KEYS.PROGRESS, JSON.stringify(updatedProgress));
    } catch (error) {
      console.error('Error saving onboarding progress:', error);
      throw error;
    }
  }

  /**
   * Mark onboarding as complete
   */
  static async markComplete(): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.COMPLETE, 'true');
      await this.saveProgress({
        onboardingComplete: true,
        currentStep: 6,
      });
    } catch (error) {
      console.error('Error marking onboarding complete:', error);
      throw error;
    }
  }

  /**
   * Check if onboarding is complete
   */
  static async isComplete(): Promise<boolean> {
    try {
      const complete = await AsyncStorage.getItem(STORAGE_KEYS.COMPLETE);
      return complete === 'true';
    } catch (error) {
      console.error('Error checking onboarding status:', error);
      return false;
    }
  }

  /**
   * Reset onboarding progress (for testing or re-onboarding)
   */
  static async reset(): Promise<void> {
    try {
      await AsyncStorage.multiRemove([
        STORAGE_KEYS.PROGRESS,
        STORAGE_KEYS.COMPLETE,
        STORAGE_KEYS.PERSONALITY,
        STORAGE_KEYS.INTERRUPTED,
      ]);
    } catch (error) {
      console.error('Error resetting onboarding:', error);
      throw error;
    }
  }

  /**
   * Save personality data
   */
  static async savePersonality(data: {
    personalityTraits: string[];
    speakingStyle: string;
    customDescription: string;
  }): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.PERSONALITY, JSON.stringify(data));
      await this.saveProgress({
        personalityConfigured: true,
        completedSteps: ['welcome', 'permissions', 'personality'],
        currentStep: 3,
      });
    } catch (error) {
      console.error('Error saving personality:', error);
      throw error;
    }
  }

  /**
   * Get saved personality data
   */
  static async getPersonality(): Promise<{
    personalityTraits: string[];
    speakingStyle: string;
    customDescription: string;
  } | null> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.PERSONALITY);
      if (!data) return null;
      return JSON.parse(data);
    } catch (error) {
      console.error('Error getting personality:', error);
      return null;
    }
  }

  /**
   * Mark voice setup as started
   */
  static async markVoiceSetupStarted(): Promise<void> {
    try {
      await this.saveProgress({
        voiceSetupStarted: true,
        currentStep: 4,
      });
    } catch (error) {
      console.error('Error marking voice setup started:', error);
    }
  }

  /**
   * Mark voice setup as completed
   */
  static async markVoiceSetupCompleted(): Promise<void> {
    try {
      await this.saveProgress({
        voiceSetupCompleted: true,
        completedSteps: ['welcome', 'permissions', 'personality', 'voice'],
        currentStep: 4,
      });
    } catch (error) {
      console.error('Error marking voice setup completed:', error);
    }
  }

  /**
   * Mark face setup as started
   */
  static async markFaceSetupStarted(): Promise<void> {
    try {
      await this.saveProgress({
        faceSetupStarted: true,
        currentStep: 5,
      });
    } catch (error) {
      console.error('Error marking face setup started:', error);
    }
  }

  /**
   * Mark face setup as completed
   */
  static async markFaceSetupCompleted(): Promise<void> {
    try {
      await this.saveProgress({
        faceSetupCompleted: true,
        completedSteps: ['welcome', 'permissions', 'personality', 'voice', 'face'],
        currentStep: 5,
      });
    } catch (error) {
      console.error('Error marking face setup completed:', error);
    }
  }
}
