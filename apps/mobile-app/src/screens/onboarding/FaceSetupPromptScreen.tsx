/**
 * Face Setup Prompt Screen
 *
 * Explains face cloning feature and guides user to capture face photos/video
 * Shows requirements and capture tips
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';

import { lightTheme } from '../../theme';
import type { OnboardingScreenProps } from '../../types/navigation';

interface Requirement {
  id: string;
  icon: string;
  title: string;
  description: string;
}

const FACE_REQUIREMENTS: Requirement[] = [
  {
    id: '1',
    icon: '📸',
    title: '3-10 Photos or 30-60 Second Video',
    description: 'Capture your face from different angles',
  },
  {
    id: '2',
    icon: '💡',
    title: 'Good Lighting',
    description: 'Natural or well-lit environment for best results',
  },
  {
    id: '3',
    icon: '👤',
    title: 'Clear Face View',
    description: 'Face should be clearly visible and in focus',
  },
  {
    id: '4',
    icon: '🎬',
    title: 'Multiple Angles',
    description: 'Include frontal and slight profile views',
  },
];

const CAPTURE_TIPS: Requirement[] = [
  {
    id: '1',
    icon: '✓',
    title: 'Face Frontal',
    description: 'Look directly at the camera',
  },
  {
    id: '2',
    icon: '✓',
    title: 'Neutral Expression',
    description: 'Start with a neutral or natural expression',
  },
  {
    id: '3',
    icon: '✓',
    title: 'Consistent Lighting',
    description: 'Avoid harsh shadows on your face',
  },
  {
    id: '4',
    icon: '✓',
    title: 'Clean Background',
    description: 'Use a simple, uncluttered background',
  },
];

export default function FaceSetupPromptScreen({
  navigation,
}: OnboardingScreenProps<'FaceSetupPrompt'>): React.ReactElement {
  const handleSetUpNow = () => {
    navigation.navigate('FaceCapture');
  };

  const handleSetUpLater = () => {
    navigation.navigate('OnboardingComplete');
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Face Cloning</Text>
        <Text style={styles.subtitle}>Create a video clone with synchronized lip-sync</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Feature Highlight */}
        <View style={styles.featureBox}>
          <Text style={styles.featureIcon}>😊</Text>
          <Text style={styles.featureTitle}>Your Digital Face</Text>
          <Text style={styles.featureDescription}>
            Your clone will have your face with synchronized lip movements, creating a truly
            personalized video experience.
          </Text>
        </View>

        {/* Requirements */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>What You'll Need</Text>
          {FACE_REQUIREMENTS.map((req) => (
            <View key={req.id} style={styles.requirementItem}>
              <Text style={styles.requirementIcon}>{req.icon}</Text>
              <View style={styles.requirementContent}>
                <Text style={styles.requirementTitle}>{req.title}</Text>
                <Text style={styles.requirementDescription}>{req.description}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Capture Tips */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Capture Tips</Text>
          {CAPTURE_TIPS.map((tip) => (
            <View key={tip.id} style={styles.tipItem}>
              <Text style={styles.tipIcon}>{tip.icon}</Text>
              <View style={styles.tipContent}>
                <Text style={styles.tipTitle}>{tip.title}</Text>
                <Text style={styles.tipDescription}>{tip.description}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Quality Info */}
        <View style={styles.infoBox}>
          <Text style={styles.infoLabel}>Processing Time</Text>
          <Text style={styles.infoValue}>15-30 minutes</Text>
          <Text style={styles.infoDescription}>Face model creation and validation</Text>
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
          <Text style={styles.primaryButtonText}>Set Up Face Now</Text>
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
  section: {
    marginBottom: lightTheme.spacing.xl,
  },
  sectionTitle: {
    fontSize: lightTheme.fontSize.lg,
    fontWeight: lightTheme.fontWeight.semibold,
    color: lightTheme.colors.text,
    marginBottom: lightTheme.spacing.md,
  },
  requirementItem: {
    flexDirection: 'row',
    backgroundColor: lightTheme.colors.surface,
    borderRadius: lightTheme.borderRadius.md,
    padding: lightTheme.spacing.md,
    marginBottom: lightTheme.spacing.md,
    alignItems: 'flex-start',
    gap: lightTheme.spacing.md,
  },
  requirementIcon: {
    fontSize: 24,
    marginTop: 2,
  },
  requirementContent: {
    flex: 1,
  },
  requirementTitle: {
    fontSize: lightTheme.fontSize.md,
    fontWeight: lightTheme.fontWeight.semibold,
    color: lightTheme.colors.text,
    marginBottom: lightTheme.spacing.xs,
  },
  requirementDescription: {
    fontSize: lightTheme.fontSize.sm,
    color: lightTheme.colors.textSecondary,
    lineHeight: lightTheme.lineHeight.sm,
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: lightTheme.spacing.md,
    gap: lightTheme.spacing.md,
  },
  tipIcon: {
    fontSize: lightTheme.fontSize.lg,
    color: lightTheme.colors.success,
    fontWeight: lightTheme.fontWeight.bold,
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
