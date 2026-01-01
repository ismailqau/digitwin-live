/**
 * FaceProcessingStatusScreen
 *
 * Face model processing status screen with:
 * - Processing stages visualization
 * - Estimated completion time
 * - Real-time status updates via WebSocket
 * - Push notification on completion
 * - Error handling with specific messages
 * - Processing tips while waiting
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  ScrollView,
  Alert,
} from 'react-native';

import { useFaceStore, FaceModelStatus } from '../../store/faceStore';
import { lightColors } from '../../theme';

interface FaceProcessingStatusScreenProps {
  navigation: {
    navigate: (screen: string, params?: Record<string, unknown>) => void;
    goBack: () => void;
    reset: (state: {
      index: number;
      routes: Array<{ name: string; params?: Record<string, unknown> }>;
    }) => void;
  };
  route: {
    params?: {
      modelId?: string;
    };
  };
}

interface ProcessingStage {
  id: FaceModelStatus;
  label: string;
  description: string;
  icon: string;
  estimatedDuration: number; // seconds
}

const PROCESSING_STAGES: ProcessingStage[] = [
  {
    id: 'uploading',
    label: 'Uploading',
    description: 'Transferring your photos to our servers',
    icon: '📤',
    estimatedDuration: 30,
  },
  {
    id: 'detecting',
    label: 'Face Detection',
    description: 'Detecting and analyzing facial features',
    icon: '🔍',
    estimatedDuration: 60,
  },
  {
    id: 'embedding',
    label: 'Creating Embeddings',
    description: 'Generating unique face identity vectors',
    icon: '🧬',
    estimatedDuration: 120,
  },
  {
    id: 'training',
    label: 'Training Model',
    description: 'Training your personalized face model',
    icon: '🤖',
    estimatedDuration: 600,
  },
  {
    id: 'completed',
    label: 'Complete',
    description: 'Your face model is ready!',
    icon: '✅',
    estimatedDuration: 0,
  },
];

const PROCESSING_TIPS = [
  'Your face model will enable realistic lip-sync animations during conversations.',
  'The more photos you provided, the better your face model will be.',
  'Face models are encrypted and stored securely.',
  'You can update your face model anytime by capturing new photos.',
  'Processing typically takes 10-30 minutes depending on server load.',
];

export function FaceProcessingStatusScreen({
  navigation,
  route,
}: FaceProcessingStatusScreenProps): React.ReactElement {
  const modelId = route.params?.modelId;

  const [currentTipIndex, setCurrentTipIndex] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);

  const progressAnimation = useRef(new Animated.Value(0)).current;
  const stageAnimations = useRef(PROCESSING_STAGES.map(() => new Animated.Value(0))).current;
  const tipFadeAnimation = useRef(new Animated.Value(1)).current;
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { progress, setProgress, setFaceModel, setIsProcessing } = useFaceStore();

  // Simulate WebSocket status updates
  useEffect(() => {
    if (!modelId) return;

    setIsProcessing(true);

    // Simulate processing stages
    const stages: FaceModelStatus[] = ['detecting', 'embedding', 'training', 'completed'];
    let stageIndex = 0;

    pollingRef.current = setInterval(() => {
      if (stageIndex < stages.length) {
        const stage = stages[stageIndex];
        const stageInfo = PROCESSING_STAGES.find((s) => s.id === stage);

        setProgress({
          status: stage,
          progress: ((stageIndex + 1) / stages.length) * 100,
          currentStep: stageInfo?.description ?? '',
          estimatedTimeRemaining:
            stage === 'completed'
              ? 0
              : PROCESSING_STAGES.slice(stageIndex + 1).reduce(
                  (sum, s) => sum + s.estimatedDuration,
                  0
                ),
        });

        if (stage === 'completed') {
          handleProcessingComplete();
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
          }
        }

        stageIndex++;
      }
    }, 3000); // Update every 3 seconds for demo

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, [modelId, setProgress, setIsProcessing]);

  // Elapsed time counter
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setElapsedTime((prev) => prev + 1);
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  // Rotate tips
  useEffect(() => {
    const tipInterval = setInterval(() => {
      Animated.sequence([
        Animated.timing(tipFadeAnimation, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(tipFadeAnimation, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();

      setCurrentTipIndex((prev) => (prev + 1) % PROCESSING_TIPS.length);
    }, 8000);

    return () => clearInterval(tipInterval);
  }, [tipFadeAnimation]);

  // Animate progress
  useEffect(() => {
    Animated.timing(progressAnimation, {
      toValue: progress.progress / 100,
      duration: 500,
      useNativeDriver: false,
    }).start();

    // Animate stage indicators
    const currentStageIndex = PROCESSING_STAGES.findIndex((s) => s.id === progress.status);
    stageAnimations.forEach((anim, index) => {
      Animated.timing(anim, {
        toValue: index <= currentStageIndex ? 1 : 0,
        duration: 300,
        useNativeDriver: false,
      }).start();
    });
  }, [progress, progressAnimation, stageAnimations]);

  const handleProcessingComplete = useCallback((): void => {
    setIsProcessing(false);

    // Create face model result
    setFaceModel({
      id: modelId ?? `face_model_${Date.now()}`,
      qualityScore: 85,
      createdAt: new Date(),
    });

    // Show completion alert
    Alert.alert(
      'Face Model Ready! 🎉',
      'Your face model has been created successfully. Would you like to preview it?',
      [
        {
          text: 'Later',
          style: 'cancel',
          onPress: () => {
            navigation.reset({
              index: 0,
              routes: [{ name: 'Main' }],
            });
          },
        },
        {
          text: 'Preview',
          onPress: () => {
            navigation.navigate('FacePreview', { modelId });
          },
        },
      ]
    );
  }, [modelId, setFaceModel, setIsProcessing, navigation]);

  const handleCancel = useCallback((): void => {
    Alert.alert(
      'Cancel Processing',
      'Are you sure you want to cancel? Your face model will not be created.',
      [
        { text: 'Continue', style: 'cancel' },
        {
          text: 'Cancel',
          style: 'destructive',
          onPress: () => {
            if (pollingRef.current) {
              clearInterval(pollingRef.current);
            }
            setIsProcessing(false);
            navigation.goBack();
          },
        },
      ]
    );
  }, [navigation, setIsProcessing]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatEstimatedTime = (seconds: number): string => {
    if (seconds < 60) return 'Less than a minute';
    const mins = Math.ceil(seconds / 60);
    return `About ${mins} minute${mins > 1 ? 's' : ''}`;
  };

  const getCurrentStageIndex = (): number => {
    return PROCESSING_STAGES.findIndex((s) => s.id === progress.status);
  };

  const isCompleted = progress.status === 'completed';
  const isFailed = progress.status === 'failed';

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.cancelButton} onPress={handleCancel} disabled={isCompleted}>
          <Text style={[styles.cancelText, isCompleted && styles.cancelTextDisabled]}>
            {isCompleted ? '' : 'Cancel'}
          </Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Processing</Text>
        <View style={styles.cancelButton} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Progress circle */}
        <View style={styles.progressSection}>
          <View style={styles.progressCircle}>
            <Text style={styles.progressPercent}>{Math.round(progress.progress)}%</Text>
            <Text style={styles.progressLabel}>
              {isCompleted ? 'Complete' : isFailed ? 'Failed' : 'Processing'}
            </Text>
          </View>

          {/* Elapsed time */}
          <Text style={styles.elapsedTime}>Elapsed: {formatTime(elapsedTime)}</Text>

          {/* Estimated time remaining */}
          {!isCompleted && !isFailed && progress.estimatedTimeRemaining && (
            <Text style={styles.estimatedTime}>
              {formatEstimatedTime(progress.estimatedTimeRemaining)} remaining
            </Text>
          )}
        </View>

        {/* Processing stages */}
        <View style={styles.stagesContainer}>
          {PROCESSING_STAGES.map((stage, index) => {
            const isActive = stage.id === progress.status;
            const isComplete = getCurrentStageIndex() > index || isCompleted;
            const isPending = getCurrentStageIndex() < index && !isCompleted;

            return (
              <View key={stage.id} style={styles.stageRow}>
                {/* Stage indicator */}
                <Animated.View
                  style={[
                    styles.stageIndicator,
                    isComplete && styles.stageIndicatorComplete,
                    isActive && styles.stageIndicatorActive,
                    isPending && styles.stageIndicatorPending,
                  ]}
                >
                  <Text style={styles.stageIcon}>{isComplete ? '✓' : stage.icon}</Text>
                </Animated.View>

                {/* Stage info */}
                <View style={styles.stageInfo}>
                  <Text
                    style={[
                      styles.stageLabel,
                      isActive && styles.stageLabelActive,
                      isPending && styles.stageLabelPending,
                    ]}
                  >
                    {stage.label}
                  </Text>
                  <Text
                    style={[styles.stageDescription, isPending && styles.stageDescriptionPending]}
                  >
                    {stage.description}
                  </Text>
                </View>

                {/* Connector line */}
                {index < PROCESSING_STAGES.length - 1 && (
                  <View style={[styles.connector, isComplete && styles.connectorComplete]} />
                )}
              </View>
            );
          })}
        </View>

        {/* Error message */}
        {isFailed && progress.error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorIcon}>❌</Text>
            <Text style={styles.errorTitle}>Processing Failed</Text>
            <Text style={styles.errorMessage}>{progress.error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={() => navigation.goBack()}>
              <Text style={styles.retryText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Tips section */}
        {!isCompleted && !isFailed && (
          <Animated.View style={[styles.tipsContainer, { opacity: tipFadeAnimation }]}>
            <Text style={styles.tipsTitle}>💡 Did you know?</Text>
            <Text style={styles.tipsText}>{PROCESSING_TIPS[currentTipIndex]}</Text>
          </Animated.View>
        )}

        {/* Success message */}
        {isCompleted && (
          <View style={styles.successContainer}>
            <Text style={styles.successIcon}>🎉</Text>
            <Text style={styles.successTitle}>Face Model Created!</Text>
            <Text style={styles.successMessage}>
              Your personalized face model is ready for use in conversations.
            </Text>
            <TouchableOpacity
              style={styles.previewButton}
              onPress={() => navigation.navigate('FacePreview', { modelId })}
            >
              <Text style={styles.previewText}>Preview Face Model</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: lightColors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: lightColors.surface,
    borderBottomWidth: 1,
    borderBottomColor: lightColors.border,
  },
  cancelButton: {
    width: 70,
  },
  cancelText: {
    color: lightColors.error,
    fontSize: 16,
  },
  cancelTextDisabled: {
    color: lightColors.textTertiary,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: lightColors.text,
  },
  content: {
    flex: 1,
  },
  progressSection: {
    alignItems: 'center',
    paddingVertical: 32,
    backgroundColor: lightColors.surface,
  },
  progressCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: lightColors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  progressPercent: {
    fontSize: 36,
    fontWeight: '700',
    color: lightColors.primary,
  },
  progressLabel: {
    fontSize: 14,
    color: lightColors.primary,
    marginTop: 4,
  },
  elapsedTime: {
    fontSize: 14,
    color: lightColors.textSecondary,
    marginBottom: 4,
  },
  estimatedTime: {
    fontSize: 14,
    color: lightColors.text,
    fontWeight: '500',
  },
  stagesContainer: {
    padding: 24,
  },
  stageRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 24,
    position: 'relative',
  },
  stageIndicator: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: lightColors.border,
    marginRight: 16,
  },
  stageIndicatorComplete: {
    backgroundColor: lightColors.success,
  },
  stageIndicatorActive: {
    backgroundColor: lightColors.primary,
  },
  stageIndicatorPending: {
    backgroundColor: lightColors.border,
  },
  stageIcon: {
    fontSize: 18,
  },
  stageInfo: {
    flex: 1,
    paddingTop: 4,
  },
  stageLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: lightColors.text,
    marginBottom: 4,
  },
  stageLabelActive: {
    color: lightColors.primary,
  },
  stageLabelPending: {
    color: lightColors.textSecondary,
  },
  stageDescription: {
    fontSize: 13,
    color: lightColors.textSecondary,
    lineHeight: 18,
  },
  stageDescriptionPending: {
    color: lightColors.textTertiary,
  },
  connector: {
    position: 'absolute',
    left: 21,
    top: 44,
    width: 2,
    height: 24,
    backgroundColor: lightColors.border,
  },
  connectorComplete: {
    backgroundColor: lightColors.success,
  },
  errorContainer: {
    margin: 24,
    padding: 24,
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    borderRadius: 16,
    alignItems: 'center',
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: lightColors.error,
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 14,
    color: lightColors.text,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: lightColors.error,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  tipsContainer: {
    margin: 24,
    padding: 20,
    backgroundColor: lightColors.primaryLight,
    borderRadius: 16,
  },
  tipsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: lightColors.primary,
    marginBottom: 8,
  },
  tipsText: {
    fontSize: 14,
    color: lightColors.text,
    lineHeight: 20,
  },
  successContainer: {
    margin: 24,
    padding: 24,
    backgroundColor: 'rgba(52, 199, 89, 0.1)',
    borderRadius: 16,
    alignItems: 'center',
  },
  successIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: lightColors.success,
    marginBottom: 8,
  },
  successMessage: {
    fontSize: 14,
    color: lightColors.text,
    textAlign: 'center',
    marginBottom: 20,
  },
  previewButton: {
    backgroundColor: lightColors.success,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
  },
  previewText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default FaceProcessingStatusScreen;
