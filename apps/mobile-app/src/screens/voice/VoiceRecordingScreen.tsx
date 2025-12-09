/**
 * VoiceRecordingScreen
 *
 * Screen wrapper for voice sample recording with navigation integration.
 * Implements Task 13.3.1 and 13.3.2:
 * - Guided recording prompts
 * - Real-time waveform visualization
 * - Recording timer and progress
 * - Pause/resume functionality
 * - Volume level indicator
 * - Audio quality feedback
 */

import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React from 'react';
import { View, StyleSheet, SafeAreaView } from 'react-native';

import { VoiceSampleRecording } from '../../components/VoiceSampleRecording';
import type { VoiceSample } from '../../services/VoiceSampleManager';

type NavigationProp = NativeStackNavigationProp<Record<string, object | undefined>>;

export const VoiceRecordingScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();

  const handleComplete = (samples: VoiceSample[]) => {
    // Navigate to review screen with samples
    navigation.navigate('VoiceSampleReview', { samples });
  };

  const handleCancel = () => {
    // Navigate back or to previous screen
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <VoiceSampleRecording onComplete={handleComplete} onCancel={handleCancel} />
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
