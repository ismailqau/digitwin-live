/**
 * Register Screen
 *
 * Multi-step registration form:
 * 1. Email
 * 2. Password (with strength indicator)
 * 3. Name
 * 4. Terms & Privacy acceptance
 */

import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { z, ZodError } from 'zod';

import type { AuthStackParamList } from '../../types/navigation';

type RegisterScreenNavigationProp = NativeStackNavigationProp<AuthStackParamList, 'Register'>;

// Validation schemas
const emailSchema = z.string().email('Invalid email address');
const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number');
const nameSchema = z.string().min(2, 'Name must be at least 2 characters');

type RegistrationStep = 'email' | 'password' | 'name' | 'confirm';

export default function RegisterScreen() {
  const navigation = useNavigation<RegisterScreenNavigationProp>();
  const insets = useSafeAreaInsets();

  const [currentStep, setCurrentStep] = useState<RegistrationStep>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptPrivacy, setAcceptPrivacy] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const getPasswordStrength = (pwd: string): { strength: number; label: string; color: string } => {
    let strength = 0;

    if (pwd.length >= 8) strength++;
    if (pwd.length >= 12) strength++;
    if (/[A-Z]/.test(pwd)) strength++;
    if (/[a-z]/.test(pwd)) strength++;
    if (/[0-9]/.test(pwd)) strength++;
    if (/[^A-Za-z0-9]/.test(pwd)) strength++;

    if (strength <= 2) return { strength: 1, label: 'Weak', color: '#FF3B30' };
    if (strength <= 4) return { strength: 2, label: 'Medium', color: '#FF9500' };
    return { strength: 3, label: 'Strong', color: '#34C759' };
  };

  const validateStep = (): boolean => {
    setError('');

    try {
      switch (currentStep) {
        case 'email':
          emailSchema.parse(email);
          return true;

        case 'password':
          passwordSchema.parse(password);
          if (password !== confirmPassword) {
            setError('Passwords do not match');
            return false;
          }
          return true;

        case 'name':
          nameSchema.parse(name);
          return true;

        case 'confirm':
          if (!acceptTerms || !acceptPrivacy) {
            setError('Please accept the Terms of Service and Privacy Policy');
            return false;
          }
          return true;

        default:
          return false;
      }
    } catch (err) {
      if (err instanceof ZodError) {
        setError(err.errors[0].message);
      }
      return false;
    }
  };

  const handleNext = () => {
    if (!validateStep()) {
      return;
    }

    const steps: RegistrationStep[] = ['email', 'password', 'name', 'confirm'];
    const currentIndex = steps.indexOf(currentStep);

    if (currentIndex < steps.length - 1) {
      setCurrentStep(steps[currentIndex + 1]);
    } else {
      handleRegister();
    }
  };

  const handleBack = () => {
    const steps: RegistrationStep[] = ['email', 'password', 'name', 'confirm'];
    const currentIndex = steps.indexOf(currentStep);

    if (currentIndex > 0) {
      setCurrentStep(steps[currentIndex - 1]);
      setError('');
    } else {
      navigation.goBack();
    }
  };

  const handleRegister = async () => {
    setIsLoading(true);

    try {
      // TODO: Call actual registration API
      // const response = await apiClient.register({ email, password, name });

      // Mock registration
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Navigate to email verification
      navigation.navigate('EmailVerification' as never);
    } catch (err) {
      console.error('[RegisterScreen] Registration error:', err);
      Alert.alert('Registration Failed', 'An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 'email':
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>What's your email?</Text>
            <Text style={styles.stepSubtitle}>We'll use this to create your account</Text>

            <TextInput
              style={styles.input}
              placeholder="Enter your email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
            />
          </View>
        );

      case 'password': {
        const passwordStrength = getPasswordStrength(password);

        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Create a password</Text>
            <Text style={styles.stepSubtitle}>Make it strong and secure</Text>

            <View style={styles.passwordContainer}>
              <TextInput
                style={styles.input}
                placeholder="Enter password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                autoFocus
              />
              <TouchableOpacity
                style={styles.showPasswordButton}
                onPress={() => setShowPassword(!showPassword)}
              >
                <Text style={styles.showPasswordText}>{showPassword ? 'Hide' : 'Show'}</Text>
              </TouchableOpacity>
            </View>

            {password.length > 0 && (
              <View style={styles.strengthContainer}>
                <View style={styles.strengthBars}>
                  {[1, 2, 3].map((bar) => (
                    <View
                      key={bar}
                      style={[
                        styles.strengthBar,
                        bar <= passwordStrength.strength && {
                          backgroundColor: passwordStrength.color,
                        },
                      ]}
                    />
                  ))}
                </View>
                <Text style={[styles.strengthLabel, { color: passwordStrength.color }]}>
                  {passwordStrength.label}
                </Text>
              </View>
            )}

            <TextInput
              style={[styles.input, { marginTop: 16 }]}
              placeholder="Confirm password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        );
      }

      case 'name':
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>What's your name?</Text>
            <Text style={styles.stepSubtitle}>This will be displayed on your profile</Text>

            <TextInput
              style={styles.input}
              placeholder="Enter your full name"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              autoCorrect={false}
              autoFocus
            />
          </View>
        );

      case 'confirm':
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Almost there!</Text>
            <Text style={styles.stepSubtitle}>Please review and accept our policies</Text>

            <View style={styles.summaryContainer}>
              <Text style={styles.summaryLabel}>Email:</Text>
              <Text style={styles.summaryValue}>{email}</Text>
            </View>

            <View style={styles.summaryContainer}>
              <Text style={styles.summaryLabel}>Name:</Text>
              <Text style={styles.summaryValue}>{name}</Text>
            </View>

            <TouchableOpacity
              style={styles.checkboxContainer}
              onPress={() => setAcceptTerms(!acceptTerms)}
            >
              <View style={[styles.checkbox, acceptTerms && styles.checkboxChecked]}>
                {acceptTerms && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={styles.checkboxLabel}>
                I accept the <Text style={styles.link}>Terms of Service</Text>
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.checkboxContainer}
              onPress={() => setAcceptPrivacy(!acceptPrivacy)}
            >
              <View style={[styles.checkbox, acceptPrivacy && styles.checkboxChecked]}>
                {acceptPrivacy && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={styles.checkboxLabel}>
                I accept the <Text style={styles.link}>Privacy Policy</Text>
              </Text>
            </TouchableOpacity>
          </View>
        );

      default:
        return null;
    }
  };

  const getStepNumber = (): number => {
    const steps: RegistrationStep[] = ['email', 'password', 'name', 'confirm'];
    return steps.indexOf(currentStep) + 1;
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 24 + insets.bottom }]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Progress Indicator */}
        <View style={[styles.progressContainer, { marginTop: 20 + insets.top }]}>
          <Text style={styles.progressText}>Step {getStepNumber()} of 4</Text>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${(getStepNumber() / 4) * 100}%` }]} />
          </View>
        </View>

        {/* Step Content */}
        {renderStepContent()}

        {/* Error Message */}
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {/* Navigation Buttons */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.nextButton, isLoading && styles.nextButtonDisabled]}
            onPress={handleNext}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.nextButtonText}>
                {currentStep === 'confirm' ? 'Create Account' : 'Next'}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Login Link */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account? </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Login')}>
            <Text style={styles.footerLink}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
  },
  progressContainer: {
    marginTop: 20,
    marginBottom: 32,
  },
  progressText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  progressBar: {
    height: 4,
    backgroundColor: '#E0E0E0',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#007AFF',
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  stepSubtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 32,
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#333',
    backgroundColor: '#F9F9F9',
  },
  passwordContainer: {
    position: 'relative',
  },
  showPasswordButton: {
    position: 'absolute',
    right: 16,
    top: 15,
  },
  showPasswordText: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '600',
  },
  strengthContainer: {
    marginTop: 12,
  },
  strengthBars: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  strengthBar: {
    flex: 1,
    height: 4,
    backgroundColor: '#E0E0E0',
    borderRadius: 2,
  },
  strengthLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  summaryContainer: {
    marginBottom: 16,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 16,
    color: '#333',
    fontWeight: '600',
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: '#DDD',
    borderRadius: 4,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 14,
    color: '#333',
  },
  link: {
    color: '#007AFF',
    fontWeight: '600',
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 14,
    marginBottom: 16,
    textAlign: 'center',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  backButton: {
    flex: 1,
    height: 50,
    backgroundColor: '#F0F0F0',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '600',
  },
  nextButton: {
    flex: 2,
    height: 50,
    backgroundColor: '#007AFF',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  nextButtonDisabled: {
    opacity: 0.6,
  },
  nextButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
  },
  footerText: {
    fontSize: 14,
    color: '#666',
  },
  footerLink: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '600',
  },
});
