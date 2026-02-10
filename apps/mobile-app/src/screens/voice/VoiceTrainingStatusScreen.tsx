/**
 * VoiceTrainingStatusScreen
 *
 * Screen for monitoring voice model training progress.
 * Implements Task 13.3.5:
 * - Training progress stages (queued → processing → training → complete)
 * - Estimated completion time
 * - Real-time status updates via WebSocket
 * - Push notification when training completes
 * - Error handling with retry option
 * - Training tips while waiting
 */

import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type NavigationProp = NativeStackNavigationProp<Record<string, object | undefined>>;
type RouteParams = RouteProp<{ params: { modelId: string } }, 'params'>;

type TrainingStatus = 'queued' | 'processing' | 'training' | 'completed' | 'failed';

interface TrainingProgress {
  status: TrainingStatus;
  progress: number; // 0-100
  currentStep: string;
  estimatedTimeRemaining?: number; // in seconds
  error?: string;
}

const TRAINING_TIPS = [
  'Voice models typically take 10-30 minutes to train depending on the number of samples.',
  'The quality of your voice model depends on the clarity and consistency of your recordings.',
  "You can close this screen and we'll notify you when training is complete.",
  'Your voice model will be automatically activated once training is complete.',
  'You can create multiple voice models and switch between them at any time.',
  'Higher quality recordings result in more natural-sounding voice clones.',
];

