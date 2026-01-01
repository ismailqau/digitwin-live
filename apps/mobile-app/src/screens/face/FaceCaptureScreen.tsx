/**
 * FaceCaptureScreen
 *
 * Photo capture screen for face model creation with:
 * - Camera preview with front camera default
 * - Face detection overlay with alignment guide
 * - Real-time face detection feedback
 * - Capture button with animation
 * - Flash toggle and camera flip
 * - Guided multi-step capture flow (3-10 photos)
 */

import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
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

import { FaceQualityValidator, AngleGuidance } from '../../services/FaceQualityValidator';
import { useFaceStore, FacePhoto } from '../../store/faceStore';
import { lightColors } from '../../theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const OVAL_WIDTH = SCREEN_WIDTH * 0.7;
const OVAL_HEIGHT = OVAL_WIDTH * 1.3;
const MIN_PHOTOS = 3;
const MAX_PHOTOS = 10;

interface FaceCaptureScreenProps {
  navigation: {
    navigate: (screen: string, params?: Record<string, unknown>) => void;
    goBack: () => void;
  };
}

export function FaceCaptureScreen({ navigation }: FaceCaptureScreenProps): React.ReactElement {
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>('front');
  const [flashEnabled, setFlashEnabled] = useState(false);
  const [faceDetected, setFaceDetected] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [currentGuidance, setCurrentGuidance] = useState<AngleGuidance | null>(null);

  const cameraRef = useRef<CameraView>(null);
  const captureAnimation = useRef(new Animated.Value(1)).current;
  const faceValidator = useRef(new FaceQualityValidator()).current;

  const { photos, addPhoto, setIsCapturing: setStoreCapturing } = useFaceStore();

  // Update guidance when photo count changes
  useEffect(() => {
    const guidance = faceValidator.getAngleGuidance(photos.length, MAX_PHOTOS);
    setCurrentGuidance(guidance);
  }, [photos.length, faceValidator]);

  // Simulate face detection (in production, use ML Kit or Vision Camera)
  useEffect(() => {
    const interval = setInterval(() => {
      // Simulate face detection with 80% success rate when camera is active
      setFaceDetected(Math.random() > 0.2);
    }, 500);
    return () => clearInterval(interval);
  }, []);

  const handleCapture = useCallback(async (): Promise<void> => {
    if (!cameraRef.current || isCapturing) return;

    setIsCapturing(true);
    setStoreCapturing(true);

    // Animate capture button
    Animated.sequence([
      Animated.timing(captureAnimation, {
        toValue: 0.8,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(captureAnimation, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.9,
        skipProcessing: false,
      });

      if (!photo?.uri) {
        throw new Error('Failed to capture photo');
      }

      // Get file info
      const fileInfo = await FileSystem.getInfoAsync(photo.uri);
      const fileSize = fileInfo.exists && 'size' in fileInfo ? fileInfo.size : 0;

      // Validate photo quality
      const validation = await faceValidator.validatePhoto(photo.uri, photo.width, photo.height);

      const facePhoto: FacePhoto = {
        id: `photo_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        uri: photo.uri,
        angle: currentGuidance?.angle ?? 'frontal',
        qualityScore: validation.qualityScore,
        isValid: validation.isValid,
        issues: validation.issues,
        capturedAt: new Date(),
        metadata: {
          width: photo.width,
          height: photo.height,
          fileSize,
        },
      };

      addPhoto(facePhoto);

      // Show feedback if quality is low
      if (!validation.isValid && validation.recommendations.length > 0) {
        Alert.alert('Photo Quality', validation.recommendations[0], [
          { text: 'OK', style: 'default' },
        ]);
      }

      // Check if we have enough photos
      if (photos.length + 1 >= MIN_PHOTOS) {
        // Can proceed to review
      }
    } catch (error) {
      console.error('Capture error:', error);
      Alert.alert('Error', 'Failed to capture photo. Please try again.');
    } finally {
      setIsCapturing(false);
      setStoreCapturing(false);
    }
  }, [
    isCapturing,
    captureAnimation,
    faceValidator,
    currentGuidance,
    addPhoto,
    photos.length,
    setStoreCapturing,
  ]);

  const toggleCameraFacing = useCallback((): void => {
    setFacing((current) => (current === 'back' ? 'front' : 'back'));
  }, []);

  const toggleFlash = useCallback((): void => {
    setFlashEnabled((current) => !current);
  }, []);

  const handleContinue = useCallback((): void => {
    if (photos.length >= MIN_PHOTOS) {
      navigation.navigate('FaceReview');
    } else {
      Alert.alert(
        'More Photos Needed',
        `Please capture at least ${MIN_PHOTOS} photos. You have ${photos.length}.`
      );
    }
  }, [photos.length, navigation]);

  const handleVideoMode = useCallback((): void => {
    navigation.navigate('FaceVideoRecord');
  }, [navigation]);

  if (!permission) {
    return (
      <View style={styles.container}>
        <Text style={styles.permissionText}>Requesting camera permission...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.permissionText}>Camera permission is required</Text>
        <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
          <Text style={styles.permissionButtonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing={facing}
        flash={flashEnabled ? 'on' : 'off'}
      >
        {/* Face alignment overlay */}
        <View style={styles.overlay}>
          <View style={styles.ovalContainer}>
            <View
              style={[styles.oval, faceDetected ? styles.ovalDetected : styles.ovalNotDetected]}
            />
          </View>

          {/* Face detection indicator */}
          <View style={styles.detectionIndicator}>
            <View
              style={[
                styles.detectionDot,
                faceDetected ? styles.dotDetected : styles.dotNotDetected,
              ]}
            />
            <Text style={styles.detectionText}>
              {faceDetected ? 'Face Detected' : 'Position your face'}
            </Text>
          </View>

          {/* Guidance text */}
          {currentGuidance && (
            <View style={styles.guidanceContainer}>
              <Text style={styles.guidanceText}>{currentGuidance.instruction}</Text>
              <Text style={styles.progressText}>
                Photo {photos.length + 1} of {MAX_PHOTOS}
              </Text>
            </View>
          )}
        </View>

        {/* Top controls */}
        <View style={styles.topControls}>
          <TouchableOpacity style={styles.controlButton} onPress={() => navigation.goBack()}>
            <Text style={styles.controlIcon}>✕</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.controlButton} onPress={toggleFlash}>
            <Text style={styles.controlIcon}>{flashEnabled ? '⚡' : '⚡️'}</Text>
          </TouchableOpacity>
        </View>

        {/* Bottom controls */}
        <View style={styles.bottomControls}>
          {/* Video mode button */}
          <TouchableOpacity style={styles.modeButton} onPress={handleVideoMode}>
            <Text style={styles.modeIcon}>🎬</Text>
            <Text style={styles.modeText}>Video</Text>
          </TouchableOpacity>

          {/* Capture button */}
          <Animated.View style={{ transform: [{ scale: captureAnimation }] }}>
            <TouchableOpacity
              style={[styles.captureButton, !faceDetected && styles.captureButtonDisabled]}
              onPress={handleCapture}
              disabled={isCapturing || photos.length >= MAX_PHOTOS}
            >
              <View style={styles.captureButtonInner} />
            </TouchableOpacity>
          </Animated.View>

          {/* Flip camera button */}
          <TouchableOpacity style={styles.modeButton} onPress={toggleCameraFacing}>
            <Text style={styles.modeIcon}>🔄</Text>
            <Text style={styles.modeText}>Flip</Text>
          </TouchableOpacity>
        </View>

        {/* Continue button */}
        {photos.length >= MIN_PHOTOS && (
          <TouchableOpacity style={styles.continueButton} onPress={handleContinue}>
            <Text style={styles.continueText}>Continue ({photos.length} photos)</Text>
          </TouchableOpacity>
        )}

        {/* Photo count indicator */}
        <View style={styles.photoCountContainer}>
          {Array.from({ length: MAX_PHOTOS }).map((_, index) => (
            <View
              key={index}
              style={[
                styles.photoCountDot,
                index < photos.length && styles.photoCountDotFilled,
                index < MIN_PHOTOS && index >= photos.length && styles.photoCountDotRequired,
              ]}
            />
          ))}
        </View>
      </CameraView>
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
  detectionIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 20,
  },
  detectionDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  dotDetected: {
    backgroundColor: lightColors.success,
  },
  dotNotDetected: {
    backgroundColor: lightColors.warning,
  },
  detectionText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  guidanceContainer: {
    position: 'absolute',
    top: 120,
    alignItems: 'center',
  },
  guidanceText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  progressText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    marginTop: 8,
  },
  topControls: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
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
  bottomControls: {
    position: 'absolute',
    bottom: 100,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  modeButton: {
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
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#fff',
  },
  captureButtonDisabled: {
    opacity: 0.5,
  },
  captureButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#fff',
  },
  continueButton: {
    position: 'absolute',
    bottom: 40,
    left: 40,
    right: 40,
    backgroundColor: lightColors.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  continueText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  photoCountContainer: {
    position: 'absolute',
    bottom: 160,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  photoCountDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  photoCountDotFilled: {
    backgroundColor: lightColors.success,
  },
  photoCountDotRequired: {
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
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
});

export default FaceCaptureScreen;
