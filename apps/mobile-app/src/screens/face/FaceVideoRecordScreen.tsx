/**
 * FaceVideoRecordScreen
 *
 * Video recording mode for face model creation with:
 * - Video recording (30-60 seconds)
 * - Head turn guidance (left and right)
 * - Recording progress with timer
 * - Pause/resume functionality
 * - Face visibility validation
 */

// Safely import native modules
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let CameraView: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let useCameraPermissions: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let useMicrophonePermissions: any = null;

try {
  const Camera = require('expo-camera');
  CameraView = Camera.CameraView;
  useCameraPermissions = Camera.useCameraPermissions;
  useMicrophonePermissions = Camera.useMicrophonePermissions;
} catch (error) {
  console.warn('[FaceVideoRecordScreen] Failed to load native camera modules:', error);
}
import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system/legacy';
import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  Alert,
} from 'react-native';

import { FaceQualityValidator } from '../../services/FaceQualityValidator';
import { useFaceStore, FaceVideo } from '../../store/faceStore';
import { lightColors } from '../../theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const OVAL_WIDTH = SCREEN_WIDTH * 0.7;
const OVAL_HEIGHT = OVAL_WIDTH * 1.3;
const MIN_DURATION = 30;
const MAX_DURATION = 60;

interface FaceVideoRecordScreenProps {
  navigation: {
    navigate: (screen: string, params?: Record<string, unknown>) => void;
    goBack: () => void;
  };
}

type RecordingPhase = 'ready' | 'center' | 'left' | 'right' | 'center_final' | 'complete';

const PHASE_INSTRUCTIONS: Record<RecordingPhase, string> = {
  ready: 'Press record to start',
  center: 'Look at the camera',
  left: 'Slowly turn your head left',
  right: 'Slowly turn your head right',
  center_final: 'Return to center',
  complete: 'Recording complete!',
};

