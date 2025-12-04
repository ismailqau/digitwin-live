/**
 * Onboarding Navigator
 *
 * Stack navigator for onboarding flow:
 * Welcome → Permissions → PersonalitySetup → VoiceSetup → FaceSetup → Complete
 */

import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

import { useAuthStore } from '../store/authStore';
import type { OnboardingStackParamList } from '../types/navigation';

const Stack = createNativeStackNavigator<OnboardingStackParamList>();

// Placeholder screens - will be replaced with actual implementations
const WelcomeScreen = () => {
  const { setOnboarded } = useAuthStore();

  const handleSkipOnboarding = () => {
    // Mark as onboarded to access main app
    setOnboarded(true);
  };

  return (
    <View style={styles.placeholder}>
      <Text style={styles.title}>Welcome</Text>
      <Text style={styles.subtitle}>Create your digital twin</Text>
      <TouchableOpacity style={styles.button} onPress={handleSkipOnboarding}>
        <Text style={styles.buttonText}>Skip Onboarding (Demo)</Text>
      </TouchableOpacity>
    </View>
  );
};

const PermissionsScreen = () => (
  <View style={styles.placeholder}>
    <Text style={styles.title}>Permissions</Text>
    <Text style={styles.subtitle}>Grant access to microphone and camera</Text>
  </View>
);

const PersonalitySetupScreen = () => (
  <View style={styles.placeholder}>
    <Text style={styles.title}>Personality Setup</Text>
    <Text style={styles.subtitle}>Define your clone's personality</Text>
  </View>
);

const VoiceSetupPromptScreen = () => (
  <View style={styles.placeholder}>
    <Text style={styles.title}>Voice Setup</Text>
    <Text style={styles.subtitle}>Record your voice for cloning</Text>
  </View>
);

const VoiceRecordingScreen = () => (
  <View style={styles.placeholder}>
    <Text style={styles.title}>Voice Recording</Text>
    <Text style={styles.subtitle}>Record voice samples</Text>
  </View>
);

const FaceSetupPromptScreen = () => (
  <View style={styles.placeholder}>
    <Text style={styles.title}>Face Setup</Text>
    <Text style={styles.subtitle}>Capture your face for video</Text>
  </View>
);

const FaceCaptureScreen = () => (
  <View style={styles.placeholder}>
    <Text style={styles.title}>Face Capture</Text>
    <Text style={styles.subtitle}>Take photos or video</Text>
  </View>
);

const OnboardingCompleteScreen = () => (
  <View style={styles.placeholder}>
    <Text style={styles.title}>All Set!</Text>
    <Text style={styles.subtitle}>Your digital twin is ready</Text>
  </View>
);

export default function OnboardingNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="Welcome"
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: { backgroundColor: '#f5f5f5' },
      }}
    >
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="Permissions" component={PermissionsScreen} />
      <Stack.Screen name="PersonalitySetup" component={PersonalitySetupScreen} />
      <Stack.Screen name="VoiceSetupPrompt" component={VoiceSetupPromptScreen} />
      <Stack.Screen name="VoiceRecording" component={VoiceRecordingScreen} />
      <Stack.Screen name="FaceSetupPrompt" component={FaceSetupPromptScreen} />
      <Stack.Screen name="FaceCapture" component={FaceCaptureScreen} />
      <Stack.Screen name="OnboardingComplete" component={OnboardingCompleteScreen} />
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    paddingHorizontal: 32,
    marginBottom: 24,
  },
  button: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
