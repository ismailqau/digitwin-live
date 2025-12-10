/**
 * VoiceRecordingScreen
 *
 * Enhanced screen wrapper for voice sample recording with navigation integration.
 * Implements Task 13.3.1 and 13.3.2:
 * - Guided recording prompts with sentences to read aloud
 * - Real-time waveform visualization using expo-audio analysis
 * - Recording timer with target duration (5 minutes minimum)
 * - Recording progress bar (current/target duration)
 * - Pause/resume functionality
 * - Volume level indicator (too quiet/good/too loud)
 * - Audio quality feedback in real-time (SNR, clarity)
 * - Large, accessible record button with animation
 * - Recording tips and best practices
 */

import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useEffect } from 'react';
import { View, StyleSheet, SafeAreaView, StatusBar, Alert, BackHandler } from 'react-native';

import { VoiceSampleRecording } from '../../components/VoiceSampleRecording';
import type { VoiceSample, VoiceSampleRequirements } from '../../services/VoiceSampleManager';

type NavigationProp = NativeStackNavigationProp<Record<string, object | undefined>>;
type RouteParams = RouteProp<
  { params?: { requirements?: Partial<VoiceSampleRequirements> } },
  'params'
>;

export const VoiceRecordingScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteParams>();

  const requirements = route.params?.requirements;

  // Handle hardware back button on Android
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      handleCancel();
      return true; // Prevent default behavior
    });

    return () => backHandler.remove();
  }, []);

  // Set status bar style for better visibility
  useEffect(() => {
    StatusBar.setBarStyle('dark-content', true);
    StatusBar.setBackgroundColor('#f5f5f5', true);
  }, []);

  const handleComplete = (samples: VoiceSample[]) => {
    if (samples.length === 0) {
      Alert.alert('No Samples', 'Please record at least one voice sample before proceeding.');
      return;
    }

    // Navigate to review screen with samples
    navigation.navigate('VoiceSampleReview', { samples });
  };

  const handleCancel = () => {
    Alert.alert(
      'Cancel Recording',
      'Are you sure you want to cancel? Any recorded samples will be lost.',
      [
        { text: 'Continue Recording', style: 'cancel' },
        {
          text: 'Cancel',
          style: 'destructive',
          onPress: () => navigation.goBack(),
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f5f5f5" />
      <View style={styles.content}>
        <VoiceSampleRecording
          onComplete={handleComplete}
          onCancel={handleCancel}
          requirements={requirements}
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    flex: 1,
  },
});

export default VoiceRecordingScreen;
