/**
 * FaceUploadScreen
 *
 * Upload progress screen for face model creation with:
 * - Upload progress with thumbnail previews
 * - Individual photo upload status
 * - Overall progress percentage
 * - Cancel upload with confirmation
 * - Error handling with retry option
 * - Auto-navigation to processing status on success
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  FlatList,
  Animated,
  Alert,
} from 'react-native';

import { useAuthStore } from '../../store/authStore';
import { useFaceStore } from '../../store/faceStore';
import { lightColors } from '../../theme';

interface FaceUploadScreenProps {
  navigation: {
    navigate: (screen: string, params?: Record<string, unknown>) => void;
    goBack: () => void;
    reset: (state: { index: number; routes: Array<{ name: string }> }) => void;
  };
}

type UploadStatus = 'pending' | 'uploading' | 'completed' | 'failed';

interface UploadItem {
  id: string;
  type: 'photo' | 'video';
  uri: string;
  status: UploadStatus;
  progress: number;
  error?: string;
}

export function FaceUploadScreen({ navigation }: FaceUploadScreenProps): React.ReactElement {
  const [uploadItems, setUploadItems] = useState<UploadItem[]>([]);
  const [overallProgress, setOverallProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [isCancelled, setIsCancelled] = useState(false);
  const [, setFaceModelId] = useState<string | null>(null);

  const progressAnimation = useRef(new Animated.Value(0)).current;
  const abortControllerRef = useRef<AbortController | null>(null);

  const { photos, video, setIsUploading: setStoreUploading, setProgress } = useFaceStore();
  const { user } = useAuthStore();

  // Initialize upload items
  useEffect(() => {
    const items: UploadItem[] = photos.map((photo) => ({
      id: photo.id,
      type: 'photo',
      uri: photo.uri,
      status: 'pending',
      progress: 0,
    }));

    if (video) {
      items.push({
        id: video.id,
        type: 'video',
        uri: video.uri,
        status: 'pending',
        progress: 0,
      });
    }

    setUploadItems(items);
  }, [photos, video]);

  // Start upload automatically
  useEffect(() => {
    if (uploadItems.length > 0 && !isUploading && !isCancelled) {
      startUpload();
    }
  }, [uploadItems.length]);

  // Animate progress bar
  useEffect(() => {
    Animated.timing(progressAnimation, {
      toValue: overallProgress / 100,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [overallProgress, progressAnimation]);

  const updateItemStatus = useCallback(
    (itemId: string, status: UploadStatus, progress: number, error?: string): void => {
      setUploadItems((prev) =>
        prev.map((item) => (item.id === itemId ? { ...item, status, progress, error } : item))
      );
    },
    []
  );

  const calculateOverallProgress = useCallback((items: UploadItem[]): number => {
    if (items.length === 0) return 0;
    const totalProgress = items.reduce((sum, item) => sum + item.progress, 0);
    return Math.round(totalProgress / items.length);
  }, []);

  const uploadItem = async (item: UploadItem): Promise<string> => {
    updateItemStatus(item.id, 'uploading', 0);

    // Simulate chunked upload with progress
    const chunks = 10;
    for (let i = 1; i <= chunks; i++) {
      if (isCancelled || abortControllerRef.current?.signal.aborted) {
        throw new Error('Upload cancelled');
      }

      // Simulate network delay
      await new Promise((resolve) => setTimeout(resolve, 200 + Math.random() * 300));

      const progress = (i / chunks) * 100;
      updateItemStatus(item.id, 'uploading', progress);

      // Update overall progress
      setUploadItems((prev) => {
        const updated = prev.map((p) => (p.id === item.id ? { ...p, progress } : p));
        setOverallProgress(calculateOverallProgress(updated));
        return updated;
      });
    }

    updateItemStatus(item.id, 'completed', 100);

    // Return simulated upload ID
    return `upload_${item.id}_${Date.now()}`;
  };

  const startUpload = async (): Promise<void> => {
    if (isUploading) return;

    setIsUploading(true);
    setStoreUploading(true);
    setIsCancelled(false);
    abortControllerRef.current = new AbortController();

    setProgress({
      status: 'uploading',
      progress: 0,
      currentStep: 'Uploading face data...',
    });

    try {
      const uploadIds: string[] = [];

      for (const item of uploadItems) {
        if (isCancelled || abortControllerRef.current?.signal.aborted) {
          throw new Error('Upload cancelled');
        }

        try {
          const uploadId = await uploadItem(item);
          uploadIds.push(uploadId);
        } catch (error) {
          if ((error as Error).message === 'Upload cancelled') {
            throw error;
          }
          updateItemStatus(item.id, 'failed', 0, (error as Error).message);
          throw error;
        }
      }

      // Create face model
      const modelId = await createFaceModel(uploadIds);
      setFaceModelId(modelId);

      setProgress({
        status: 'detecting',
        progress: 100,
        currentStep: 'Upload complete. Starting processing...',
      });

      // Navigate to processing status
      setTimeout(() => {
        navigation.navigate('FaceProcessingStatus', { modelId });
      }, 1000);
    } catch (error) {
      if ((error as Error).message !== 'Upload cancelled') {
        setProgress({
          status: 'failed',
          progress: 0,
          currentStep: 'Upload failed',
          error: (error as Error).message,
        });
      }
    } finally {
      setIsUploading(false);
      setStoreUploading(false);
    }
  };

  const createFaceModel = async (uploadIds: string[]): Promise<string> => {
    // Simulate API call to create face model
    await new Promise((resolve) => setTimeout(resolve, 500));

    // In production, this would call the API
    const modelId = `face_model_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    console.log('Creating face model with uploads:', {
      userId: user?.id,
      uploadIds,
      modelId,
    });

    return modelId;
  };

  const handleCancel = useCallback((): void => {
    Alert.alert(
      'Cancel Upload',
      'Are you sure you want to cancel the upload? All progress will be lost.',
      [
        { text: 'Continue Upload', style: 'cancel' },
        {
          text: 'Cancel',
          style: 'destructive',
          onPress: () => {
            setIsCancelled(true);
            abortControllerRef.current?.abort();
            setIsUploading(false);
            setStoreUploading(false);
            navigation.goBack();
          },
        },
      ]
    );
  }, [navigation, setStoreUploading]);

  const handleRetry = useCallback((): void => {
    // Reset failed items to pending
    setUploadItems((prev) =>
      prev.map((item) =>
        item.status === 'failed'
          ? { ...item, status: 'pending', progress: 0, error: undefined }
          : item
      )
    );
    setOverallProgress(0);
    setIsCancelled(false);
    startUpload();
  }, []);

  const getStatusIcon = (status: UploadStatus): string => {
    switch (status) {
      case 'pending':
        return '⏳';
      case 'uploading':
        return '📤';
      case 'completed':
        return '✅';
      case 'failed':
        return '❌';
    }
  };

  const getStatusColor = (status: UploadStatus): string => {
    switch (status) {
      case 'pending':
        return lightColors.textSecondary;
      case 'uploading':
        return lightColors.primary;
      case 'completed':
        return lightColors.success;
      case 'failed':
        return lightColors.error;
    }
  };

  const renderUploadItem = ({ item }: { item: UploadItem }): React.ReactElement => (
    <View style={styles.uploadItem}>
      <Image source={{ uri: item.uri }} style={styles.thumbnail} />
      <View style={styles.itemInfo}>
        <Text style={styles.itemType}>{item.type === 'photo' ? 'Photo' : 'Video'}</Text>
        <View style={styles.itemProgress}>
          <View
            style={[
              styles.itemProgressBar,
              {
                width: `${item.progress}%`,
                backgroundColor: getStatusColor(item.status),
              },
            ]}
          />
        </View>
        {item.error && <Text style={styles.itemError}>{item.error}</Text>}
      </View>
      <Text style={styles.statusIcon}>{getStatusIcon(item.status)}</Text>
    </View>
  );

  const hasFailedItems = uploadItems.some((item) => item.status === 'failed');
  const allCompleted = uploadItems.every((item) => item.status === 'completed');

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={handleCancel}
          disabled={allCompleted}
        >
          <Text style={[styles.cancelText, allCompleted && styles.cancelTextDisabled]}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Uploading</Text>
        <View style={styles.cancelButton} />
      </View>

      {/* Overall progress */}
      <View style={styles.progressSection}>
        <View style={styles.progressCircle}>
          <Text style={styles.progressPercent}>{overallProgress}%</Text>
        </View>
        <Text style={styles.progressLabel}>
          {allCompleted
            ? 'Upload Complete!'
            : hasFailedItems
              ? 'Upload Failed'
              : 'Uploading face data...'}
        </Text>
        <View style={styles.progressBarContainer}>
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
        </View>
      </View>

      {/* Upload items list */}
      <FlatList
        data={uploadItems}
        renderItem={renderUploadItem}
        keyExtractor={(item) => item.id}
        style={styles.list}
        contentContainerStyle={styles.listContent}
      />

      {/* Retry button for failed uploads */}
      {hasFailedItems && !isUploading && (
        <View style={styles.retryContainer}>
          <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
            <Text style={styles.retryText}>Retry Failed Uploads</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Tips while uploading */}
      {isUploading && (
        <View style={styles.tipsContainer}>
          <Text style={styles.tipsTitle}>💡 Did you know?</Text>
          <Text style={styles.tipsText}>
            Your face model will be used to create realistic lip-sync animations during
            conversations.
          </Text>
        </View>
      )}
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
  progressSection: {
    alignItems: 'center',
    paddingVertical: 32,
    backgroundColor: lightColors.surface,
  },
  progressCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: lightColors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  progressPercent: {
    fontSize: 28,
    fontWeight: '700',
    color: lightColors.primary,
  },
  progressLabel: {
    fontSize: 16,
    color: lightColors.text,
    marginBottom: 16,
  },
  progressBarContainer: {
    width: '80%',
    height: 6,
    backgroundColor: lightColors.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: lightColors.primary,
    borderRadius: 3,
  },
  list: {
    flex: 1,
  },
  listContent: {
    padding: 16,
  },
  uploadItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: lightColors.surface,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  thumbnail: {
    width: 50,
    height: 50,
    borderRadius: 8,
    backgroundColor: lightColors.border,
  },
  itemInfo: {
    flex: 1,
    marginLeft: 12,
  },
  itemType: {
    fontSize: 14,
    fontWeight: '500',
    color: lightColors.text,
    marginBottom: 6,
  },
  itemProgress: {
    height: 4,
    backgroundColor: lightColors.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  itemProgressBar: {
    height: '100%',
    borderRadius: 2,
  },
  itemError: {
    fontSize: 12,
    color: lightColors.error,
    marginTop: 4,
  },
  statusIcon: {
    fontSize: 20,
    marginLeft: 12,
  },
  retryContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  retryButton: {
    backgroundColor: lightColors.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  retryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  tipsContainer: {
    padding: 16,
    paddingBottom: 32,
    backgroundColor: lightColors.primaryLight,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
  },
  tipsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: lightColors.primary,
    marginBottom: 4,
  },
  tipsText: {
    fontSize: 13,
    color: lightColors.text,
    lineHeight: 18,
  },
});

export default FaceUploadScreen;
