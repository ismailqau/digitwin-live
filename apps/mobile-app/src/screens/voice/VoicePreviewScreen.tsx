/**
 * VoicePreviewScreen
 *
 * Screen wrapper for voice model preview and comparison.
 * Implements Task 13.3.6:
 * - Custom text input for preview
 * - Generate preview button
 * - Side-by-side comparison (original vs cloned)
 * - Quality rating input (1-5 stars)
 * - Activate model button
 * - Re-train option
 * - Voice similarity score display
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
  TextInput,
  Alert,
  SafeAreaView,
} from 'react-native';

import { VoiceModelPreview } from '../../components/VoiceModelPreview';

type NavigationProp = NativeStackNavigationProp<Record<string, object | undefined>>;
type RouteParams = RouteProp<{ params: { modelId: string } }, 'params'>;

const DEFAULT_PREVIEW_TEXT =
  'Hello, this is a preview of my voice model. How does it sound to you?';

export const VoicePreviewScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteParams>();

  const modelId = route.params?.modelId; // Used for API calls and navigation
  const [customText, setCustomText] = useState(DEFAULT_PREVIEW_TEXT);
  const [rating, setRating] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [similarityScore] = useState(87); // Mock score - will be fetched from API

  const handleGeneratePreview = async () => {
    if (!customText.trim()) {
      Alert.alert('Error', 'Please enter some text to generate a preview');
      return;
    }

    try {
      setIsGenerating(true);

      // In real implementation, this would call the TTS service
      // to generate audio with the voice model
      await new Promise((resolve) => setTimeout(resolve, 2000));

      Alert.alert(
        'Preview Generated',
        'Your voice preview has been generated. Tap the play button to listen.',
        [{ text: 'OK' }]
      );
    } catch {
      Alert.alert('Error', 'Failed to generate preview');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRating = (stars: number) => {
    setRating(stars);
  };

  const handleActivateModel = () => {
    Alert.alert(
      'Activate Voice Model',
      'This will set this voice model as your active voice. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Activate',
          onPress: async () => {
            // In real implementation, call API to activate model
            // await activateVoiceModel(modelId);
            console.log('Activating voice model:', modelId);
            Alert.alert('Success', 'Voice model activated successfully!', [
              {
                text: 'OK',
                onPress: () => navigation.navigate('Main'),
              },
            ]);
          },
        },
      ]
    );
  };

  const handleRetrain = () => {
    Alert.alert(
      'Re-train Voice Model',
      'This will create a new voice model with new recordings. Your current model will be kept. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Re-train',
          onPress: () => navigation.navigate('VoiceRecording'),
        },
      ]
    );
  };

  const handleClose = () => {
    navigation.navigate('Main');
  };

  const getSimilarityColor = (score: number): string => {
    if (score >= 85) return '#4CAF50'; // Green
    if (score >= 70) return '#FF9800'; // Orange
    return '#F44336'; // Red
  };

  const getSimilarityLabel = (score: number): string => {
    if (score >= 90) return 'Excellent';
    if (score >= 80) return 'Very Good';
    if (score >= 70) return 'Good';
    if (score >= 60) return 'Fair';
    return 'Poor';
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.contentContainer}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Voice Model Preview</Text>
          <Text style={styles.subtitle}>Test your voice model and provide feedback</Text>
        </View>

        {/* Similarity Score Card */}
        <View style={styles.similarityCard}>
          <Text style={styles.similarityTitle}>Voice Similarity Score</Text>
          <View style={styles.similarityContent}>
            <Text style={[styles.similarityScore, { color: getSimilarityColor(similarityScore) }]}>
              {similarityScore}%
            </Text>
            <Text style={[styles.similarityLabel, { color: getSimilarityColor(similarityScore) }]}>
              {getSimilarityLabel(similarityScore)}
            </Text>
          </View>
          <Text style={styles.similarityDescription}>
            This score indicates how closely the cloned voice matches your original voice
          </Text>
        </View>

        {/* Custom Text Input */}
        <View style={styles.textInputCard}>
          <Text style={styles.textInputTitle}>Custom Preview Text</Text>
          <TextInput
            style={styles.textInput}
            value={customText}
            onChangeText={setCustomText}
            placeholder="Enter text to preview your voice..."
            multiline
            numberOfLines={4}
            maxLength={500}
          />
          <Text style={styles.characterCount}>{customText.length} / 500</Text>
          <TouchableOpacity
            style={[styles.generateButton, isGenerating && styles.generateButtonDisabled]}
            onPress={handleGeneratePreview}
            disabled={isGenerating}
          >
            <Text style={styles.generateButtonText}>
              {isGenerating ? 'Generating...' : '🎤 Generate Preview'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Voice Model Preview Component */}
        <View style={styles.previewContainer}>
          <VoiceModelPreview onClose={handleClose} />
        </View>

        {/* Rating Section */}
        <View style={styles.ratingCard}>
          <Text style={styles.ratingTitle}>Rate Voice Quality</Text>
          <Text style={styles.ratingSubtitle}>How natural does the voice sound?</Text>
          <View style={styles.starsContainer}>
            {[1, 2, 3, 4, 5].map((star) => (
              <TouchableOpacity
                key={star}
                style={styles.starButton}
                onPress={() => handleRating(star)}
              >
                <Text style={[styles.starText, rating >= star && styles.starTextFilled]}>
                  {rating >= star ? '★' : '☆'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {rating > 0 && (
            <Text style={styles.ratingFeedback}>
              {rating === 5 && 'Excellent! Your voice model sounds great!'}
              {rating === 4 && 'Very good! Minor improvements possible.'}
              {rating === 3 && 'Good, but could be better with more samples.'}
              {rating === 2 && 'Fair. Consider re-recording with better quality.'}
              {rating === 1 && 'Poor. We recommend re-training with clearer recordings.'}
            </Text>
          )}
        </View>

        {/* Action Buttons */}
        <View style={styles.actionContainer}>
          <TouchableOpacity style={styles.activateButton} onPress={handleActivateModel}>
            <Text style={styles.activateButtonText}>✓ Activate Voice Model</Text>
          </TouchableOpacity>

          {rating > 0 && rating < 3 && (
            <TouchableOpacity style={styles.retrainButton} onPress={handleRetrain}>
              <Text style={styles.retrainButtonText}>🔄 Re-train Voice Model</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
            <Text style={styles.closeButtonText}>Close</Text>
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
  similarityCard: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    alignItems: 'center',
  },
  similarityTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  similarityContent: {
    alignItems: 'center',
    marginBottom: 10,
  },
  similarityScore: {
    fontSize: 48,
    fontWeight: 'bold',
  },
  similarityLabel: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 5,
  },
  similarityDescription: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 10,
  },
  textInputCard: {
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
  textInputTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  textInput: {
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 8,
    fontSize: 14,
    color: '#333',
    minHeight: 100,
    textAlignVertical: 'top',
  },
  characterCount: {
    fontSize: 12,
    color: '#666',
    textAlign: 'right',
    marginTop: 5,
    marginBottom: 15,
  },
  generateButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  generateButtonDisabled: {
    backgroundColor: '#ccc',
  },
  generateButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  previewContainer: {
    marginBottom: 20,
  },
  ratingCard: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    alignItems: 'center',
  },
  ratingTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  ratingSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 15,
  },
  starsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 15,
  },
  starButton: {
    padding: 5,
  },
  starText: {
    fontSize: 40,
    color: '#e0e0e0',
  },
  starTextFilled: {
    color: '#FFD700',
  },
  ratingFeedback: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  actionContainer: {
    marginTop: 20,
  },
  activateButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  activateButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  retrainButton: {
    backgroundColor: '#FF9800',
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  retrainButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  closeButton: {
    backgroundColor: '#666',
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default VoicePreviewScreen;
