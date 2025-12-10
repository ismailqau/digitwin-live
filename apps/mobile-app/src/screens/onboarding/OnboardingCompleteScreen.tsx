/**
 * Onboarding Complete Screen
 *
 * Final screen showing success and setup summary
 * Provides tips for first conversation and navigation to main app
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Animated } from 'react-native';

import OnboardingProgressIndicator from '../../components/OnboardingProgressIndicator';
import { useAuthStore } from '../../store/authStore';
import { lightTheme } from '../../theme';
import type { OnboardingScreenProps } from '../../types/navigation';

interface Tip {
  id: string;
  icon: string;
  title: string;
  description: string;
}

const FIRST_CONVERSATION_TIPS: Tip[] = [
  {
    id: '1',
    icon: '💬',
    title: 'Start with a Question',
    description: 'Ask your clone something from your knowledge base',
  },
  {
    id: '2',
    icon: '🎤',
    title: 'Speak Clearly',
    description: 'Use natural speech for better recognition',
  },
  {
    id: '3',
    icon: '⏸️',
    title: 'Pause Between Sentences',
    description: 'Give the system time to process your input',
  },
  {
    id: '4',
    icon: '🔄',
    title: 'Interrupt Anytime',
    description: 'You can interrupt your clone at any time',
  },
];

export default function OnboardingCompleteScreen(
  _props: OnboardingScreenProps<'OnboardingComplete'>
): React.ReactElement {
  const { setOnboarded } = useAuthStore();
  const scaleAnim = React.useRef(new Animated.Value(0)).current;
  const opacityAnim = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Animate success icon
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 50,
        friction: 7,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();
  }, [scaleAnim, opacityAnim]);

  const handleStartConversation = async () => {
    try {
      // Mark onboarding as complete
      await AsyncStorage.setItem('onboarding_complete', 'true');
      await AsyncStorage.setItem('onboarding_progress', '6');

      // Update auth store
      setOnboarded(true);

      // Navigation will automatically go to main app
    } catch (error) {
      console.error('Error completing onboarding:', error);
      // Still proceed even if storage fails
      setOnboarded(true);
    }
  };

  return (
    <View style={styles.container}>
      {/* Progress Indicator */}
      <OnboardingProgressIndicator
        currentStep={5}
        totalSteps={5}
        stepLabels={['Welcome', 'Personality', 'Voice', 'Face', 'Complete']}
      />

      {/* Header with Success Animation */}
      <View style={styles.header}>
        <Animated.View
          style={[
            styles.successIcon,
            {
              transform: [{ scale: scaleAnim }],
              opacity: opacityAnim,
            },
          ]}
        >
          <Text style={styles.successIconText}>✓</Text>
        </Animated.View>
        <Text style={styles.title}>All Set!</Text>
        <Text style={styles.subtitle}>Your digital twin is ready to chat</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Setup Summary */}
        <View style={styles.summaryBox}>
          <Text style={styles.summaryTitle}>Setup Summary</Text>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryCheckmark}>✓</Text>
            <View style={styles.summaryItemContent}>
              <Text style={styles.summaryItemTitle}>Personality Configured</Text>
              <Text style={styles.summaryItemDescription}>
                Your clone has your personality traits
              </Text>
            </View>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryCheckmark}>✓</Text>
            <View style={styles.summaryItemContent}>
              <Text style={styles.summaryItemTitle}>Voice Ready</Text>
              <Text style={styles.summaryItemDescription}>Voice model is being trained</Text>
            </View>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryCheckmark}>✓</Text>
            <View style={styles.summaryItemContent}>
              <Text style={styles.summaryItemTitle}>Face Model</Text>
              <Text style={styles.summaryItemDescription}>Face model is being processed</Text>
            </View>
          </View>
        </View>

        {/* First Conversation Tips */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tips for Your First Conversation</Text>
          {FIRST_CONVERSATION_TIPS.map((tip) => (
            <View key={tip.id} style={styles.tipItem}>
              <Text style={styles.tipIcon}>{tip.icon}</Text>
              <View style={styles.tipContent}>
                <Text style={styles.tipTitle}>{tip.title}</Text>
                <Text style={styles.tipDescription}>{tip.description}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Next Steps */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>What's Next?</Text>
          <View style={styles.nextStepItem}>
            <Text style={styles.nextStepNumber}>1</Text>
            <View style={styles.nextStepContent}>
              <Text style={styles.nextStepTitle}>Start Conversation</Text>
              <Text style={styles.nextStepDescription}>Begin chatting with your digital twin</Text>
            </View>
          </View>
          <View style={styles.nextStepItem}>
            <Text style={styles.nextStepNumber}>2</Text>
            <View style={styles.nextStepContent}>
              <Text style={styles.nextStepTitle}>Upload Knowledge</Text>
              <Text style={styles.nextStepDescription}>
                Add documents for personalized responses
              </Text>
            </View>
          </View>
          <View style={styles.nextStepItem}>
            <Text style={styles.nextStepNumber}>3</Text>
            <View style={styles.nextStepContent}>
              <Text style={styles.nextStepTitle}>Customize Settings</Text>
              <Text style={styles.nextStepDescription}>Fine-tune your clone's behavior</Text>
            </View>
          </View>
        </View>

        {/* Info Box */}
        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>Background Processing</Text>
          <Text style={styles.infoDescription}>
            Your voice and face models are being trained in the background. You'll receive
            notifications when they're ready to use.
          </Text>
        </View>
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.button, styles.primaryButton]}
          onPress={handleStartConversation}
        >
          <Text style={styles.primaryButtonText}>Start Conversation</Text>
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
    alignItems: 'center',
    paddingTop: lightTheme.spacing.xl,
    paddingBottom: lightTheme.spacing.lg,
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: lightTheme.colors.success,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: lightTheme.spacing.lg,
  },
  successIconText: {
    fontSize: 40,
    color: lightTheme.colors.onSuccess,
    fontWeight: lightTheme.fontWeight.bold,
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
    textAlign: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: lightTheme.spacing.lg,
  },
  summaryBox: {
    backgroundColor: lightTheme.colors.surfaceVariant,
    borderRadius: lightTheme.borderRadius.lg,
    padding: lightTheme.spacing.lg,
    marginBottom: lightTheme.spacing.lg,
  },
  summaryTitle: {
    fontSize: lightTheme.fontSize.lg,
    fontWeight: lightTheme.fontWeight.semibold,
    color: lightTheme.colors.text,
    marginBottom: lightTheme.spacing.md,
  },
  summaryItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: lightTheme.spacing.md,
    gap: lightTheme.spacing.md,
  },
  summaryCheckmark: {
    fontSize: lightTheme.fontSize.lg,
    color: lightTheme.colors.success,
    fontWeight: lightTheme.fontWeight.bold,
    marginTop: 2,
  },
  summaryItemContent: {
    flex: 1,
  },
  summaryItemTitle: {
    fontSize: lightTheme.fontSize.md,
    fontWeight: lightTheme.fontWeight.semibold,
    color: lightTheme.colors.text,
    marginBottom: lightTheme.spacing.xs,
  },
  summaryItemDescription: {
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
  nextStepItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: lightTheme.spacing.md,
    gap: lightTheme.spacing.md,
  },
  nextStepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: lightTheme.colors.primary,
    color: lightTheme.colors.onPrimary,
    fontSize: lightTheme.fontSize.md,
    fontWeight: lightTheme.fontWeight.bold,
    textAlign: 'center',
    lineHeight: 32,
  },
  nextStepContent: {
    flex: 1,
    paddingTop: 2,
  },
  nextStepTitle: {
    fontSize: lightTheme.fontSize.md,
    fontWeight: lightTheme.fontWeight.semibold,
    color: lightTheme.colors.text,
    marginBottom: lightTheme.spacing.xs,
  },
  nextStepDescription: {
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
  infoTitle: {
    fontSize: lightTheme.fontSize.md,
    fontWeight: lightTheme.fontWeight.semibold,
    color: lightTheme.colors.text,
    marginBottom: lightTheme.spacing.sm,
  },
  infoDescription: {
    fontSize: lightTheme.fontSize.sm,
    color: lightTheme.colors.textSecondary,
    lineHeight: lightTheme.lineHeight.sm,
  },
  footer: {
    paddingHorizontal: lightTheme.spacing.lg,
    paddingBottom: lightTheme.spacing.xl,
  },
  button: {
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
});
