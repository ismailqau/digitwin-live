/**
 * VoiceSampleRecording Component
 *
 * Provides UI for recording voice samples for voice model training.
 * Features:
 * - Guided recording prompts
 * - Real-time quality feedback
 * - Recording controls (start, stop, pause, replay)
 * - Progress tracking
 * - Sample validation and review
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  Animated,
} from 'react-native';

import {
  VoiceSampleManager,
  VoiceSample,
  VoiceSampleValidationResult,
  VoiceModelTrainingProgress,
  VoiceSampleRequirements,
} from '../services/VoiceSampleManager';

interface VoiceSampleRecordingProps {
  onComplete?: (samples: VoiceSample[]) => void;
  onCancel?: () => void;
  requirements?: Partial<VoiceSampleRequirements>;
}

interface RecordingState {
  isRecording: boolean;
  isPaused: boolean;
  currentDuration: number;
  currentSample: number;
  samples: VoiceSample[];
  validation: VoiceSampleValidationResult | null;
  trainingProgress: VoiceModelTrainingProgress | null;
}

const RECORDING_PROMPTS = [
  'Please read the following text clearly and naturally:\n\n"Hello, this is my voice sample for creating my digital clone. I\'m speaking clearly and at a normal pace to ensure the best quality recording."',

  'Now, please speak naturally about yourself for about 1-2 minutes. You can talk about:\n• Your hobbies and interests\n• Your work or studies\n• Your favorite places or experiences\n• Anything that comes to mind naturally',

  'Please read this passage with expression:\n\n"Technology has transformed the way we communicate and connect with each other. From simple phone calls to video conferences, we can now reach anyone, anywhere in the world, instantly."',

  'Tell a short story or describe a memorable experience. Speak with emotion and vary your tone naturally. This helps capture the full range of your voice.',

  'Finally, please count from 1 to 20, then recite the alphabet. This helps capture different sounds and phonemes in your voice.',
];

export const VoiceSampleRecording: React.FC<VoiceSampleRecordingProps> = ({
  onComplete,
  onCancel,
  requirements = {},
}) => {
  const [state, setState] = useState<RecordingState>({
    isRecording: false,
    isPaused: false,
    currentDuration: 0,
    currentSample: 0,
    samples: [],
    validation: null,
    trainingProgress: null,
  });

  const voiceSampleManager = useRef<VoiceSampleManager | null>(null);
  const animatedValue = useRef(new Animated.Value(0)).current;
  const durationTimer = useRef<NodeJS.Timeout | null>(null);

  // Initialize VoiceSampleManager
  useEffect(() => {
    voiceSampleManager.current = new VoiceSampleManager(
      {
        onSampleRecorded: handleSampleRecorded,
        onSampleValidated: handleSampleValidated,
        onTrainingProgress: handleTrainingProgress,
        onError: handleError,
      },
      requirements
    );

    return () => {
      voiceSampleManager.current?.cleanup();
      if (durationTimer.current) {
        clearInterval(durationTimer.current);
      }
    };
  }, []);

  // Start recording animation
  useEffect(() => {
    if (state.isRecording && !state.isPaused) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(animatedValue, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(animatedValue, {
            toValue: 0,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      animatedValue.setValue(0);
    }
  }, [state.isRecording, state.isPaused]);

  // Duration timer
  useEffect(() => {
    if (state.isRecording && !state.isPaused) {
      durationTimer.current = setInterval(() => {
        const duration = voiceSampleManager.current?.getCurrentRecordingDuration() || 0;
        setState((prev) => ({ ...prev, currentDuration: duration }));
      }, 100);
    } else {
      if (durationTimer.current) {
        clearInterval(durationTimer.current);
        durationTimer.current = null;
      }
    }

    return () => {
      if (durationTimer.current) {
        clearInterval(durationTimer.current);
      }
    };
  }, [state.isRecording, state.isPaused]);

  const handleSampleRecorded = (sample: VoiceSample) => {
    setState((prev) => ({
      ...prev,
      samples: [...prev.samples, sample],
      isRecording: false,
      currentDuration: 0,
    }));
  };

  const handleSampleValidated = (sample: VoiceSample, validation: VoiceSampleValidationResult) => {
    setState((prev) => ({ ...prev, validation }));

    if (!validation.canProceed) {
      Alert.alert(
        'Recording Quality Issues',
        `${validation.issues.join('\n')}\n\nWould you like to re-record this sample?`,
        [
          { text: 'Keep Sample', style: 'default' },
          { text: 'Re-record', onPress: () => deleteSample(sample.id) },
        ]
      );
    }
  };

  const handleTrainingProgress = (progress: VoiceModelTrainingProgress) => {
    setState((prev) => ({ ...prev, trainingProgress: progress }));
  };

  const handleError = (error: Error) => {
    Alert.alert('Error', error.message);
    setState((prev) => ({
      ...prev,
      isRecording: false,
      isPaused: false,
      currentDuration: 0,
    }));
  };

  const startRecording = async () => {
    try {
      await voiceSampleManager.current?.startRecording();
      setState((prev) => ({
        ...prev,
        isRecording: true,
        isPaused: false,
        validation: null,
      }));
    } catch (error) {
      handleError(error as Error);
    }
  };

  const stopRecording = async () => {
    try {
      await voiceSampleManager.current?.stopRecording();
      setState((prev) => ({
        ...prev,
        isRecording: false,
        currentDuration: 0,
      }));
    } catch (error) {
      handleError(error as Error);
    }
  };

  const pauseRecording = async () => {
    try {
      // Note: AudioManager doesn't support pause, so we'll stop and allow restart
      await voiceSampleManager.current?.cancelRecording();
      setState((prev) => ({
        ...prev,
        isRecording: false,
        isPaused: true,
        currentDuration: 0,
      }));
    } catch (error) {
      handleError(error as Error);
    }
  };

  const deleteSample = async (sampleId: string) => {
    try {
      await voiceSampleManager.current?.deleteSample(sampleId);
      setState((prev) => ({
        ...prev,
        samples: prev.samples.filter((s) => s.id !== sampleId),
        validation: null,
      }));
    } catch (error) {
      handleError(error as Error);
    }
  };

  const nextSample = () => {
    if (state.currentSample < RECORDING_PROMPTS.length - 1) {
      setState((prev) => ({ ...prev, currentSample: prev.currentSample + 1 }));
    }
  };

  const previousSample = () => {
    if (state.currentSample > 0) {
      setState((prev) => ({ ...prev, currentSample: prev.currentSample - 1 }));
    }
  };

  const uploadSamples = async () => {
    try {
      const validation = voiceSampleManager.current?.validateAllSamples();
      if (!validation?.canProceed) {
        Alert.alert(
          'Cannot Upload Samples',
          validation?.issues.join('\n') || 'Unknown validation error',
          [{ text: 'OK' }]
        );
        return;
      }

      await voiceSampleManager.current?.uploadSamples();
      onComplete?.(state.samples);
    } catch (error) {
      handleError(error as Error);
    }
  };

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

  const requirements_obj = voiceSampleManager.current?.getRequirements();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Voice Sample Recording</Text>
        <Text style={styles.subtitle}>
          Sample {state.currentSample + 1} of {RECORDING_PROMPTS.length}
        </Text>
      </View>

      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${((state.samples.length + (state.isRecording ? 0.5 : 0)) / RECORDING_PROMPTS.length) * 100}%`,
              },
            ]}
          />
        </View>
        <Text style={styles.progressText}>
          {state.samples.length} of {requirements_obj?.recommendedSampleCount || 5} samples
          completed
        </Text>
      </View>

      {/* Recording Prompt */}
      <View style={styles.promptContainer}>
        <Text style={styles.promptTitle}>Recording Prompt {state.currentSample + 1}:</Text>
        <Text style={styles.promptText}>{RECORDING_PROMPTS[state.currentSample]}</Text>
      </View>

      {/* Recording Controls */}
      <View style={styles.controlsContainer}>
        {/* Recording Button */}
        <TouchableOpacity
          style={[styles.recordButton, state.isRecording && styles.recordButtonActive]}
          onPress={state.isRecording ? stopRecording : startRecording}
          disabled={
            state.trainingProgress?.status === 'uploading' ||
            state.trainingProgress?.status === 'training'
          }
        >
          <Animated.View
            style={[
              styles.recordButtonInner,
              {
                opacity: animatedValue.interpolate({
                  inputRange: [0, 1],
                  outputRange: [1, 0.6],
                }),
              },
            ]}
          >
            <Text style={styles.recordButtonText}>{state.isRecording ? 'Stop' : 'Record'}</Text>
          </Animated.View>
        </TouchableOpacity>

        {/* Duration Display */}
        {state.isRecording && (
          <View style={styles.durationContainer}>
            <Text style={styles.durationText}>{formatDuration(state.currentDuration)}</Text>
            <Text style={styles.durationSubtext}>
              Min: {formatDuration(requirements_obj?.minDuration || 60)}
            </Text>
          </View>
        )}

        {/* Pause Button (when recording) */}
        {state.isRecording && (
          <TouchableOpacity style={styles.pauseButton} onPress={pauseRecording}>
            <Text style={styles.pauseButtonText}>Cancel</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Sample Navigation */}
      <View style={styles.navigationContainer}>
        <TouchableOpacity
          style={[styles.navButton, state.currentSample === 0 && styles.navButtonDisabled]}
          onPress={previousSample}
          disabled={state.currentSample === 0 || state.isRecording}
        >
          <Text style={styles.navButtonText}>Previous</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.navButton,
            state.currentSample === RECORDING_PROMPTS.length - 1 && styles.navButtonDisabled,
          ]}
          onPress={nextSample}
          disabled={state.currentSample === RECORDING_PROMPTS.length - 1 || state.isRecording}
        >
          <Text style={styles.navButtonText}>Next</Text>
        </TouchableOpacity>
      </View>

      {/* Recorded Samples */}
      {state.samples.length > 0 && (
        <View style={styles.samplesContainer}>
          <Text style={styles.samplesTitle}>Recorded Samples</Text>
          {state.samples.map((sample, index) => (
            <View key={sample.id} style={styles.sampleItem}>
              <View style={styles.sampleInfo}>
                <Text style={styles.sampleTitle}>Sample {index + 1}</Text>
                <Text style={styles.sampleDuration}>
                  Duration: {formatDuration(sample.duration)}
                </Text>
                <View style={styles.qualityContainer}>
                  <Text style={styles.qualityLabel}>Quality: </Text>
                  <Text
                    style={[styles.qualityScore, { color: getQualityColor(sample.qualityScore) }]}
                  >
                    {sample.qualityScore}/100
                  </Text>
                </View>
              </View>
              <TouchableOpacity style={styles.deleteButton} onPress={() => deleteSample(sample.id)}>
                <Text style={styles.deleteButtonText}>Delete</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {/* Validation Results */}
      {state.validation && (
        <View style={styles.validationContainer}>
          <Text style={styles.validationTitle}>Sample Validation</Text>
          {state.validation.issues.length > 0 && (
            <View style={styles.issuesContainer}>
              <Text style={styles.issuesTitle}>Issues:</Text>
              {state.validation.issues.map((issue, index) => (
                <Text key={index} style={styles.issueText}>
                  • {issue}
                </Text>
              ))}
            </View>
          )}
          {state.validation.recommendations.length > 0 && (
            <View style={styles.recommendationsContainer}>
              <Text style={styles.recommendationsTitle}>Recommendations:</Text>
              {state.validation.recommendations.map((rec, index) => (
                <Text key={index} style={styles.recommendationText}>
                  • {rec}
                </Text>
              ))}
            </View>
          )}
        </View>
      )}

      {/* Training Progress */}
      {state.trainingProgress && (
        <View style={styles.trainingContainer}>
          <Text style={styles.trainingTitle}>Voice Model Training</Text>
          <View style={styles.trainingProgressBar}>
            <View
              style={[
                styles.trainingProgressFill,
                { width: `${state.trainingProgress.progress}%` },
              ]}
            />
          </View>
          <Text style={styles.trainingStatus}>{state.trainingProgress.currentStep}</Text>
          {state.trainingProgress.estimatedTimeRemaining && (
            <Text style={styles.trainingTime}>
              Estimated time remaining:{' '}
              {formatDuration(state.trainingProgress.estimatedTimeRemaining)}
            </Text>
          )}
          {state.trainingProgress.error && (
            <Text style={styles.trainingError}>Error: {state.trainingProgress.error}</Text>
          )}
        </View>
      )}

      {/* Action Buttons */}
      <View style={styles.actionContainer}>
        {state.samples.length >= (requirements_obj?.requiredSampleCount || 3) && (
          <TouchableOpacity
            style={[
              styles.uploadButton,
              (state.trainingProgress?.status === 'uploading' ||
                state.trainingProgress?.status === 'training') &&
                styles.uploadButtonDisabled,
            ]}
            onPress={uploadSamples}
            disabled={
              state.trainingProgress?.status === 'uploading' ||
              state.trainingProgress?.status === 'training'
            }
          >
            <Text style={styles.uploadButtonText}>
              {state.trainingProgress?.status === 'uploading' ||
              state.trainingProgress?.status === 'training'
                ? 'Processing...'
                : 'Create Voice Model'}
            </Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
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
  },
  progressContainer: {
    marginBottom: 20,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#2196F3',
  },
  progressText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 5,
  },
  promptContainer: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  promptTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  promptText: {
    fontSize: 14,
    color: '#555',
    lineHeight: 20,
  },
  controlsContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  recordButton: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#F44336',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  recordButtonActive: {
    backgroundColor: '#D32F2F',
  },
  recordButtonInner: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  durationContainer: {
    alignItems: 'center',
    marginTop: 15,
  },
  durationText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  durationSubtext: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  pauseButton: {
    marginTop: 10,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#FF9800',
    borderRadius: 20,
  },
  pauseButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  navigationContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  navButton: {
    flex: 1,
    marginHorizontal: 10,
    paddingVertical: 12,
    backgroundColor: '#2196F3',
    borderRadius: 6,
    alignItems: 'center',
  },
  navButtonDisabled: {
    backgroundColor: '#ccc',
  },
  navButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  samplesContainer: {
    marginBottom: 20,
  },
  samplesTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  sampleItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sampleInfo: {
    flex: 1,
  },
  sampleTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  sampleDuration: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  qualityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  qualityLabel: {
    fontSize: 14,
    color: '#666',
  },
  qualityScore: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  deleteButton: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    backgroundColor: '#F44336',
    borderRadius: 4,
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  validationContainer: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  validationTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  issuesContainer: {
    marginBottom: 10,
  },
  issuesTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#F44336',
    marginBottom: 5,
  },
  issueText: {
    fontSize: 14,
    color: '#F44336',
    marginLeft: 10,
  },
  recommendationsContainer: {
    marginBottom: 10,
  },
  recommendationsTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FF9800',
    marginBottom: 5,
  },
  recommendationText: {
    fontSize: 14,
    color: '#FF9800',
    marginLeft: 10,
  },
  trainingContainer: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  trainingTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  trainingProgressBar: {
    height: 8,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 10,
  },
  trainingProgressFill: {
    height: '100%',
    backgroundColor: '#4CAF50',
  },
  trainingStatus: {
    fontSize: 14,
    color: '#333',
    marginBottom: 5,
  },
  trainingTime: {
    fontSize: 12,
    color: '#666',
  },
  trainingError: {
    fontSize: 14,
    color: '#F44336',
    marginTop: 5,
  },
  actionContainer: {
    marginTop: 20,
  },
  uploadButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  uploadButtonDisabled: {
    backgroundColor: '#ccc',
  },
  uploadButtonText: {
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

export default VoiceSampleRecording;
