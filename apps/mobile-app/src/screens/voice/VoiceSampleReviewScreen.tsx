/**
 * VoiceSampleReviewScreen
 *
 * Screen for reviewing recorded voice samples before upload.
 * Implements Task 13.3.3:
 * - Display list of recorded samples with duration
 * - Playback controls for each sample
 * - Quality score display
 * - Delete individual samples
 * - "Record More" option
 * - Total duration and quality summary
 * - "Continue to Upload" button
 */

import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  SafeAreaView,
} from 'react-native';

import type { VoiceSample } from '../../services/VoiceSampleManager';

type NavigationProp = NativeStackNavigationProp<Record<string, object | undefined>>;
type RouteParams = RouteProp<{ params: { samples: VoiceSample[] } }, 'params'>;

export const VoiceSampleReviewScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteParams>();

  const [samples, setSamples] = useState<VoiceSample[]>(route.params?.samples || []);
  const [playingSampleId, setPlayingSampleId] = useState<string | null>(null);

  const totalDuration = samples.reduce((sum, sample) => sum + sample.duration, 0);
  const avgQuality =
    samples.length > 0
      ? samples.reduce((sum, sample) => sum + sample.qualityScore, 0) / samples.length
      : 0;
  const minSamplesRequired = 1; // Reduced for development (production: 3)
  const minQualityRequired = 50; // Reduced for development (production: 70)
  const canProceed = samples.length >= minSamplesRequired && avgQuality >= minQualityRequired;

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getQualityColor = (score: number): string => {
    if (score >= 80) return '#4CAF50'; // Green
    if (score >= 60) return '#FF9800'; // Orange
    return '#F44336'; // Red
  };

  const handlePlaySample = async (sample: VoiceSample) => {
    try {
      if (playingSampleId === sample.id) {
        // Stop playback
        setPlayingSampleId(null);
        // In real implementation: await audioPlayer.stop();
        console.log('Stopping playback for sample:', sample.id);
      } else {
        // Start playback
        setPlayingSampleId(sample.id);
        console.log('Starting playback for sample:', sample.id, 'duration:', sample.duration);

        // In real implementation: await audioPlayer.play(sample.filePath);
        // For now, simulate playback with more realistic timing
        const playbackDuration = Math.max(1000, sample.duration * 1000); // At least 1 second

        setTimeout(() => {
          setPlayingSampleId(null);
          console.log('Playback completed for sample:', sample.id);
        }, playbackDuration);
      }
    } catch (error) {
      console.error('Playback error:', error);
      Alert.alert('Playback Error', 'Failed to play audio sample. Please try again.');
      setPlayingSampleId(null);
    }
  };

  const handleDeleteSample = (sampleId: string) => {
    Alert.alert('Delete Sample', 'Are you sure you want to delete this voice sample?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          setSamples((prev) => prev.filter((s) => s.id !== sampleId));
          if (playingSampleId === sampleId) {
            setPlayingSampleId(null);
          }
        },
      },
    ]);
  };

  const handleRecordMore = () => {
    navigation.navigate('VoiceRecording');
  };

  const handleContinueToUpload = () => {
    if (!canProceed) {
      Alert.alert(
        'Cannot Continue',
        `You need at least ${minSamplesRequired} sample(s) with an average quality of ${minQualityRequired} or higher.`,
        [{ text: 'OK' }]
      );
      return;
    }

    navigation.navigate('VoiceUpload', { samples });
  };

  const handleCancel = () => {
    Alert.alert(
      'Cancel Voice Model Creation',
      'Are you sure you want to cancel? All recorded samples will be lost.',
      [
        { text: 'Keep Recording', style: 'cancel' },
        {
          text: 'Cancel',
          style: 'destructive',
          onPress: () => navigation.navigate('Main'),
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.contentContainer}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Review Voice Samples</Text>
          <Text style={styles.subtitle}>
            Review your recordings before creating the voice model
          </Text>
        </View>

        {/* Summary Card */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Samples</Text>
              <Text style={styles.summaryValue}>
                {samples.length} / {minSamplesRequired}
              </Text>
              <Text style={styles.summarySubtext}>
                {samples.length >= minSamplesRequired ? '✓ Complete' : 'Need more'}
              </Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Total Duration</Text>
              <Text style={styles.summaryValue}>{formatDuration(totalDuration)}</Text>
              <Text style={styles.summarySubtext}>
                {totalDuration >= 300 ? '✓ Good length' : 'Could be longer'}
              </Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Avg Quality</Text>
              <Text style={[styles.summaryValue, { color: getQualityColor(avgQuality) }]}>
                {Math.round(avgQuality)}/100
              </Text>
              <Text style={[styles.summarySubtext, { color: getQualityColor(avgQuality) }]}>
                {avgQuality >= 80 ? 'Excellent' : avgQuality >= 60 ? 'Good' : 'Needs work'}
              </Text>
            </View>
          </View>

          {!canProceed && (
            <View style={styles.warningContainer}>
              <Text style={styles.warningIcon}>⚠️</Text>
              <Text style={styles.warningText}>
                {samples.length < minSamplesRequired
                  ? `Record at least ${minSamplesRequired - samples.length} more sample(s) to continue`
                  : 'Average quality is below recommended threshold. Consider re-recording some samples for better results.'}
              </Text>
            </View>
          )}

          {canProceed && (
            <View style={styles.successContainer}>
              <Text style={styles.successIcon}>✅</Text>
              <Text style={styles.successText}>
                Ready to upload! Your voice samples meet the quality requirements.
              </Text>
            </View>
          )}
        </View>

        {/* Samples List */}
        <View style={styles.samplesContainer}>
          <Text style={styles.samplesTitle}>Recorded Samples</Text>

          {samples.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No samples recorded yet</Text>
              <TouchableOpacity style={styles.recordButton} onPress={handleRecordMore}>
                <Text style={styles.recordButtonText}>Start Recording</Text>
              </TouchableOpacity>
            </View>
          ) : (
            samples.map((sample, index) => (
              <View key={sample.id} style={styles.sampleCard}>
                <View style={styles.sampleHeader}>
                  <View style={styles.sampleInfo}>
                    <Text style={styles.sampleTitle}>Sample {index + 1}</Text>
                    <Text style={styles.sampleDuration}>{formatDuration(sample.duration)}</Text>
                  </View>
                  <View style={styles.qualityBadge}>
                    <Text
                      style={[styles.qualityScore, { color: getQualityColor(sample.qualityScore) }]}
                    >
                      {sample.qualityScore}/100
                    </Text>
                  </View>
                </View>

                {/* Quality Indicators */}
                <View style={styles.indicatorsContainer}>
                  {sample.hasClipping && (
                    <View style={[styles.indicator, styles.indicatorWarning]}>
                      <Text style={styles.indicatorText}>⚠️ Clipping</Text>
                    </View>
                  )}
                  {sample.hasBackgroundNoise && (
                    <View style={[styles.indicator, styles.indicatorWarning]}>
                      <Text style={styles.indicatorText}>🔊 Background Noise</Text>
                    </View>
                  )}
                  {sample.snr >= 20 && !sample.hasClipping && (
                    <View style={[styles.indicator, styles.indicatorSuccess]}>
                      <Text style={styles.indicatorText}>✓ Good Quality</Text>
                    </View>
                  )}
                </View>

                {/* Action Buttons */}
                <View style={styles.sampleActions}>
                  <TouchableOpacity
                    style={[
                      styles.playButton,
                      playingSampleId === sample.id && styles.playButtonActive,
                    ]}
                    onPress={() => handlePlaySample(sample)}
                  >
                    <Text style={styles.playButtonText}>
                      {playingSampleId === sample.id ? '⏸ Pause' : '▶ Play'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => handleDeleteSample(sample.id)}
                  >
                    <Text style={styles.deleteButtonText}>🗑 Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>

        {/* Action Buttons */}
        <View style={styles.actionContainer}>
          <TouchableOpacity style={styles.recordMoreButton} onPress={handleRecordMore}>
            <Text style={styles.recordMoreButtonText}>
              {samples.length === 0 ? 'Start Recording' : '+ Record More'}
            </Text>
          </TouchableOpacity>

          {samples.length > 0 && (
            <TouchableOpacity
              style={[styles.continueButton, !canProceed && styles.continueButtonDisabled]}
              onPress={handleContinueToUpload}
              disabled={!canProceed}
            >
              <Text style={styles.continueButtonText}>Continue to Upload</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  summaryCard: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 5,
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  summarySubtext: {
    fontSize: 11,
    color: '#666',
    marginTop: 2,
    textAlign: 'center',
  },
  warningContainer: {
    marginTop: 15,
    padding: 12,
    backgroundColor: '#FFF3CD',
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  warningIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  warningText: {
    fontSize: 14,
    color: '#856404',
    flex: 1,
  },
  successContainer: {
    marginTop: 15,
    padding: 12,
    backgroundColor: '#D4EDDA',
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  successIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  successText: {
    fontSize: 14,
    color: '#155724',
    flex: 1,
  },
  samplesContainer: {
    marginBottom: 20,
  },
  samplesTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
    backgroundColor: '#fff',
    borderRadius: 12,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
  },
  recordButton: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 8,
  },
  recordButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  sampleCard: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sampleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sampleInfo: {
    flex: 1,
  },
  sampleTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 2,
  },
  sampleDuration: {
    fontSize: 14,
    color: '#666',
  },
  qualityBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#f5f5f5',
    borderRadius: 16,
  },
  qualityScore: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  indicatorsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 10,
  },
  indicator: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
    marginBottom: 4,
  },
  indicatorWarning: {
    backgroundColor: '#FFF3CD',
  },
  indicatorSuccess: {
    backgroundColor: '#D4EDDA',
  },
  indicatorText: {
    fontSize: 12,
    color: '#333',
  },
  sampleActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  playButton: {
    flex: 1,
    backgroundColor: '#2196F3',
    paddingVertical: 10,
    borderRadius: 8,
    marginRight: 8,
    alignItems: 'center',
  },
  playButtonActive: {
    backgroundColor: '#FF9800',
  },
  playButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  deleteButton: {
    flex: 1,
    backgroundColor: '#F44336',
    paddingVertical: 10,
    borderRadius: 8,
    marginLeft: 8,
    alignItems: 'center',
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  actionContainer: {
    marginTop: 20,
  },
  recordMoreButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  recordMoreButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  continueButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  continueButtonDisabled: {
    backgroundColor: '#ccc',
  },
  continueButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  cancelButton: {
    backgroundColor: '#666',
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default VoiceSampleReviewScreen;
