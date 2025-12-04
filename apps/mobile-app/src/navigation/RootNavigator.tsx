/**
 * Root Navigator
 *
 * Top-level navigator that conditionally renders:
 * - Auth flow (when not authenticated)
 * - Onboarding flow (when authenticated but not onboarded)
 * - Main app (when authenticated and onboarded)
 */

import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';

import { useAuthStore } from '../store/authStore';
import type { RootStackParamList } from '../types/navigation';

import AuthNavigator from './AuthNavigator';
import MainNavigator from './MainNavigator';
import OnboardingNavigator from './OnboardingNavigator';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const authState = useAuthStore();
  const { isAuthenticated, isOnboarded, isLoading } = authState;

  console.log('[RootNavigator] Full state:', JSON.stringify(authState));
  console.log('[RootNavigator] isLoading:', isLoading, typeof isLoading);

  // TEMPORARY: Force loading to false for debugging
  const forceNotLoading = false; // Change to true to bypass loading

  // Show loading screen while initializing
  if (isLoading && !forceNotLoading) {
    console.log('[RootNavigator] Showing loading screen');
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading...</Text>
        <Text style={styles.debugText}>isLoading: {String(isLoading)}</Text>
      </View>
    );
  }

  console.log('[RootNavigator] Rendering navigation stack');

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!isAuthenticated ? (
        <Stack.Screen name="Auth" component={AuthNavigator} />
      ) : !isOnboarded ? (
        <Stack.Screen name="Onboarding" component={OnboardingNavigator} />
      ) : (
        <Stack.Screen name="Main" component={MainNavigator} />
      )}
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  debugText: {
    marginTop: 8,
    fontSize: 12,
    color: '#999',
  },
});
