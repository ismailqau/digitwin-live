/**
 * Personality Setup Screen
 *
 * Allows users to define their clone's personality traits and speaking style
 * Includes preview of how the clone will respond
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';

import OnboardingProgressIndicator from '../../components/OnboardingProgressIndicator';
import { lightTheme } from '../../theme';
import type { OnboardingScreenProps } from '../../types/navigation';

const PERSONALITY_TRAITS = [
  'Friendly',
  'Professional',
  'Humorous',
  'Empathetic',
  'Analytical',
  'Creative',
  'Confident',
  'Thoughtful',
];

const SPEAKING_STYLES = [
  { id: 'formal', label: 'Formal', example: 'Good morning. How may I assist you?' },
  { id: 'casual', label: 'Casual', example: 'Hey! What can I help you with?' },
  { id: 'friendly', label: 'Friendly', example: 'Hi there! Happy to help!' },
  { id: 'professional', label: 'Professional', example: "Hello. I'm here to help." },
];

export default function PersonalitySetupScreen({
  navigation,
}: OnboardingScreenProps<'PersonalitySetup'>): React.ReactElement {
  const [selectedTraits, setSelectedTraits] = useState<string[]>([]);
  const [selectedStyle, setSelectedStyle] = useState<string>('friendly');
  const [customDescription, setCustomDescription] = useState('');

  const toggleTrait = (trait: string) => {
    setSelectedTraits((prev) =>
      prev.includes(trait) ? prev.filter((t) => t !== trait) : [...prev, trait]
    );
  };

  const handleContinue = async () => {
    if (selectedTraits.length === 0) {
      Alert.alert('Select Traits', 'Please select at least one personality trait.');
      return;
    }

    try {
      // Save personality settings to AsyncStorage
      const personalityData = {
        personalityTraits: selectedTraits,
        speakingStyle: selectedStyle,
        customDescription,
      };
      await AsyncStorage.setItem('onboarding_personality', JSON.stringify(personalityData));
      await AsyncStorage.setItem('onboarding_progress', '3');

      // TODO: Save personality to user profile via API when backend is ready
      // const response = await api.updateUserProfile(personalityData);

      navigation.navigate('VoiceSetupPrompt');
    } catch (error) {
      Alert.alert('Error', 'Failed to save personality settings. Please try again.');
      console.error('Error saving personality:', error);
    }
  };

  const handleSkip = () => {
    navigation.navigate('VoiceSetupPrompt');
  };

  const selectedStyleData = SPEAKING_STYLES.find((s) => s.id === selectedStyle);

  return (
    <View style={styles.container}>
      {/* Progress Indicator */}
      <OnboardingProgressIndicator
        currentStep={2}
        totalSteps={5}
        stepLabels={['Welcome', 'Personality', 'Voice', 'Face', 'Complete']}
      />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Personality Setup</Text>
        <Text style={styles.subtitle}>Define how your clone will interact with others</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Personality Traits Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Personality Traits</Text>
          <Text style={styles.sectionDescription}>
            Select traits that describe your personality
          </Text>
          <View style={styles.traitsGrid}>
            {PERSONALITY_TRAITS.map((trait) => (
              <TouchableOpacity
                key={trait}
                style={[
                  styles.traitChip,
                  selectedTraits.includes(trait) && styles.traitChipSelected,
                ]}
                onPress={() => toggleTrait(trait)}
              >
                <Text
                  style={[
                    styles.traitChipText,
                    selectedTraits.includes(trait) && styles.traitChipTextSelected,
                  ]}
                >
                  {trait}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Speaking Style Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Speaking Style</Text>
          <Text style={styles.sectionDescription}>Choose how your clone will communicate</Text>
          {SPEAKING_STYLES.map((style) => (
            <TouchableOpacity
              key={style.id}
              style={[styles.styleOption, selectedStyle === style.id && styles.styleOptionSelected]}
              onPress={() => setSelectedStyle(style.id)}
            >
              <View style={styles.styleOptionContent}>
                <Text style={styles.styleOptionLabel}>{style.label}</Text>
                <Text style={styles.styleOptionExample}>{style.example}</Text>
              </View>
              <View
                style={[
                  styles.radioButton,
                  selectedStyle === style.id && styles.radioButtonSelected,
                ]}
              >
                {selectedStyle === style.id && <View style={styles.radioButtonInner} />}
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Custom Description Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Custom Description</Text>
          <Text style={styles.sectionDescription}>
            Add any additional personality details (optional)
          </Text>
          <TextInput
            style={styles.textInput}
            placeholder="E.g., I like to use humor in conversations..."
            placeholderTextColor={lightTheme.colors.textSecondary}
            value={customDescription}
            onChangeText={setCustomDescription}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        {/* Preview Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preview</Text>
          <View style={styles.previewBox}>
            <Text style={styles.previewLabel}>How your clone might respond:</Text>
            <Text style={styles.previewText}>
              {selectedStyleData?.example || 'Select a speaking style to see preview'}
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity style={[styles.button, styles.secondaryButton]} onPress={handleSkip}>
          <Text style={styles.secondaryButtonText}>Skip for Now</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.button, styles.primaryButton]} onPress={handleContinue}>
          <Text style={styles.primaryButtonText}>Continue</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: lightTheme.colors.background,
  },
  header: {
    paddingHorizontal: lightTheme.spacing.lg,
    paddingTop: lightTheme.spacing.xl,
    paddingBottom: lightTheme.spacing.lg,
  },
  title: {
    fontSize: lightTheme.fontSize.xl,
    fontWeight: lightTheme.fontWeight.bold,
    color: lightTheme.colors.text,
    marginBottom: lightTheme.spacing.sm,
  },
  subtitle: {
    fontSize: lightTheme.fontSize.md,
    color: lightTheme.colors.textSecondary,
    lineHeight: lightTheme.lineHeight.md,
  },
  content: {
    flex: 1,
    paddingHorizontal: lightTheme.spacing.lg,
  },
  section: {
    marginBottom: lightTheme.spacing.xl,
  },
  sectionTitle: {
    fontSize: lightTheme.fontSize.lg,
    fontWeight: lightTheme.fontWeight.semibold,
    color: lightTheme.colors.text,
    marginBottom: lightTheme.spacing.xs,
  },
  sectionDescription: {
    fontSize: lightTheme.fontSize.sm,
    color: lightTheme.colors.textSecondary,
    marginBottom: lightTheme.spacing.md,
  },
  traitsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: lightTheme.spacing.sm,
  },
  traitChip: {
    paddingHorizontal: lightTheme.spacing.md,
    paddingVertical: lightTheme.spacing.sm,
    borderRadius: lightTheme.borderRadius.lg,
    backgroundColor: lightTheme.colors.surface,
    borderWidth: 1,
    borderColor: lightTheme.colors.outline,
  },
  traitChipSelected: {
    backgroundColor: lightTheme.colors.primary,
    borderColor: lightTheme.colors.primary,
  },
  traitChipText: {
    fontSize: lightTheme.fontSize.sm,
    fontWeight: lightTheme.fontWeight.medium,
    color: lightTheme.colors.text,
  },
  traitChipTextSelected: {
    color: lightTheme.colors.onPrimary,
  },
  styleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: lightTheme.colors.surface,
    borderRadius: lightTheme.borderRadius.md,
    padding: lightTheme.spacing.md,
    marginBottom: lightTheme.spacing.md,
    borderWidth: 1,
    borderColor: lightTheme.colors.outline,
  },
  styleOptionSelected: {
    borderColor: lightTheme.colors.primary,
    backgroundColor: lightTheme.colors.surfaceVariant,
  },
  styleOptionContent: {
    flex: 1,
  },
  styleOptionLabel: {
    fontSize: lightTheme.fontSize.md,
    fontWeight: lightTheme.fontWeight.semibold,
    color: lightTheme.colors.text,
    marginBottom: lightTheme.spacing.xs,
  },
  styleOptionExample: {
    fontSize: lightTheme.fontSize.sm,
    color: lightTheme.colors.textSecondary,
    fontStyle: 'italic',
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: lightTheme.colors.outline,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioButtonSelected: {
    borderColor: lightTheme.colors.primary,
  },
  radioButtonInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: lightTheme.colors.primary,
  },
  textInput: {
    backgroundColor: lightTheme.colors.surface,
    borderRadius: lightTheme.borderRadius.md,
    borderWidth: 1,
    borderColor: lightTheme.colors.outline,
    paddingHorizontal: lightTheme.spacing.md,
    paddingVertical: lightTheme.spacing.md,
    fontSize: lightTheme.fontSize.md,
    color: lightTheme.colors.text,
    minHeight: 100,
  },
  previewBox: {
    backgroundColor: lightTheme.colors.surfaceVariant,
    borderRadius: lightTheme.borderRadius.md,
    padding: lightTheme.spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: lightTheme.colors.primary,
  },
  previewLabel: {
    fontSize: lightTheme.fontSize.sm,
    color: lightTheme.colors.textSecondary,
    marginBottom: lightTheme.spacing.sm,
  },
  previewText: {
    fontSize: lightTheme.fontSize.md,
    color: lightTheme.colors.text,
    fontStyle: 'italic',
    lineHeight: lightTheme.lineHeight.md,
  },
  footer: {
    flexDirection: 'row',
    paddingHorizontal: lightTheme.spacing.lg,
    paddingBottom: lightTheme.spacing.xl,
    gap: lightTheme.spacing.md,
  },
  button: {
    flex: 1,
    paddingVertical: lightTheme.spacing.md,
    borderRadius: lightTheme.borderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: lightTheme.colors.primary,
  },
  primaryButtonText: {
    fontSize: lightTheme.fontSize.md,
    fontWeight: lightTheme.fontWeight.semibold,
    color: lightTheme.colors.onPrimary,
  },
  secondaryButton: {
    backgroundColor: lightTheme.colors.surface,
    borderWidth: 1,
    borderColor: lightTheme.colors.outline,
  },
  secondaryButtonText: {
    fontSize: lightTheme.fontSize.md,
    fontWeight: lightTheme.fontWeight.semibold,
    color: lightTheme.colors.text,
  },
});
