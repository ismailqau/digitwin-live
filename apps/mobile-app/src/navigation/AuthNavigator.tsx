/**
 * Auth Navigator
 *
 * Stack navigator for authentication flow:
 * Splash → Login → Register → ForgotPassword → EmailVerification
 */

import { useNavigation } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

import { useAuthStore } from '../store/authStore';
import type { AuthStackParamList } from '../types/navigation';

const Stack = createNativeStackNavigator<AuthStackParamList>();

// Placeholder screens - will be replaced with actual implementations
const SplashScreen = () => {
  const navigation = useNavigation();

  React.useEffect(() => {
    // Auto-navigate to Login after a brief delay
    const timer = setTimeout(() => {
      navigation.navigate('Login' as never);
    }, 1000);

    return () => clearTimeout(timer);
  }, [navigation]);

  return (
    <View style={styles.placeholder}>
      <Text style={styles.title}>DigiTwin Live</Text>
      <Text style={styles.subtitle}>Loading...</Text>
    </View>
  );
};

const LoginScreen = () => {
  const { login } = useAuthStore();

  const handleSkipLogin = () => {
    // Mock login for testing
    const mockUser = {
      id: 'test-user-123',
      email: 'test@example.com',
      name: 'Test User',
      createdAt: new Date().toISOString(),
    };
    login(mockUser, 'mock-access-token', 'mock-refresh-token');
  };

  return (
    <View style={styles.placeholder}>
      <Text style={styles.title}>Login</Text>
      <Text style={styles.subtitle}>Sign in to your account</Text>
      <TouchableOpacity style={styles.button} onPress={handleSkipLogin}>
        <Text style={styles.buttonText}>Skip Login (Demo)</Text>
      </TouchableOpacity>
    </View>
  );
};

const RegisterScreen = () => (
  <View style={styles.placeholder}>
    <Text style={styles.title}>Register</Text>
    <Text style={styles.subtitle}>Create a new account</Text>
  </View>
);

const ForgotPasswordScreen = () => (
  <View style={styles.placeholder}>
    <Text style={styles.title}>Forgot Password</Text>
    <Text style={styles.subtitle}>Reset your password</Text>
  </View>
);

const EmailVerificationScreen = () => (
  <View style={styles.placeholder}>
    <Text style={styles.title}>Email Verification</Text>
    <Text style={styles.subtitle}>Check your email</Text>
  </View>
);

export default function AuthNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="Splash"
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: { backgroundColor: '#f5f5f5' },
      }}
    >
      <Stack.Screen name="Splash" component={SplashScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
      <Stack.Screen
        name="ForgotPassword"
        component={ForgotPasswordScreen}
        options={{ headerShown: true, title: 'Reset Password' }}
      />
      <Stack.Screen
        name="EmailVerification"
        component={EmailVerificationScreen}
        options={{ headerShown: true, title: 'Verify Email' }}
      />
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 24,
  },
  button: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
