/**
 * Voice Setup Prompt Screen
 *
 * Explains voice cloning feature and guides user to record voice samples
 * Shows estimated time and quality tips
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';

import { lightTheme } from '../../theme';
import type { OnboardingScreenProps } from '../../types/navigation';

interface Tip {
  id: string;
  icon: string;
  title: string;
  description: string;
}

const VOICE_QUALITY_TIPS: Tip[] = [
  {
    id: '1',
    icon: '🎤',
    title: 'Use a Quiet Environment',
    description: 'Record in a quiet room to minimize background noise',
  },
  {
    id: '2',
    icon: '📏',
    title: 'Maintain Distance',
    description: 'Keep microphone 6-12 inches from your mouth',
  },
  {
    id: '3',
    icon: '🗣️',
    title: 'Speak Naturally',
    description: 'Use your normal speaking voice and pace',
  },
  {
    id: '4',
    icon: '⏱️',
    title: 'Record Enough Samples',
    description: 'Aim for 5-10 minutes of clear speech',
  },
];

export default function VoiceSetupPromptScreen({
  navigation,
}: OnboardingScreenProps<'VoiceSetupPrompt'>): React.ReactElement {
  const handleSetUpNow = () => {
    navigation.navigate('VoiceRecording');
  };

  const handleSetUpLater = () => {
    navigation.navigate('FaceSetupPrompt');
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Voice Cloning</Text>
        <Text style={styles.subtitle}>Create a voice model that sounds like you</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Feature Highlight */}
        <View style={styles.featureBox}>
          <Text style={styles.featureIcon}>🎤</Text>
          <Text style={styles.featureTitle}>Your Unique Voice</Text>
          <Text style={styles.featureDescription}>
            Your clone will respond using your own voice, making conversations feel more personal
            and authentic.
          </Text>
        </View>

        {/* Time Estimate */}
        <View style={styles.infoBox}>
          <Text style={styles.infoLabel}>Estimated Time</Text>
          <Text style={styles.infoValue}>5-10 minutes</Text>
          <Text style={styles.infoDescription}>Recording + processing time</Text>
        </View>

        {/* Quality Tips */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Voice Quality Tips</Text>
          {VOICE_QUALITY_TIPS.map((tip) => (
            <View key={tip.id} style={styles.tipItem}>
              <Text style={styles.tipIcon}>{tip.icon}</Text>
              <View style={styles.tipContent}>
                <Text style={styles.tipTitle}>{tip.title}</Text>
                <Text style={styles.tipDescription}>{tip.description}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Benefits */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Benefits</Text>
          <View style={styles.benefitItem}>
            <Text style={styles.benefitCheckmark}>✓</Text>
            <Text style={styles.benefitText}>Personalized responses in your voice</Text>
          </View>
          <View style={styles.benefitItem}>
            <Text style={styles.benefitCheckmark}>✓</Text>
            <Text style={styles.benefitText}>More authentic and engaging conversations</Text>
          </View>
          <View style={styles.benefitItem}>
            <Text style={styles.benefitCheckmark}>✓</Text>
            <Text style={styles.benefitText}>Unique digital twin experience</Text>
          </View>
        </View>
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.button, styles.secondaryButton]}
          onPress={handleSetUpLater}
        >
          <Text style={styles.secondaryButtonText}>Set Up Later</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.button, styles.primaryButton]} onPress={handleSetUpNow}>
          <Text style={styles.primaryButtonText}>Set Up Voice Now</Text>
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
  featureBox: {
    backgroundColor: lightTheme.colors.surfaceVariant,
    borderRadius: lightTheme.borderRadius.lg,
    padding: lightTheme.spacing.lg,
    alignItems: 'center',
    marginBottom: lightTheme.spacing.lg,
  },
  featureIcon: {
    fontSize: 48,
    marginBottom: lightTheme.spacing.md,
  },
  featureTitle: {
    fontSize: lightTheme.fontSize.lg,
    fontWeight: lightTheme.fontWeight.semibold,
    color: lightTheme.colors.text,
    marginBottom: lightTheme.spacing.sm,
    textAlign: 'center',
  },
  featureDescription: {
    fontSize: lightTheme.fontSize.md,
    color: lightTheme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: lightTheme.lineHeight.md,
  },
  infoBox: {
    backgroundColor: lightTheme.colors.surface,
    borderRadius: lightTheme.borderRadius.md,
    padding: lightTheme.spacing.lg,
    marginBottom: lightTheme.spacing.lg,
    borderLeftWidth: 4,
    borderLeftColor: lightTheme.colors.primary,
  },
  infoLabel: {
    fontSize: lightTheme.fontSize.sm,
    color: lightTheme.colors.textSecondary,
    marginBottom: lightTheme.spacing.xs,
  },
  infoValue: {
    fontSize: lightTheme.fontSize.lg,
    fontWeight: lightTheme.fontWeight.bold,
    color: lightTheme.colors.primary,
    marginBottom: lightTheme.spacing.xs,
  },
  infoDescription: {
    fontSize: lightTheme.fontSize.sm,
    color: lightTheme.colors.textSecondary,
  },
  section: {
    marginBottom: lightTheme.spacing.xl,
  },
  sectionTitle: {
    fontSize: lightTheme.fontSize.lg,
    fontWeight: lightTheme.fontWeight.semibold,
    color: lightTheme.colors.text,
    marginBottom: lightTheme.spacing.md,
  },
  tipItem: {
    flexDirection: 'row',
    backgroundColor: lightTheme.colors.surface,
    borderRadius: lightTheme.borderRadius.md,
    padding: lightTheme.spacing.md,
    marginBottom: lightTheme.spacing.md,
    alignItems: 'flex-start',
    gap: lightTheme.spacing.md,
  },
  tipIcon: {
    fontSize: 24,
    marginTop: 2,
  },
  tipContent: {
    flex: 1,
  },
  tipTitle: {
    fontSize: lightTheme.fontSize.md,
    fontWeight: lightTheme.fontWeight.semibold,
    color: lightTheme.colors.text,
    marginBottom: lightTheme.spacing.xs,
  },
  tipDescription: {
    fontSize: lightTheme.fontSize.sm,
    color: lightTheme.colors.textSecondary,
    lineHeight: lightTheme.lineHeight.sm,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: lightTheme.spacing.md,
    gap: lightTheme.spacing.md,
  },
  benefitCheckmark: {
    fontSize: lightTheme.fontSize.lg,
    color: lightTheme.colors.success,
    fontWeight: lightTheme.fontWeight.bold,
  },
  benefitText: {
    fontSize: lightTheme.fontSize.md,
    color: lightTheme.colors.text,
    flex: 1,
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
