/**
 * Welcome Screen
 *
 * First screen of onboarding flow with animated feature carousel
 * Displays app branding, feature highlights, and navigation options
 */

import React, { useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  Dimensions,
} from 'react-native';

import { useAuthStore } from '../../store/authStore';
import { lightTheme } from '../../theme';
import type { OnboardingScreenProps } from '../../types/navigation';

const { width } = Dimensions.get('window');

interface Feature {
  id: string;
  title: string;
  description: string;
  icon: string;
}

const FEATURES: Feature[] = [
  {
    id: '1',
    title: 'Voice Cloning',
    description: 'Create a digital twin that sounds exactly like you',
    icon: '🎤',
  },
  {
    id: '2',
    title: 'Face Animation',
    description: 'See your clone with synchronized lip-sync video',
    icon: '😊',
  },
  {
    id: '3',
    title: 'Knowledge Base',
    description: 'Upload documents for personalized responses',
    icon: '📚',
  },
  {
    id: '4',
    title: 'Real-Time Chat',
    description: 'Have natural conversations with your digital twin',
    icon: '💬',
  },
];

export default function WelcomeScreen({
  navigation,
}: OnboardingScreenProps<'Welcome'>): React.ReactElement {
  const { setOnboarded } = useAuthStore();
  const scrollViewRef = useRef<ScrollView>(null);
  const scrollX = useRef(new Animated.Value(0)).current;

  const handleScroll = Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
    useNativeDriver: false,
  });

  const handleGetStarted = () => {
    navigation.navigate('PersonalitySetup');
  };

  const handleSkip = () => {
    // Mark as onboarded and go to main app
    setOnboarded(true);
  };

  const renderDot = (index: number) => {
    const inputRange = [(index - 1) * width, index * width, (index + 1) * width];
    const dotWidth = scrollX.interpolate({
      inputRange,
      outputRange: [8, 16, 8],
      extrapolate: 'clamp',
    });

    const opacity = scrollX.interpolate({
      inputRange,
      outputRange: [0.5, 1, 0.5],
      extrapolate: 'clamp',
    });

    return (
      <Animated.View
        key={`dot-${index}`}
        style={[
          styles.dot,
          {
            width: dotWidth,
            opacity,
            backgroundColor: lightTheme.colors.primary,
          },
        ]}
      />
    );
  };

  return (
    <View style={styles.container}>
      {/* Header with Skip Button */}
      <View style={styles.header}>
        <Text style={styles.appName}>DigiTwin Live</Text>
        <TouchableOpacity onPress={handleSkip}>
          <Text style={styles.skipButton}>Skip</Text>
        </TouchableOpacity>
      </View>

      {/* Feature Carousel */}
      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        scrollEventThrottle={16}
        onScroll={handleScroll}
        showsHorizontalScrollIndicator={false}
        style={styles.carousel}
      >
        {FEATURES.map((feature) => (
          <View key={feature.id} style={styles.slide}>
            <View style={styles.iconContainer}>
              <Text style={styles.icon}>{feature.icon}</Text>
            </View>
            <Text style={styles.slideTitle}>{feature.title}</Text>
            <Text style={styles.slideDescription}>{feature.description}</Text>
          </View>
        ))}
      </ScrollView>

      {/* Page Indicator Dots */}
      <View style={styles.dotsContainer}>{FEATURES.map((_, index) => renderDot(index))}</View>

      {/* Action Buttons */}
      <View style={styles.footer}>
        <TouchableOpacity style={[styles.button, styles.primaryButton]} onPress={handleGetStarted}>
          <Text style={styles.primaryButtonText}>Get Started</Text>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: lightTheme.spacing.lg,
    paddingTop: lightTheme.spacing.xl,
    paddingBottom: lightTheme.spacing.md,
  },
  appName: {
    fontSize: lightTheme.fontSize.xl,
    fontWeight: lightTheme.fontWeight.bold,
    color: lightTheme.colors.primary,
  },
  skipButton: {
    fontSize: lightTheme.fontSize.md,
    color: lightTheme.colors.textSecondary,
    fontWeight: lightTheme.fontWeight.semibold,
  },
  carousel: {
    flex: 1,
  },
  slide: {
    width,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: lightTheme.spacing.xl,
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: lightTheme.colors.surfaceVariant,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: lightTheme.spacing.lg,
  },
  icon: {
    fontSize: 48,
  },
  slideTitle: {
    fontSize: lightTheme.fontSize.lg,
    fontWeight: lightTheme.fontWeight.bold,
    color: lightTheme.colors.text,
    marginBottom: lightTheme.spacing.md,
    textAlign: 'center',
  },
  slideDescription: {
    fontSize: lightTheme.fontSize.md,
    color: lightTheme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: lightTheme.lineHeight.md,
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: lightTheme.spacing.lg,
    gap: lightTheme.spacing.sm,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  footer: {
    paddingHorizontal: lightTheme.spacing.lg,
    paddingBottom: lightTheme.spacing.xl,
    gap: lightTheme.spacing.md,
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