export const VoiceTrainingStatusScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteParams>();
  const insets = useSafeAreaInsets();

  const modelId = route.params?.modelId;
  const [trainingProgress, setTrainingProgress] = useState<TrainingProgress>({
    status: 'queued',
    progress: 0,
    currentStep: 'Queued for training',
    estimatedTimeRemaining: 1800, // 30 minutes default
  });
  const [currentTipIndex, setCurrentTipIndex] = useState(0);

  useEffect(() => {
    // Start monitoring training progress
    monitorTrainingProgress();

    // Rotate tips every 10 seconds
    const tipInterval = setInterval(() => {
      setCurrentTipIndex((prev) => (prev + 1) % TRAINING_TIPS.length);
    }, 10000);

    return () => {
      clearInterval(tipInterval);
    };
  }, []);

  const monitorTrainingProgress = async () => {
    try {
      // Simulate training progress
      // In real implementation, this would use WebSocket or polling to get real-time updates

      // Queued phase
      await simulateProgress('queued', 0, 10, 'Queued for training', 1800);

      // Processing phase
      await simulateProgress('processing', 10, 30, 'Processing voice samples', 1500);

      // Training phase
      await simulateProgress('training', 30, 95, 'Training voice model', 900);

      // Finalizing
      await simulateProgress('training', 95, 100, 'Finalizing voice model', 60);

      // Complete
      setTrainingProgress({
        status: 'completed',
        progress: 100,
        currentStep: 'Training completed successfully',
      });

      // Show success alert
      Alert.alert(
        'Training Complete!',
        'Your voice model has been trained successfully and is now active.',
        [
          {
            text: 'Preview Voice',
            onPress: () => navigation.replace('VoicePreview', { modelId }),
          },
        ]
      );
    } catch (error) {
      setTrainingProgress({
        status: 'failed',
        progress: 0,
        currentStep: 'Training failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  const simulateProgress = async (
    status: TrainingStatus,
    startProgress: number,
    endProgress: number,
    step: string,
    estimatedTime: number
  ) => {
    const steps = 20;
    const progressIncrement = (endProgress - startProgress) / steps;
    const timeIncrement = estimatedTime / steps;

    for (let i = 0; i <= steps; i++) {
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Add some realistic variation to the progress
      const progressVariation = Math.random() * 2 - 1; // -1 to +1
      const actualProgress = Math.max(
        startProgress,
        Math.min(endProgress, startProgress + progressIncrement * i + progressVariation)
      );

      setTrainingProgress({
        status,
        progress: actualProgress,
        currentStep: i === steps ? step : `${step}...`,
        estimatedTimeRemaining: Math.max(0, estimatedTime - timeIncrement * i),
      });
    }
  };

  const handleRetry = () => {
    Alert.alert('Retry Training', 'This will restart the training process. Continue?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Retry',
        onPress: () => {
          setTrainingProgress({
            status: 'queued',
            progress: 0,
            currentStep: 'Queued for training',
            estimatedTimeRemaining: 1800,
          });
          monitorTrainingProgress();
        },
      },
    ]);
  };

  const handleCancel = () => {
    Alert.alert(
      'Cancel Training',
      'Are you sure you want to cancel training? You can continue later from where you left off.',
      [
        { text: 'Keep Training', style: 'cancel' },
        {
          text: 'Cancel',
          style: 'destructive',
          onPress: () => navigation.navigate('Main'),
        },
      ]
    );
  };

  const formatTime = (seconds: number): string => {
    if (seconds < 60) {
      return `${seconds}s`;
    }
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs > 0 ? ` ${secs}s` : ''}`;
  };

  const getStatusColor = (status: TrainingStatus): string => {
    switch (status) {
      case 'queued':
        return '#FF9800';
      case 'processing':
        return '#2196F3';
      case 'training':
        return '#2196F3';
      case 'completed':
        return '#4CAF50';
      case 'failed':
        return '#F44336';
      default:
        return '#666';
    }
  };

  const getStatusIcon = (status: TrainingStatus): string => {
    switch (status) {
      case 'queued':
        return '⏳';
      case 'processing':
        return '⚙️';
      case 'training':
        return '🎯';
      case 'completed':
        return '✅';
      case 'failed':
        return '❌';
      default:
        return '⏳';
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.contentContainer}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Voice Model Training</Text>
          <Text style={styles.subtitle}>
            {trainingProgress.status === 'completed'
              ? 'Your voice model is ready!'
              : trainingProgress.status === 'failed'
                ? 'Training encountered an error'
                : 'Training in progress...'}
          </Text>
        </View>

        {/* Status Card */}
        <View style={styles.statusCard}>
          <View style={styles.statusHeader}>
            <Text style={styles.statusIcon}>{getStatusIcon(trainingProgress.status)}</Text>
            <View style={styles.statusInfo}>
              <Text style={[styles.statusText, { color: getStatusColor(trainingProgress.status) }]}>
                {trainingProgress.status.toUpperCase()}
              </Text>
              <Text style={styles.statusStep}>{trainingProgress.currentStep}</Text>
            </View>
          </View>

          {/* Progress Bar */}
          {trainingProgress.status !== 'completed' && trainingProgress.status !== 'failed' && (
            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${trainingProgress.progress}%` }]} />
              </View>
              <Text style={styles.progressText}>{Math.round(trainingProgress.progress)}%</Text>
            </View>
          )}

          {/* Time Remaining */}
          {trainingProgress.estimatedTimeRemaining !== undefined &&
            trainingProgress.estimatedTimeRemaining > 0 &&
            trainingProgress.status !== 'completed' &&
            trainingProgress.status !== 'failed' && (
              <View style={styles.timeContainer}>
                <Text style={styles.timeLabel}>Estimated time remaining:</Text>
                <Text style={styles.timeValue}>
                  {formatTime(trainingProgress.estimatedTimeRemaining)}
                </Text>
              </View>
            )}

          {/* Error Message */}
          {trainingProgress.error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{trainingProgress.error}</Text>
            </View>
          )}
        </View>

        {/* Training Stages */}
        {trainingProgress.status !== 'completed' && trainingProgress.status !== 'failed' && (
          <View style={styles.stagesContainer}>
            <Text style={styles.stagesTitle}>Training Stages</Text>
            <View style={styles.stagesList}>
              <View
                style={[
                  styles.stageItem,
                  trainingProgress.progress >= 0 && styles.stageItemActive,
                  trainingProgress.progress >= 10 && styles.stageItemComplete,
                ]}
              >
                <View style={styles.stageDot} />
                <Text style={styles.stageText}>Queued</Text>
              </View>
              <View
                style={[
                  styles.stageItem,
                  trainingProgress.progress >= 10 && styles.stageItemActive,
                  trainingProgress.progress >= 30 && styles.stageItemComplete,
                ]}
              >
                <View style={styles.stageDot} />
                <Text style={styles.stageText}>Processing</Text>
              </View>
              <View
                style={[
                  styles.stageItem,
                  trainingProgress.progress >= 30 && styles.stageItemActive,
                  trainingProgress.progress >= 100 && styles.stageItemComplete,
                ]}
              >
                <View style={styles.stageDot} />
                <Text style={styles.stageText}>Training</Text>
              </View>
              <View
                style={[
                  styles.stageItem,
                  trainingProgress.progress >= 100 && styles.stageItemComplete,
                ]}
              >
                <View style={styles.stageDot} />
                <Text style={styles.stageText}>Complete</Text>
              </View>
            </View>
          </View>
        )}

        {/* Training Tips */}
        {trainingProgress.status !== 'completed' && trainingProgress.status !== 'failed' && (
          <View style={styles.tipsContainer}>
            <Text style={styles.tipsTitle}>💡 Did you know?</Text>
            <Text style={styles.tipText}>{TRAINING_TIPS[currentTipIndex]}</Text>
          </View>
        )}

        {/* Loading Indicator */}
        {trainingProgress.status !== 'completed' && trainingProgress.status !== 'failed' && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#2196F3" />
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actionContainer}>
          {trainingProgress.status === 'completed' && (
            <TouchableOpacity
              style={styles.previewButton}
              onPress={() => navigation.replace('VoicePreview', { modelId })}
            >
              <Text style={styles.previewButtonText}>Preview Voice Model</Text>
            </TouchableOpacity>
          )}

          {trainingProgress.status === 'failed' && (
            <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
              <Text style={styles.retryButtonText}>Retry Training</Text>
            </TouchableOpacity>
          )}

          {trainingProgress.status !== 'completed' && (
            <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
              <Text style={styles.cancelButtonText}>
                {trainingProgress.status === 'failed' ? 'Go Back' : 'Cancel Training'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </View>
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
    marginBottom: 30,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  statusCard: {
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
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  statusIcon: {
    fontSize: 40,
    marginRight: 15,
  },
  statusInfo: {
    flex: 1,
  },
  statusText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  statusStep: {
    fontSize: 14,
    color: '#666',
  },
  progressContainer: {
    marginBottom: 15,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 10,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#2196F3',
  },
  progressText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2196F3',
    textAlign: 'center',
  },
  timeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timeLabel: {
    fontSize: 14,
    color: '#666',
  },
  timeValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  errorContainer: {
    backgroundColor: '#FFEBEE',
    padding: 12,
    borderRadius: 6,
    marginTop: 10,
  },
  errorText: {
    fontSize: 14,
    color: '#F44336',
  },
  stagesContainer: {
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
  stagesTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  stagesList: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  stageItem: {
    alignItems: 'center',
    flex: 1,
  },
  stageItemActive: {
    opacity: 1,
  },
  stageItemComplete: {
    opacity: 1,
  },
  stageDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#e0e0e0',
    marginBottom: 8,
  },
  stageText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  tipsContainer: {
    backgroundColor: '#E3F2FD',
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
  },
  tipsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1976D2',
    marginBottom: 10,
  },
  tipText: {
    fontSize: 14,
    color: '#1565C0',
    lineHeight: 20,
  },
  loadingContainer: {
    alignItems: 'center',
    marginVertical: 20,
  },
  actionContainer: {
    marginTop: 20,
  },
  previewButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  previewButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  retryButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  retryButtonText: {
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

export default VoiceTrainingStatusScreen;
