/**
 * Onboarding Navigator
 *
 * Stack navigator for onboarding flow:
 * Welcome → Permissions → PersonalitySetup → VoiceSetup → FaceSetup → Complete
 */

import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';

import FaceSetupPromptScreen from '../screens/onboarding/FaceSetupPromptScreen';
import OnboardingCompleteScreen from '../screens/onboarding/OnboardingCompleteScreen';
import PermissionsScreen from '../screens/onboarding/PermissionsScreen';
import PersonalitySetupScreen from '../screens/onboarding/PersonalitySetupScreen';
import VoiceSetupPromptScreen from '../screens/onboarding/VoiceSetupPromptScreen';
import WelcomeScreen from '../screens/onboarding/WelcomeScreen';
import {
  VoiceRecordingScreen,
  VoiceSampleReviewScreen,
  VoiceUploadScreen,
  VoiceTrainingStatusScreen,
  VoicePreviewScreen,
} from '../screens/voice';
import type { OnboardingStackParamList } from '../types/navigation';

// Voice model creation screens (Task 13.3)

const Stack = createNativeStackNavigator<OnboardingStackParamList>();

// Placeholder screen for face capture (to be implemented in Phase 13.4)
const FaceCaptureScreen = () => {
  return null; // Placeholder - will be implemented in Phase 13.4
};

export default function OnboardingNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="Welcome"
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#f5f5f5' },
      }}
    >
      <Stack.Screen
        name="Welcome"
        component={WelcomeScreen}
        options={{
          animation: 'none',
        }}
      />
      <Stack.Screen name="Permissions" component={PermissionsScreen} />
      <Stack.Screen name="PersonalitySetup" component={PersonalitySetupScreen} />
      <Stack.Screen name="VoiceSetupPrompt" component={VoiceSetupPromptScreen} />
      <Stack.Screen name="VoiceRecording" component={VoiceRecordingScreen} />
      <Stack.Screen name="VoiceSampleReview" component={VoiceSampleReviewScreen} />
      <Stack.Screen name="VoiceUpload" component={VoiceUploadScreen} />
      <Stack.Screen name="VoiceTrainingStatus" component={VoiceTrainingStatusScreen} />
      <Stack.Screen name="VoicePreview" component={VoicePreviewScreen} />
      <Stack.Screen name="FaceSetupPrompt" component={FaceSetupPromptScreen} />
      <Stack.Screen name="FaceCapture" component={FaceCaptureScreen} />
      <Stack.Screen name="OnboardingComplete" component={OnboardingCompleteScreen} />
    </Stack.Navigator>
  );
}
