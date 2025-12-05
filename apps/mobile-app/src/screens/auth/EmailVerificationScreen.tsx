/**
 * Email Verification Screen
 *
 * Displays verification instructions and allows resending verification email.
 * Handles deep link callback for email verification.
 */

import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';

import type { AuthStackParamList } from '../../types/navigation';

type EmailVerificationScreenNavigationProp = NativeStackNavigationProp<
  AuthStackParamList,
  'EmailVerification'
>;

const RESEND_COOLDOWN = 60; // seconds

export default function EmailVerificationScreen() {
  const navigation = useNavigation<EmailVerificationScreenNavigationProp>();

  const [isResending, setIsResending] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [isVerified] = useState(false); // TODO: setIsVerified will be used when implementing deep link verification

  useEffect(() => {
    // TODO: Set up deep link listener for verification callback
    // Linking.addEventListener('url', handleDeepLink);

    // Countdown timer for resend cooldown
    if (cooldownSeconds > 0) {
      const timer = setTimeout(() => {
        setCooldownSeconds(cooldownSeconds - 1);
      }, 1000);

      return () => clearTimeout(timer);
    }

    return undefined;
  }, [cooldownSeconds]);

  const handleResendEmail = async () => {
    if (cooldownSeconds > 0) {
      return;
    }

    setIsResending(true);

    try {
      // TODO: Call actual resend verification email API
      // await apiClient.resendVerificationEmail();

      // Mock API call
      await new Promise((resolve) => setTimeout(resolve, 1000));

      Alert.alert('Email Sent', 'Verification email has been resent. Please check your inbox.');
      setCooldownSeconds(RESEND_COOLDOWN);
    } catch (error) {
      console.error('[EmailVerificationScreen] Resend error:', error);
      Alert.alert('Error', 'Failed to resend verification email. Please try again.');
    } finally {
      setIsResending(false);
    }
  };

  // TODO: Uncomment when implementing deep link handling
  // const handleDeepLink = (event: { url: string }) => {
  //   // Parse deep link and verify token
  //   // Example: digitwinlive://verify-email?token=abc123

  //   const url = event.url;
  //   console.log('[EmailVerificationScreen] Deep link received:', url);

  //   if (url.includes('verify-email')) {
  //     // Extract token and verify
  //     handleVerification();
  //   }
  // };

  // TODO: Uncomment when implementing deep link verification
  // const handleVerification = async () => {
  //   try {
  //     // Call verification API with token
  //     // await apiClient.verifyEmail(token);

  //     setIsVerified(true);

  //     // Navigate to onboarding after a brief delay
  //     setTimeout(() => {
  //       // Navigate to onboarding
  //       // navigation.navigate('Onboarding');
  //       Alert.alert('Success', 'Email verified! Redirecting to onboarding...');
  //     }, 2000);
  //   } catch (error) {
  //     console.error('[EmailVerificationScreen] Verification error:', error);
  //     Alert.alert('Verification Failed', 'Invalid or expired verification link.');
  //   }
  // };

  if (isVerified) {
    return (
      <View style={styles.container}>
        <View style={styles.successContainer}>
          <View style={styles.successIcon}>
            <Text style={styles.successIconText}>✓</Text>
          </View>

          <Text style={styles.successTitle}>Email Verified!</Text>
          <Text style={styles.successMessage}>
            Your email has been successfully verified.{'\n'}
            Redirecting to onboarding...
          </Text>

          <ActivityIndicator size="large" color="#007AFF" style={styles.loader} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Text style={styles.iconText}>📧</Text>
        </View>

        <Text style={styles.title}>Verify Your Email</Text>
        <Text style={styles.message}>
          We've sent a verification link to your email address. Please check your inbox and click
          the link to verify your account.
        </Text>

        <View style={styles.instructionsContainer}>
          <Text style={styles.instructionsTitle}>Didn't receive the email?</Text>
          <Text style={styles.instructionsText}>
            • Check your spam or junk folder{'\n'}• Make sure you entered the correct email{'\n'}•
            Wait a few minutes and try resending
          </Text>
        </View>

        <TouchableOpacity
          style={[
            styles.resendButton,
            (isResending || cooldownSeconds > 0) && styles.resendButtonDisabled,
          ]}
          onPress={handleResendEmail}
          disabled={isResending || cooldownSeconds > 0}
        >
          {isResending ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.resendButtonText}>
              {cooldownSeconds > 0 ? `Resend in ${cooldownSeconds}s` : 'Resend Email'}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.backButton} onPress={() => navigation.navigate('Login')}>
          <Text style={styles.backButtonText}>Back to Login</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  iconText: {
    fontSize: 50,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  instructionsContainer: {
    width: '100%',
    backgroundColor: '#F9F9F9',
    borderRadius: 8,
    padding: 16,
    marginBottom: 32,
  },
  instructionsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  instructionsText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  resendButton: {
    width: '100%',
    height: 50,
    backgroundColor: '#007AFF',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  resendButtonDisabled: {
    opacity: 0.6,
  },
  resendButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  backButton: {
    padding: 12,
  },
  backButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#34C759',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  successIconText: {
    fontSize: 40,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  successTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  successMessage: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  loader: {
    marginTop: 16,
  },
});
