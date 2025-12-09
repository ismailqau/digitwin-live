/**
 * VoiceUploadScreen
 *
 * Screen for uploading voice samples with progress tracking.
 * Implements Task 13.3.4:
 * - Upload progress bar with percentage
 * - Estimated time remaining
 * - Cancel upload with confirmation
 * - Error handling with retry option
 * - Success animation
 * - Auto-navigate to training status
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
  SafeAreaView,
  ActivityIndicator,
  Animated,
} from 'react-native';

import type { VoiceSample } from '../../services/VoiceSampleManager';

type NavigationProp = NativeStackNavigationProp<Record<string, object | undefined>>;
type RouteParams = RouteProp<{ params: { samples: VoiceSample[] } }, 'params'>;

interface UploadProgress {
  current: number;
  total: number;
  percentage: number;
  estimatedTimeRemaining: number; // in seconds
  currentSample: number;
}

export const VoiceUploadScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteParams>();

  const samples = route.params?.samples || [];
  const [uploadProgress, setUploadProgress] = useState<UploadProgress>({
    current: 0,
    total: samples.length,
    percentage: 0,
    estimatedTimeRemaining: 0,
    currentSample: 0,
  });
  const [isUploading, setIsUploading] = useState(false);
  const [uploadComplete, setUploadComplete] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [voiceModelId, setVoiceModelId] = useState<string | null>(null);

  const successAnimation = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Start upload automatically when screen loads
    startUpload();
  }, []);

  useEffect(() => {
    if (uploadComplete) {
      // Animate success checkmark
      Animated.spring(successAnimation, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }).start();

      // Auto-navigate to training status after 2 seconds
      const timer = setTimeout(() => {
        if (voiceModelId) {
          navigation.replace('VoiceTrainingStatus', { modelId: voiceModelId });
        }
      }, 2000);

      return () => clearTimeout(timer);
    }
    return undefined;
  }, [uploadComplete, voiceModelId, navigation]);

  const startUpload = async () => {
    try {
      setIsUploading(true);
      setUploadError(null);

      // Simulate upload process
      // In real implementation, this would call the VoiceSampleManager.uploadSamples()
      for (let i = 0; i < samples.length; i++) {
        // Update progress
        setUploadProgress({
          current: i + 1,
          total: samples.length,
          percentage: ((i + 1) / samples.length) * 100,
          estimatedTimeRemaining: (samples.length - i - 1) * 5, // 5 seconds per sample estimate
          currentSample: i + 1,
        });

        // Simulate upload delay
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }

      // Upload complete
      const mockModelId = `model_${Date.now()}`;
      setVoiceModelId(mockModelId);
      setUploadComplete(true);
      setIsUploading(false);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Upload failed');
      setIsUploading(false);
    }
  };

  const handleCancelUpload = () => {
    Alert.alert(
      'Cancel Upload',
      'Are you sure you want to cancel the upload? All progress will be lost.',
      [
        { text: 'Continue Upload', style: 'cancel' },
        {
          text: 'Cancel Upload',
          style: 'destructive',
          onPress: () => {
            setIsUploading(false);
            navigation.goBack();
          },
        },
      ]
    );
  };

  const handleRetry = () => {
    setUploadError(null);
    setUploadProgress({
      current: 0,
      total: samples.length,
      percentage: 0,
      estimatedTimeRemaining: 0,
      currentSample: 0,
    });
    startUpload();
  };

  const formatTime = (seconds: number): string => {
    if (seconds < 60) {
      return `${seconds}s`;
    }
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const checkmarkScale = successAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>
            {uploadComplete
              ? 'Upload Complete!'
              : uploadError
                ? 'Upload Failed'
                : 'Uploading Voice Samples'}
          </Text>
          <Text style={styles.subtitle}>
            {uploadComplete
              ? 'Your voice samples have been uploaded successfully'
              : uploadError
                ? 'An error occurred during upload'
                : 'Please wait while we upload your voice samples'}
          </Text>
        </View>

        {/* Progress Section */}
        {!uploadComplete && !uploadError && (
          <View style={styles.progressSection}>
            {/* Progress Circle or Bar */}
            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${uploadProgress.percentage}%` }]} />
              </View>
              <Text style={styles.progressText}>{Math.round(uploadProgress.percentage)}%</Text>
            </View>

            {/* Upload Details */}
            <View style={styles.detailsContainer}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Samples:</Text>
                <Text style={styles.detailValue}>
                  {uploadProgress.current} / {uploadProgress.total}
                </Text>
              </View>
              {uploadProgress.estimatedTimeRemaining > 0 && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Time Remaining:</Text>
                  <Text style={styles.detailValue}>
                    ~{formatTime(uploadProgress.estimatedTimeRemaining)}
                  </Text>
                </View>
              )}
              {isUploading && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Current Sample:</Text>
                  <Text style={styles.detailValue}>Sample {uploadProgress.currentSample}</Text>
                </View>
              )}
            </View>

            {/* Loading Indicator */}
            {isUploading && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#2196F3" />
                <Text style={styles.loadingText}>Uploading...</Text>
              </View>
            )}
          </View>
        )}

        {/* Success Animation */}
        {uploadComplete && (
          <View style={styles.successContainer}>
            <Animated.View
              style={[
                styles.successCheckmark,
                {
                  transform: [{ scale: checkmarkScale }],
                },
              ]}
            >
              <Text style={styles.successCheckmarkText}>✓</Text>
            </Animated.View>
            <Text style={styles.successMessage}>Voice samples uploaded successfully!</Text>
            <Text style={styles.successSubtext}>Starting voice model training...</Text>
          </View>
        )}

        {/* Error State */}
        {uploadError && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorIcon}>⚠️</Text>
            <Text style={styles.errorMessage}>{uploadError}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
              <Text style={styles.retryButtonText}>Retry Upload</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Action Buttons */}
        {!uploadComplete && (
          <View style={styles.actionContainer}>
            {isUploading && (
              <TouchableOpacity style={styles.cancelButton} onPress={handleCancelUpload}>
                <Text style={styles.cancelButtonText}>Cancel Upload</Text>
              </TouchableOpacity>
            )}
            {uploadError && (
              <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                <Text style={styles.backButtonText}>Go Back</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
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
    padding: 20,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  progressSection: {
    alignItems: 'center',
    marginBottom: 40,
  },
  progressContainer: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 30,
  },
  progressBar: {
    width: '100%',
    height: 12,
    backgroundColor: '#e0e0e0',
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 15,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#2196F3',
    borderRadius: 6,
  },
  progressText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  detailsContainer: {
    width: '100%',
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  detailLabel: {
    fontSize: 16,
    color: '#666',
  },
  detailValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  loadingContainer: {
    alignItems: 'center',
    marginTop: 30,
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
    marginTop: 10,
  },
  successContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  successCheckmark: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  successCheckmarkText: {
    fontSize: 60,
    color: '#fff',
    fontWeight: 'bold',
  },
  successMessage: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginBottom: 10,
    textAlign: 'center',
  },
  successSubtext: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  errorContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  errorIcon: {
    fontSize: 60,
    marginBottom: 20,
  },
  errorMessage: {
    fontSize: 16,
    color: '#F44336',
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  retryButton: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  actionContainer: {
    marginTop: 20,
  },
  cancelButton: {
    backgroundColor: '#F44336',
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  backButton: {
    backgroundColor: '#666',
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default VoiceUploadScreen;