export function FaceVideoRecordScreen({
  navigation,
}: FaceVideoRecordScreenProps): React.ReactElement {
  const [cameraPermission, requestCameraPermission] = useCameraPermissions
    ? useCameraPermissions()
    : [{ granted: false, canAskAgain: false }, () => {}];
  const [microphonePermission, requestMicrophonePermission] = useMicrophonePermissions
    ? useMicrophonePermissions()
    : [{ granted: false, canAskAgain: false }, () => {}];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [facing] = useState<any>('front');
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [phase, setPhase] = useState<RecordingPhase>('ready');
  const [faceDetected, setFaceDetected] = useState(false);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cameraRef = useRef<any>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const progressAnimation = useRef(new Animated.Value(0)).current;
  const faceValidator = useRef(new FaceQualityValidator()).current;

  const [recordingPromise, setRecordingPromise] = useState<Promise<
    { uri: string } | undefined
  > | null>(null);

  const { setVideo } = useFaceStore();

  // Update phase based on recording time
  useEffect(() => {
    if (!isRecording || isPaused) return;

    if (recordingTime < 10) {
      setPhase('center');
    } else if (recordingTime < 20) {
      setPhase('left');
    } else if (recordingTime < 35) {
      setPhase('right');
    } else if (recordingTime < 45) {
      setPhase('center_final');
    } else {
      setPhase('complete');
    }
  }, [recordingTime, isRecording, isPaused]);

  // Simulate face detection
  useEffect(() => {
    const interval = setInterval(() => {
      setFaceDetected(Math.random() > 0.15);
    }, 500);
    return () => clearInterval(interval);
  }, []);

  // Animate progress bar
  useEffect(() => {
    Animated.timing(progressAnimation, {
      toValue: recordingTime / MAX_DURATION,
      duration: 100,
      useNativeDriver: false,
    }).start();
  }, [recordingTime, progressAnimation]);

  const startTimer = useCallback((): void => {
    timerRef.current = setInterval(() => {
      setRecordingTime((prev) => {
        if (prev >= MAX_DURATION) {
          stopRecording();
          return prev;
        }
        return prev + 1;
      });
    }, 1000);
  }, []);

  const stopTimer = useCallback((): void => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startRecording = useCallback(async (): Promise<void> => {
    if (!cameraRef.current || isRecording) return;

    try {
      setIsRecording(true);
      setIsPaused(false);
      setRecordingTime(0);
      setPhase('center');
      startTimer();

      if (!Constants.isDevice) {
        throw { code: 'ERR_SIMULATOR_NOT_SUPPORTED', message: 'Simulator not supported' };
      }

      const promise = cameraRef.current.recordAsync({
        maxDuration: MAX_DURATION,
      });
      setRecordingPromise(promise);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      console.error('Recording error:', error);
      setIsRecording(false);
      stopTimer();

      const isSimulatorError = error?.code === 'ERR_SIMULATOR_NOT_SUPPORTED';
      const message = isSimulatorError
        ? 'Video recording is not supported on the iOS Simulator. Please use a physical device.'
        : 'Failed to start recording. Please try again.';

      Alert.alert(isSimulatorError ? 'Simulator Limitation' : 'Error', message);
    }
  }, [isRecording, startTimer, stopTimer]);

  const stopRecording = useCallback(async (): Promise<void> => {
    if (!cameraRef.current || !isRecording) return;

    try {
      stopTimer();
      cameraRef.current.stopRecording();

      // Wait for the recording promise to resolve
      const video = recordingPromise ? await recordingPromise : null;

      if (!video?.uri) {
        throw new Error('Failed to save video');
      }

      // Get file info
      const fileInfo = await FileSystem.getInfoAsync(video.uri);
      const fileSize = fileInfo.exists && 'size' in fileInfo ? fileInfo.size : 0;

      // Validate video quality
      const validation = await faceValidator.validateVideo(video.uri, recordingTime, 1920, 1080);

      const faceVideo: FaceVideo = {
        id: `video_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        uri: video.uri,
        duration: recordingTime,
        qualityScore: validation.qualityScore,
        isValid: validation.isValid,
        issues: validation.issues,
        recordedAt: new Date(),
        metadata: {
          width: 1920,
          height: 1080,
          fileSize,
          frameCount: recordingTime * 30,
        },
      };

      setVideo(faceVideo);
      setIsRecording(false);
      setPhase('complete');

      // Check if duration is sufficient
      if (recordingTime < MIN_DURATION) {
        Alert.alert(
          'Video Too Short',
          `Please record at least ${MIN_DURATION} seconds. You recorded ${recordingTime} seconds.`,
          [
            { text: 'Try Again', onPress: () => setRecordingTime(0) },
            { text: 'Continue Anyway', onPress: () => navigation.navigate('FaceReview') },
          ]
        );
      } else {
        navigation.navigate('FaceReview');
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      console.error('Stop recording error:', error);
      setIsRecording(false);
      stopTimer();

      const isSimulatorError = error?.code === 'ERR_SIMULATOR_NOT_SUPPORTED';
      const message = isSimulatorError
        ? 'Video recording failed because it is not supported on the simulator.'
        : 'Failed to save video. Please try again.';

      Alert.alert(isSimulatorError ? 'Simulator Limitation' : 'Error', message);
    }
  }, [isRecording, recordingTime, faceValidator, setVideo, navigation, stopTimer]);

  const togglePause = useCallback((): void => {
    if (isPaused) {
      startTimer();
      setIsPaused(false);
    } else {
      stopTimer();
      setIsPaused(true);
    }
  }, [isPaused, startTimer, stopTimer]);

  const handleCancel = useCallback((): void => {
    if (isRecording) {
      Alert.alert('Cancel Recording', 'Are you sure you want to cancel the recording?', [
        { text: 'Continue Recording', style: 'cancel' },
        {
          text: 'Cancel',
          style: 'destructive',
          onPress: async () => {
            stopTimer();
            if (cameraRef.current) {
              await cameraRef.current.stopRecording();
            }
            setIsRecording(false);
            navigation.goBack();
          },
        },
      ]);
    } else {
      navigation.goBack();
    }
  }, [isRecording, navigation, stopTimer]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const hasPermissions = cameraPermission?.granted && microphonePermission?.granted;
  // If one is missing, show request prompt

  if (!cameraPermission || !microphonePermission) {
    // Permissions are still loading
    return (
      <View style={styles.container}>
        <Text style={styles.permissionText}>Checking permissions...</Text>
      </View>
    );
  }

  if (!hasPermissions) {
    return (
      <View style={styles.container}>
        <Text style={styles.permissionText}>Camera and Microphone permissions are required</Text>
        {!cameraPermission.granted && (
          <TouchableOpacity
            style={[styles.permissionButton, { marginBottom: 10 }]}
            onPress={requestCameraPermission}
          >
            <Text style={styles.permissionButtonText}>Grant Camera</Text>
          </TouchableOpacity>
        )}
        {!microphonePermission.granted && (
          <TouchableOpacity style={styles.permissionButton} onPress={requestMicrophonePermission}>
            <Text style={styles.permissionButtonText}>Grant Microphone</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {CameraView ? (
        <View style={styles.cameraContainer}>
          <CameraView ref={cameraRef} style={styles.camera} facing={facing} mode="video" />

          {/* UI Layer - Layered over camera using absolute positioning to avoid Fabric crashes with complex native children */}
          <View
            style={[StyleSheet.absoluteFill, { backgroundColor: 'transparent' }]}
            pointerEvents="box-none"
          >
            {/* Face alignment overlay */}
            <View style={styles.overlay} pointerEvents="none">
              <View style={styles.ovalContainer}>
                <View
                  style={[styles.oval, faceDetected ? styles.ovalDetected : styles.ovalNotDetected]}
                />
              </View>

              {/* Phase instruction */}
              <View style={styles.instructionContainer}>
                <Text style={styles.instructionText}>{PHASE_INSTRUCTIONS[phase]}</Text>
                {phase !== 'ready' && phase !== 'complete' && (
                  <View style={styles.arrowContainer}>
                    {phase === 'left' && <Text style={styles.arrow}>←</Text>}
                    {phase === 'right' && <Text style={styles.arrow}>→</Text>}
                  </View>
                )}
              </View>
            </View>

            {/* Top controls */}
            <View style={styles.topControls}>
              <TouchableOpacity style={styles.controlButton} onPress={handleCancel}>
                <Text style={styles.controlIcon}>✕</Text>
              </TouchableOpacity>

              {/* Timer */}
              <View style={styles.timerContainer}>
                {isRecording && (
                  <View style={styles.recordingIndicator}>
                    <View style={styles.recordingDot} />
                    <Text style={styles.timerText}>{formatTime(recordingTime)}</Text>
                  </View>
                )}
              </View>

              <View style={styles.controlButton} />
            </View>

            {/* Progress bar */}
            {isRecording && (
              <View style={styles.progressContainer}>
                <Animated.View
                  style={[
                    styles.progressBar,
                    {
                      width: progressAnimation.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0%', '100%'],
                      }),
                    },
                  ]}
                />
                <View
                  style={[
                    styles.progressMarker,
                    { left: `${(MIN_DURATION / MAX_DURATION) * 100}%` },
                  ]}
                />
              </View>
            )}

            {/* Bottom controls */}
            <View style={styles.bottomControls}>
              {/* Photo mode button */}
              <TouchableOpacity
                style={styles.modeButton}
                onPress={() => navigation.goBack()}
                disabled={isRecording}
              >
                <Text style={styles.modeIcon}>📷</Text>
                <Text style={styles.modeText}>Photo</Text>
              </TouchableOpacity>

              {/* Record button */}
              {!isRecording ? (
                <TouchableOpacity style={styles.recordButton} onPress={startRecording}>
                  <View style={styles.recordButtonInner} />
                </TouchableOpacity>
              ) : (
                <View style={styles.recordingControls}>
                  <TouchableOpacity style={styles.pauseButton} onPress={togglePause}>
                    <Text style={styles.pauseIcon}>{isPaused ? '▶' : '⏸'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.stopButton,
                      recordingTime < MIN_DURATION && styles.stopButtonDisabled,
                    ]}
                    onPress={stopRecording}
                  >
                    <View style={styles.stopButtonInner} />
                  </TouchableOpacity>
                </View>
              )}

              {/* Placeholder for symmetry */}
              <View style={styles.modeButton} />
            </View>

            {/* Duration hint */}
            {!isRecording && (
              <View style={styles.hintContainer}>
                <Text style={styles.hintText}>
                  Record {MIN_DURATION}-{MAX_DURATION} seconds
                </Text>
                <Text style={styles.hintSubtext}>
                  Slowly turn your head left and right during recording
                </Text>
              </View>
            )}
          </View>
        </View>
      ) : (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Camera module not available</Text>
          <TouchableOpacity style={styles.permissionButton} onPress={() => navigation.goBack()}>
            <Text style={styles.permissionButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  camera: {
    flex: 1,
    width: '100%',
  },
  cameraContainer: {
    flex: 1,
    width: '100%',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ovalContainer: {
    width: OVAL_WIDTH,
    height: OVAL_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  oval: {
    width: OVAL_WIDTH,
    height: OVAL_HEIGHT,
    borderRadius: OVAL_WIDTH / 2,
    borderWidth: 3,
  },
  ovalDetected: {
    borderColor: lightColors.success,
  },
  ovalNotDetected: {
    borderColor: lightColors.warning,
  },
  instructionContainer: {
    marginTop: 20,
    alignItems: 'center',
  },
  instructionText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  arrowContainer: {
    marginTop: 10,
  },
  arrow: {
    fontSize: 48,
    color: lightColors.primary,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  topControls: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  controlButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlIcon: {
    fontSize: 20,
    color: '#fff',
  },
  timerContainer: {
    alignItems: 'center',
  },
  recordingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: lightColors.error,
    marginRight: 8,
  },
  timerText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  progressContainer: {
    position: 'absolute',
    top: 110,
    left: 20,
    right: 20,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 2,
  },
  progressBar: {
    height: '100%',
    backgroundColor: lightColors.primary,
    borderRadius: 2,
  },
  progressMarker: {
    position: 'absolute',
    top: -4,
    width: 2,
    height: 12,
    backgroundColor: lightColors.success,
  },
  bottomControls: {
    position: 'absolute',
    bottom: 80,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  modeButton: {
    width: 60,
    alignItems: 'center',
  },
  modeIcon: {
    fontSize: 24,
  },
  modeText: {
    color: '#fff',
    fontSize: 12,
    marginTop: 4,
  },
  recordButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#fff',
  },
  recordButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: lightColors.error,
  },
  recordingControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  pauseButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pauseIcon: {
    fontSize: 20,
    color: '#fff',
  },
  stopButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#fff',
  },
  stopButtonDisabled: {
    opacity: 0.5,
  },
  stopButtonInner: {
    width: 30,
    height: 30,
    borderRadius: 4,
    backgroundColor: lightColors.error,
  },
  hintContainer: {
    position: 'absolute',
    bottom: 180,
    left: 20,
    right: 20,
    alignItems: 'center',
  },
  hintText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
  },
  hintSubtext: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 4,
  },
  permissionText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  permissionButton: {
    backgroundColor: lightColors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  permissionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  errorContainer: {
    padding: 20,
    alignItems: 'center',
  },
  errorText: {
    color: '#fff',
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 20,
  },
});

export default FaceVideoRecordScreen;
