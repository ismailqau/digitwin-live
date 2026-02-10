/**
 * Splash Screen
 *
 * Initial screen shown on app launch.
 * - Displays app logo with animation
 * - Checks authentication state
 * - Handles token refresh
 * - Auto-navigates to Login or Main based on stored token
 */

import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuthStore } from '../../store/authStore';
import type { AuthStackParamList } from '../../types/navigation';
// import { SecureStorage } from '../../services/SecureStorage'; // Temporarily disabled

type SplashScreenNavigationProp = NativeStackNavigationProp<AuthStackParamList, 'Splash'>;

export default function SplashScreen() {
  const navigation = useNavigation<SplashScreenNavigationProp>();
  const { setLoading } = useAuthStore();
  const insets = useSafeAreaInsets();

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    console.log('[SplashScreen] Component mounted');

    // Start logo animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 4,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();

    // Simple timeout to navigate (bypass auth check temporarily)
    const timer = setTimeout(() => {
      console.log('[SplashScreen] Navigating to Login');
      setLoading(false);
      navigation.replace('Login');
    }, 2000);

    return () => clearTimeout(timer);
  }, [navigation, setLoading]);

  // Temporarily disabled - SecureStorage causing hang
  // const checkAuthState = async () => {
  //   try {
  //     setLoading(true);
  //     const [accessToken, refreshToken] = await Promise.all([
  //       SecureStorage.getAccessToken(),
  //       SecureStorage.getRefreshToken(),
  //     ]);
  //     if (accessToken && refreshToken) {
  //       // TODO: Validate and refresh token
  //       navigation.replace('Login');
  //     } else {
  //       navigation.replace('Login');
  //     }
  //   } catch (error) {
  //     console.error('[SplashScreen] Error:', error);
  //     navigation.replace('Login');
  //   } finally {
  //     setLoading(false);
  //   }
  // };

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.logoContainer,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        <View style={styles.logo}>
          <Text style={styles.logoText}>DT</Text>
        </View>
        <Text style={styles.appName}>DigiTwin Live</Text>
        <Text style={styles.tagline}>Your AI Conversational Clone</Text>
      </Animated.View>

      <View style={[styles.loadingContainer, { bottom: 80 + insets.bottom }]}>
        <ActivityIndicator size="small" color="#007AFF" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 60,
  },
  logo: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  logoText: {
    fontSize: 40,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  appName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  tagline: {
    fontSize: 16,
    color: '#666',
  },
  loadingContainer: {
    position: 'absolute',
    bottom: 80,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#999',
  },
});
