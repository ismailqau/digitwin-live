/**
 * FaceReviewScreen
 *
 * Photo/video review gallery for face model creation with:
 * - Grid layout for captured photos
 * - Quality score badge on each photo
 * - Tap to view full-size photo
 * - Delete individual photos
 * - Video thumbnail with play button
 * - Total capture summary
 * - "Capture More" and "Continue to Upload" buttons
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Image,
  Modal,
  Dimensions,
  Alert,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FaceQualityValidator, OverallValidationResult } from '../../services/FaceQualityValidator';
import { useFaceStore, FacePhoto } from '../../store/faceStore';
import { lightColors } from '../../theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_SPACING = 8;
const NUM_COLUMNS = 3;
const ITEM_SIZE = (SCREEN_WIDTH - GRID_SPACING * (NUM_COLUMNS + 1)) / NUM_COLUMNS;
const MIN_PHOTOS = 3;

interface FaceReviewScreenProps {
  navigation: {
    navigate: (screen: string, params?: Record<string, unknown>) => void;
    goBack: () => void;
  };
}

export function FaceReviewScreen({ navigation }: FaceReviewScreenProps): React.ReactElement {
  const [selectedPhoto, setSelectedPhoto] = useState<FacePhoto | null>(null);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const insets = useSafeAreaInsets();

  const { photos, video, removePhoto, setVideo } = useFaceStore();
  const faceValidator = useMemo(() => new FaceQualityValidator(), []);

  // Calculate overall validation
  const overallValidation: OverallValidationResult = useMemo(() => {
    const photoValidations = photos.map((photo) => ({
      isValid: photo.isValid,
      qualityScore: photo.qualityScore,
      metrics: {
        faceDetected: true,
        faceConfidence: 0.9,
        lighting: 'good' as const,
        lightingScore: 0.8,
        angle: photo.angle,
        angleDeviation: 10,
        resolution: { width: photo.metadata.width, height: photo.metadata.height },
        isResolutionValid: true,
        blurScore: 0.1,
        isBlurry: false,
        faceSize: 0.4,
        isFaceSizeValid: true,
      },
      issues: photo.issues,
      recommendations: [],
      canProceed: photo.isValid,
    }));

    return faceValidator.validateAllMedia(photoValidations);
  }, [photos, faceValidator]);

  const handleDeletePhoto = useCallback(
    (photoId: string): void => {
      Alert.alert('Delete Photo', 'Are you sure you want to delete this photo?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => removePhoto(photoId),
        },
      ]);
    },
    [removePhoto]
  );

  const handleDeleteVideo = useCallback((): void => {
    Alert.alert('Delete Video', 'Are you sure you want to delete this video?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => setVideo(null),
      },
    ]);
  }, [setVideo]);

  const handleCaptureMore = useCallback((): void => {
    navigation.goBack();
  }, [navigation]);

  const handleContinue = useCallback((): void => {
    if (!overallValidation.canProceed && !video) {
      Alert.alert(
        'More Photos Needed',
        `Please capture at least ${MIN_PHOTOS} valid photos or a video.`,
        [{ text: 'OK' }]
      );
      return;
    }

    navigation.navigate('FaceUpload');
  }, [overallValidation.canProceed, video, navigation]);

  const getQualityColor = (score: number): string => {
    if (score >= 80) return lightColors.success;
    if (score >= 60) return lightColors.warning;
    return lightColors.error;
  };

  const renderPhotoItem = ({ item }: { item: FacePhoto }): React.ReactElement => (
    <TouchableOpacity
      style={styles.photoItem}
      onPress={() => setSelectedPhoto(item)}
      onLongPress={() => handleDeletePhoto(item.id)}
    >
      <Image source={{ uri: item.uri }} style={styles.photoImage} />
      <View style={[styles.qualityBadge, { backgroundColor: getQualityColor(item.qualityScore) }]}>
        <Text style={styles.qualityText}>{item.qualityScore}</Text>
      </View>
      {!item.isValid && (
        <View style={styles.warningBadge}>
          <Text style={styles.warningIcon}>⚠️</Text>
        </View>
      )}
      <TouchableOpacity style={styles.deleteButton} onPress={() => handleDeletePhoto(item.id)}>
        <Text style={styles.deleteIcon}>✕</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );

  const renderVideoSection = (): React.ReactElement | null => {
    if (!video) return null;

    return (
      <View style={styles.videoSection}>
        <Text style={styles.sectionTitle}>Video Recording</Text>
        <TouchableOpacity style={styles.videoContainer} onPress={() => setIsVideoPlaying(true)}>
          <View style={styles.videoThumbnail}>
            <View style={styles.videoPlaceholder}>
              <Text style={styles.videoPlaceholderIcon}>🎬</Text>
            </View>
          </View>
          <View style={styles.playButton}>
            <Text style={styles.playIcon}>▶</Text>
          </View>
          <View
            style={[
              styles.videoQualityBadge,
              { backgroundColor: getQualityColor(video.qualityScore) },
            ]}
          >
            <Text style={styles.qualityText}>{video.qualityScore}</Text>
          </View>
          <View style={styles.videoDuration}>
            <Text style={styles.durationText}>{video.duration}s</Text>
          </View>
          <TouchableOpacity style={styles.videoDeleteButton} onPress={handleDeleteVideo}>
            <Text style={styles.deleteIcon}>✕</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </View>
    );
  };

  const renderSummary = (): React.ReactElement => (
    <View style={styles.summaryContainer}>
      <Text style={styles.summaryTitle}>Capture Summary</Text>
      <View style={styles.summaryRow}>
        <Text style={styles.summaryLabel}>Photos:</Text>
        <Text style={styles.summaryValue}>
          {overallValidation.validPhotoCount}/{overallValidation.totalPhotoCount} valid
        </Text>
      </View>
      {video && (
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Video:</Text>
          <Text style={styles.summaryValue}>{video.duration}s recorded</Text>
        </View>
      )}
      <View style={styles.summaryRow}>
        <Text style={styles.summaryLabel}>Average Quality:</Text>
        <Text
          style={[
            styles.summaryValue,
            { color: getQualityColor(overallValidation.averageQualityScore) },
          ]}
        >
          {overallValidation.averageQualityScore}/100
        </Text>
      </View>

      {overallValidation.issues.length > 0 && (
        <View style={styles.issuesContainer}>
          <Text style={styles.issuesTitle}>Issues:</Text>
          {overallValidation.issues.slice(0, 3).map((issue, index) => (
            <Text key={index} style={styles.issueText}>
              • {issue}
            </Text>
          ))}
        </View>
      )}

      {overallValidation.recommendations.length > 0 && (
        <View style={styles.recommendationsContainer}>
          <Text style={styles.recommendationsTitle}>Tips:</Text>
          {overallValidation.recommendations.slice(0, 2).map((rec, index) => (
            <Text key={index} style={styles.recommendationText}>
              💡 {rec}
            </Text>
          ))}
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Review Captures</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Photos section */}
        {photos.length > 0 && (
          <View style={styles.photosSection}>
            <Text style={styles.sectionTitle}>Photos ({photos.length})</Text>
            <FlatList
              data={photos}
              renderItem={renderPhotoItem}
              keyExtractor={(item) => item.id}
              numColumns={NUM_COLUMNS}
              scrollEnabled={false}
              contentContainerStyle={styles.photoGrid}
            />
          </View>
        )}

        {/* Video section */}
        {renderVideoSection()}

        {/* Summary */}
        {renderSummary()}

        {/* Empty state */}
        {photos.length === 0 && !video && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📷</Text>
            <Text style={styles.emptyText}>No captures yet</Text>
            <Text style={styles.emptySubtext}>Go back to capture photos or record a video</Text>
          </View>
        )}
      </ScrollView>

      {/* Bottom buttons */}
      <View style={[styles.bottomButtons, { paddingBottom: insets.bottom + 20 }]}>
        <TouchableOpacity style={styles.captureMoreButton} onPress={handleCaptureMore}>
          <Text style={styles.captureMoreText}>Capture More</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.continueButton,
            !overallValidation.canProceed && !video && styles.continueButtonDisabled,
          ]}
          onPress={handleContinue}
        >
          <Text style={styles.continueText}>Continue to Upload</Text>
        </TouchableOpacity>
      </View>

      {/* Full-size photo modal */}
      <Modal visible={selectedPhoto !== null} transparent animationType="fade">
        <View style={styles.modalContainer}>
          <TouchableOpacity style={styles.modalClose} onPress={() => setSelectedPhoto(null)}>
            <Text style={styles.modalCloseIcon}>✕</Text>
          </TouchableOpacity>
          {selectedPhoto && (
            <>
              <Image
                source={{ uri: selectedPhoto.uri }}
                style={styles.modalImage}
                resizeMode="contain"
              />
              <View style={styles.modalInfo}>
                <Text style={styles.modalInfoText}>Quality: {selectedPhoto.qualityScore}/100</Text>
                <Text style={styles.modalInfoText}>Angle: {selectedPhoto.angle}</Text>
                {selectedPhoto.issues.length > 0 && (
                  <Text style={styles.modalIssue}>{selectedPhoto.issues[0]}</Text>
                )}
              </View>
            </>
          )}
        </View>
      </Modal>

      {/* Video player modal */}
      <Modal visible={isVideoPlaying} transparent animationType="fade">
        <View style={styles.modalContainer}>
          <TouchableOpacity style={styles.modalClose} onPress={() => setIsVideoPlaying(false)}>
            <Text style={styles.modalCloseIcon}>✕</Text>
          </TouchableOpacity>
          {video && (
            <View style={styles.modalVideo}>
              <Text style={styles.videoPlayingText}>Playing: {video.uri}</Text>
            </View>
          )}
        </View>
      </Modal>
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
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backIcon: {
    fontSize: 24,
    color: lightColors.text,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: lightColors.text,
  },
  content: {
    flex: 1,
    padding: GRID_SPACING,
  },
  photosSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: lightColors.text,
    marginBottom: 12,
  },
  photoGrid: {
    gap: GRID_SPACING,
  },
  photoItem: {
    width: ITEM_SIZE,
    height: ITEM_SIZE,
    marginRight: GRID_SPACING,
    marginBottom: GRID_SPACING,
    borderRadius: 8,
    overflow: 'hidden',
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  qualityBadge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  qualityText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  warningBadge: {
    position: 'absolute',
    top: 4,
    left: 4,
  },
  warningIcon: {
    fontSize: 16,
  },
  deleteButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteIcon: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  videoSection: {
    marginBottom: 20,
  },
  videoContainer: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  videoThumbnail: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: lightColors.backgroundTertiary,
  },
  videoPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoPlaceholderIcon: {
    fontSize: 48,
  },
  videoPlayingText: {
    color: '#fff',
    fontSize: 14,
    textAlign: 'center',
  },
  playButton: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -30,
    marginLeft: -30,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playIcon: {
    fontSize: 24,
    color: lightColors.primary,
    marginLeft: 4,
  },
  videoQualityBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  videoDuration: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  durationText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  videoDeleteButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  summaryContainer: {
    backgroundColor: lightColors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: lightColors.text,
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: lightColors.textSecondary,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '500',
    color: lightColors.text,
  },
  issuesContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: lightColors.border,
  },
  issuesTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: lightColors.error,
    marginBottom: 4,
  },
  issueText: {
    fontSize: 13,
    color: lightColors.error,
    marginBottom: 2,
  },
  recommendationsContainer: {
    marginTop: 12,
  },
  recommendationsTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: lightColors.text,
    marginBottom: 4,
  },
  recommendationText: {
    fontSize: 13,
    color: lightColors.textSecondary,
    marginBottom: 2,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: lightColors.text,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: lightColors.textSecondary,
    textAlign: 'center',
  },
  bottomButtons: {
    flexDirection: 'row',
    padding: 16,
    paddingBottom: 32,
    backgroundColor: lightColors.surface,
    borderTopWidth: 1,
    borderTopColor: lightColors.border,
    gap: 12,
  },
  captureMoreButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: lightColors.primary,
    alignItems: 'center',
  },
  captureMoreText: {
    color: lightColors.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  continueButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: lightColors.primary,
    alignItems: 'center',
  },
  continueButtonDisabled: {
    backgroundColor: lightColors.textTertiary,
  },
  continueText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalClose: {
    position: 'absolute',
    top: 50,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  modalCloseIcon: {
    color: '#fff',
    fontSize: 20,
  },
  modalImage: {
    width: SCREEN_WIDTH - 40,
    height: SCREEN_WIDTH - 40,
  },
  modalVideo: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH * 0.75,
  },
  modalInfo: {
    marginTop: 20,
    alignItems: 'center',
  },
  modalInfoText: {
    color: '#fff',
    fontSize: 16,
    marginBottom: 4,
  },
  modalIssue: {
    color: lightColors.warning,
    fontSize: 14,
    marginTop: 8,
  },
});

export default FaceReviewScreen;
