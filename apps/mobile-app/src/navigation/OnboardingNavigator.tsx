/**
 * Onboarding Navigator
 *
 * Stack navigator for onboarding flow:
 * Welcome → Permissions → PersonalitySetup → VoiceSetup → FaceSetup → Complete
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React, { useEffect } from 'react';
import { Alert, BackHandler } from 'react-native';

import {
  FaceCaptureScreen,
  FaceVideoRecordScreen,
  FaceReviewScreen,
  FaceUploadScreen,
  FaceProcessingStatusScreen,
  FacePreviewScreen,
} from '../screens/face';
import FaceSetupPromptScreen from '../screens/onboarding/FaceSetupPromptScreen';
import OnboardingCompleteScreen from '../screens/onboarding/OnboardingCompleteScreen';
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

export default function OnboardingNavigator() {
  useEffect(() => {
    // Handle back button press with confirmation
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      Alert.alert(
        'Exit Onboarding?',
        'Are you sure you want to exit the setup process? You can complete it later from settings.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Exit',
            style: 'destructive',
            onPress: async () => {
              // Save current progress before exiting
              await AsyncStorage.setItem('onboarding_interrupted', 'true');
              BackHandler.exitApp();
            },
          },
        ]
      );
      return true; // Prevent default back behavior
    });

    return () => backHandler.remove();
  }, []);

  return (
    <Stack.Navigator
      initialRouteName="Welcome"
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#f5f5f5' },
        animation: 'slide_from_right', // Animated transitions
        animationDuration: 300,
      }}
    >
      <Stack.Screen
        name="Welcome"
        component={WelcomeScreen}
        options={{
          animation: 'fade',
          gestureEnabled: false, // Prevent swipe back on first screen
        }}
      />

      <Stack.Screen
        name="PersonalitySetup"
        component={PersonalitySetupScreen}
        options={{
          animation: 'slide_from_right',
        }}
      />
      <Stack.Screen
        name="VoiceSetupPrompt"
        component={VoiceSetupPromptScreen}
        options={{
          animation: 'slide_from_right',
        }}
      />
      <Stack.Screen
        name="VoiceRecording"
        component={VoiceRecordingScreen}
        options={{
          animation: 'slide_from_bottom',
        }}
      />
      <Stack.Screen
        name="VoiceSampleReview"
        component={VoiceSampleReviewScreen}
        options={{
          animation: 'slide_from_right',
        }}
      />
      <Stack.Screen
        name="VoiceUpload"
        component={VoiceUploadScreen}
        options={{
          animation: 'slide_from_right',
        }}
      />
      <Stack.Screen
        name="VoiceTrainingStatus"
        component={VoiceTrainingStatusScreen}
        options={{
          animation: 'slide_from_right',
        }}
      />
      <Stack.Screen
        name="VoicePreview"
        component={VoicePreviewScreen}
        options={{
          animation: 'slide_from_right',
        }}
      />
      <Stack.Screen
        name="FaceSetupPrompt"
        component={FaceSetupPromptScreen}
        options={{
          animation: 'slide_from_right',
        }}
      />
      <Stack.Screen
        name="FaceCapture"
        component={FaceCaptureScreen}
        options={{
          animation: 'slide_from_bottom',
        }}
      />
      <Stack.Screen
        name="FaceVideoRecord"
        component={FaceVideoRecordScreen}
        options={{
          animation: 'slide_from_right',
        }}
      />
      <Stack.Screen
        name="FaceReview"
        component={FaceReviewScreen}
        options={{
          animation: 'slide_from_right',
        }}
      />
      <Stack.Screen
        name="FaceUpload"
        component={FaceUploadScreen}
        options={{
          animation: 'slide_from_right',
        }}
      />
      <Stack.Screen
        name="FaceProcessingStatus"
        component={FaceProcessingStatusScreen}
        options={{
          animation: 'slide_from_right',
        }}
      />
      <Stack.Screen
        name="FacePreview"
        component={FacePreviewScreen}
        options={{
          animation: 'slide_from_right',
        }}
      />
      <Stack.Screen
        name="OnboardingComplete"
        component={OnboardingCompleteScreen}
        options={{
          animation: 'fade',
          gestureEnabled: false, // Prevent swipe back on final screen
        }}
      />
    </Stack.Navigator>
  );
}
