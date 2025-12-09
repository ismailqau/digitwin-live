/**
 * Onboarding Progress Indicator Component
 *
 * Shows current step in onboarding flow with visual progress
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

import { lightTheme } from '../theme';

interface OnboardingProgressIndicatorProps {
  currentStep: number;
  totalSteps: number;
  stepLabels?: string[];
}

export default function OnboardingProgressIndicator({
  currentStep,
  totalSteps,
  stepLabels,
}: OnboardingProgressIndicatorProps): React.ReactElement {
  const progressPercentage = (currentStep / totalSteps) * 100;

  return (
    <View style={styles.container}>
      {/* Progress Bar */}
      <View style={styles.progressBarContainer}>
        <View
          style={[
            styles.progressBar,
            {
              width: `${progressPercentage}%`,
            },
          ]}
        />
      </View>

      {/* Step Counter */}
      <View style={styles.stepCounter}>
        <Text style={styles.stepText}>
          Step {currentStep} of {totalSteps}
        </Text>
        {stepLabels && stepLabels[currentStep - 1] && (
          <Text style={styles.stepLabel}>{stepLabels[currentStep - 1]}</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: lightTheme.spacing.lg,
    paddingVertical: lightTheme.spacing.md,
    backgroundColor: lightTheme.colors.background,
  },
  progressBarContainer: {
    height: 4,
    backgroundColor: lightTheme.colors.surfaceVariant,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: lightTheme.spacing.sm,
  },
  progressBar: {
    height: '100%',
    backgroundColor: lightTheme.colors.primary,
  },
  stepCounter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stepText: {
    fontSize: lightTheme.fontSize.sm,
    color: lightTheme.colors.textSecondary,
    fontWeight: lightTheme.fontWeight.medium,
  },
  stepLabel: {
    fontSize: lightTheme.fontSize.sm,
    color: lightTheme.colors.primary,
    fontWeight: lightTheme.fontWeight.semibold,
  },
});
