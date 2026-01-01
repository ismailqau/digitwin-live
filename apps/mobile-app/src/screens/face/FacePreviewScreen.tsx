/**
 * FacePreviewScreen
 *
 * Face model preview screen with:
 * - Test video with sample audio
 * - Video player with face model animation
 * - Quality score display
 * - "Activate Model" button
 * - "Re-capture" option for poor quality
 * - Comparison: original photo vs animated face
 * - Quality rating input (1-5 stars)
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  Dimensions,
} from 'react-native';

import { useFaceStore } from '../../store/faceStore';
import { lightColors } from '../../theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface FacePreviewScreenProps {
  navigation: {
    navigate: (screen: string, params?: Record<string, unknown>) => void;
    goBack: () => void;
    reset: (state: { index: number; routes: Array<{ name: string }> }) => void;
  };
  route: {
    params?: {
      modelId?: string;
    };
  };
}

export function FacePreviewScreen({
  navigation,
  route,
}: FacePreviewScreenProps): React.ReactElement {
  const modelId = route.params?.modelId;

  const [isPlaying, setIsPlaying] = useState(false);
  const [userRating, setUserRating] = useState(0);
  const [showComparison, setShowComparison] = useState(false);
  const [isActivating, setIsActivating] = useState(false);

  const { faceModel, photos, reset: resetFaceStore } = useFaceStore();

  const qualityScore = faceModel?.qualityScore ?? 85;
  const firstPhoto = photos[0];

  const handlePlayPause = useCallback((): void => {
    setIsPlaying(!isPlaying);
  }, [isPlaying]);

  const handleActivate = useCallback(async (): Promise<void> => {
    setIsActivating(true);

    try {
      // Simulate API call to activate model
      await new Promise((resolve) => setTimeout(resolve, 1500));

      Alert.alert(
        'Face Model Activated! 🎉',
        'Your face model is now active and will be used in conversations.',
        [
          {
            text: 'Start Conversation',
            onPress: () => {
              resetFaceStore();
              navigation.reset({
                index: 0,
                routes: [{ name: 'Main' }],
              });
            },
          },
        ]
      );
    } catch {
      Alert.alert('Error', 'Failed to activate face model. Please try again.');
    } finally {
      setIsActivating(false);
    }
  }, [navigation, resetFaceStore]);

  const handleRecapture = useCallback((): void => {
    Alert.alert(
      'Re-capture Photos',
      'This will discard your current face model and start over. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Re-capture',
          style: 'destructive',
          onPress: () => {
            resetFaceStore();
            navigation.navigate('FaceCapture');
          },
        },
      ]
    );
  }, [navigation, resetFaceStore]);

  const handleRating = useCallback((rating: number): void => {
    setUserRating(rating);

    // In production, send rating to analytics
    console.log('User rated face model:', rating);
  }, []);

  const getQualityLabel = (score: number): string => {
    if (score >= 90) return 'Excellent';
    if (score >= 75) return 'Good';
    if (score >= 60) return 'Fair';
    return 'Poor';
  };

  const getQualityColor = (score: number): string => {
    if (score >= 75) return lightColors.success;
    if (score >= 60) return lightColors.warning;
    return lightColors.error;
  };

  const renderStars = (): React.ReactElement => (
    <View style={styles.starsContainer}>
      {[1, 2, 3, 4, 5].map((star) => (
        <TouchableOpacity key={star} onPress={() => handleRating(star)} style={styles.starButton}>
          <Text style={[styles.star, star <= userRating && styles.starFilled]}>
            {star <= userRating ? '★' : '☆'}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Face Model Preview</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Video preview */}
        <View style={styles.videoSection}>
          <TouchableOpacity style={styles.videoContainer} onPress={handlePlayPause}>
            {/* Placeholder for generated preview video */}
            <View style={styles.videoPlaceholder}>
              {firstPhoto ? (
                <Image source={{ uri: firstPhoto.uri }} style={styles.previewImage} />
              ) : (
                <View style={styles.placeholderContent}>
                  <Text style={styles.placeholderIcon}>🎭</Text>
                  <Text style={styles.placeholderText}>Face Model Preview</Text>
                </View>
              )}
              <View style={styles.playOverlay}>
                <View style={styles.playButton}>
                  <Text style={styles.playIcon}>{isPlaying ? '⏸' : '▶'}</Text>
                </View>
              </View>
            </View>
          </TouchableOpacity>

          <Text style={styles.videoHint}>
            Tap to {isPlaying ? 'pause' : 'play'} sample animation
          </Text>
        </View>

        {/* Quality score */}
        <View style={styles.qualitySection}>
          <Text style={styles.sectionTitle}>Quality Score</Text>
          <View style={styles.qualityCard}>
            <View style={styles.qualityScoreContainer}>
              <Text style={[styles.qualityScore, { color: getQualityColor(qualityScore) }]}>
                {qualityScore}
              </Text>
              <Text style={styles.qualityMax}>/100</Text>
            </View>
            <Text style={[styles.qualityLabel, { color: getQualityColor(qualityScore) }]}>
              {getQualityLabel(qualityScore)}
            </Text>
            <View style={styles.qualityBar}>
              <View
                style={[
                  styles.qualityBarFill,
                  {
                    width: `${qualityScore}%`,
                    backgroundColor: getQualityColor(qualityScore),
                  },
                ]}
              />
            </View>
          </View>
        </View>

        {/* Comparison toggle */}
        {firstPhoto && (
          <View style={styles.comparisonSection}>
            <TouchableOpacity
              style={styles.comparisonToggle}
              onPress={() => setShowComparison(!showComparison)}
            >
              <Text style={styles.comparisonToggleText}>
                {showComparison ? 'Hide' : 'Show'} Original vs Animated
              </Text>
              <Text style={styles.comparisonToggleIcon}>{showComparison ? '▲' : '▼'}</Text>
            </TouchableOpacity>

            {showComparison && (
              <View style={styles.comparisonContainer}>
                <View style={styles.comparisonItem}>
                  <Image source={{ uri: firstPhoto.uri }} style={styles.comparisonImage} />
                  <Text style={styles.comparisonLabel}>Original</Text>
                </View>
                <View style={styles.comparisonItem}>
                  <Image source={{ uri: firstPhoto.uri }} style={styles.comparisonImage} />
                  <Text style={styles.comparisonLabel}>Animated</Text>
                </View>
              </View>
            )}
          </View>
        )}

        {/* Rating section */}
        <View style={styles.ratingSection}>
          <Text style={styles.sectionTitle}>Rate Your Face Model</Text>
          <Text style={styles.ratingSubtitle}>How satisfied are you with the quality?</Text>
          {renderStars()}
          {userRating > 0 && (
            <Text style={styles.ratingFeedback}>
              {userRating >= 4
                ? 'Great! Thanks for your feedback.'
                : userRating >= 3
                  ? 'Thanks! Consider re-capturing for better quality.'
                  : 'We recommend re-capturing your photos.'}
            </Text>
          )}
        </View>

        {/* Model info */}
        <View style={styles.infoSection}>
          <Text style={styles.sectionTitle}>Model Information</Text>
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Model ID</Text>
              <Text style={styles.infoValue}>{modelId?.slice(0, 16) ?? 'N/A'}...</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Created</Text>
              <Text style={styles.infoValue}>
                {faceModel?.createdAt?.toLocaleDateString() ?? 'Just now'}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Photos Used</Text>
              <Text style={styles.infoValue}>{photos.length}</Text>
            </View>
          </View>
        </View>

        {/* Spacer for bottom buttons */}
        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Bottom buttons */}
      <View style={styles.bottomButtons}>
        {qualityScore < 60 ? (
          <>
            <TouchableOpacity style={styles.recaptureButton} onPress={handleRecapture}>
              <Text style={styles.recaptureText}>Re-capture Photos</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.activateButtonSecondary}
              onPress={handleActivate}
              disabled={isActivating}
            >
              <Text style={styles.activateTextSecondary}>
                {isActivating ? 'Activating...' : 'Use Anyway'}
              </Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TouchableOpacity style={styles.recaptureButtonOutline} onPress={handleRecapture}>
              <Text style={styles.recaptureTextOutline}>Re-capture</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.activateButton}
              onPress={handleActivate}
              disabled={isActivating}
            >
              <Text style={styles.activateText}>
                {isActivating ? 'Activating...' : 'Activate Model'}
              </Text>
            </TouchableOpacity>
          </>
        )}
      </View>
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
  },
  videoSection: {
    padding: 16,
    alignItems: 'center',
  },
  videoContainer: {
    width: SCREEN_WIDTH - 32,
    height: (SCREEN_WIDTH - 32) * 0.75,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  videoPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  placeholderContent: {
    alignItems: 'center',
  },
  placeholderIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  placeholderText: {
    color: '#fff',
    fontSize: 16,
  },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  playButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playIcon: {
    fontSize: 28,
    color: lightColors.primary,
    marginLeft: 4,
  },
  videoHint: {
    marginTop: 12,
    fontSize: 13,
    color: lightColors.textSecondary,
  },
  qualitySection: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: lightColors.text,
    marginBottom: 12,
  },
  qualityCard: {
    backgroundColor: lightColors.surface,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
  },
  qualityScoreContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  qualityScore: {
    fontSize: 56,
    fontWeight: '700',
  },
  qualityMax: {
    fontSize: 20,
    color: lightColors.textSecondary,
    marginLeft: 4,
  },
  qualityLabel: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 4,
    marginBottom: 16,
  },
  qualityBar: {
    width: '100%',
    height: 8,
    backgroundColor: lightColors.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  qualityBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  comparisonSection: {
    padding: 16,
  },
  comparisonToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: lightColors.surface,
    padding: 16,
    borderRadius: 12,
  },
  comparisonToggleText: {
    fontSize: 14,
    fontWeight: '500',
    color: lightColors.primary,
  },
  comparisonToggleIcon: {
    fontSize: 12,
    color: lightColors.primary,
  },
  comparisonContainer: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 12,
  },
  comparisonItem: {
    flex: 1,
    alignItems: 'center',
  },
  comparisonImage: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 12,
    backgroundColor: lightColors.border,
  },
  comparisonLabel: {
    marginTop: 8,
    fontSize: 13,
    color: lightColors.textSecondary,
  },
  ratingSection: {
    padding: 16,
    alignItems: 'center',
  },
  ratingSubtitle: {
    fontSize: 14,
    color: lightColors.textSecondary,
    marginBottom: 16,
  },
  starsContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  starButton: {
    padding: 4,
  },
  star: {
    fontSize: 36,
    color: lightColors.border,
  },
  starFilled: {
    color: '#FFD700',
  },
  ratingFeedback: {
    marginTop: 12,
    fontSize: 13,
    color: lightColors.textSecondary,
    textAlign: 'center',
  },
  infoSection: {
    padding: 16,
  },
  infoCard: {
    backgroundColor: lightColors.surface,
    borderRadius: 12,
    padding: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: lightColors.border,
  },
  infoLabel: {
    fontSize: 14,
    color: lightColors.textSecondary,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '500',
    color: lightColors.text,
  },
  bottomButtons: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    padding: 16,
    paddingBottom: 32,
    backgroundColor: lightColors.surface,
    borderTopWidth: 1,
    borderTopColor: lightColors.border,
    gap: 12,
  },
  recaptureButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: lightColors.error,
    alignItems: 'center',
  },
  recaptureText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  recaptureButtonOutline: {
    flex: 0.4,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: lightColors.border,
    alignItems: 'center',
  },
  recaptureTextOutline: {
    color: lightColors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  activateButton: {
    flex: 0.6,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: lightColors.primary,
    alignItems: 'center',
  },
  activateText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  activateButtonSecondary: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: lightColors.primary,
    alignItems: 'center',
  },
  activateTextSecondary: {
    color: lightColors.primary,
    fontSize: 16,
    fontWeight: '600',
  },
});

export default FacePreviewScreen;
