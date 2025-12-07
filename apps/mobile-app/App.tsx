/**
 * React Native Mobile App - DigiTwin Live
 *
 * Main application entry point with navigation and state management.
 * Enables real-time conversation with AI clone using audio streaming
 * and WebSocket communication.
 */

import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect, useCallback } from 'react';
import { StatusBar, useColorScheme, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { RootNavigator } from './src/navigation';
import { useUIStore, useAuthStore } from './src/store';
import { lightTheme, darkTheme } from './src/theme';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync().catch(() => {
  /* reloading the app might trigger some race conditions, ignore them */
});

// Simple Error Boundary Component
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <SafeAreaProvider>
          <View
            style={{
              flex: 1,
              justifyContent: 'center',
              alignItems: 'center',
              padding: 20,
              backgroundColor: 'white',
            }}
          >
            <Text style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 10, color: 'red' }}>
              Something went wrong
            </Text>
            <Text style={{ color: 'black', textAlign: 'center' }}>{this.state.error?.message}</Text>
          </View>
        </SafeAreaProvider>
      );
    }
    return this.props.children;
  }
}

export const APP_VERSION = '1.0.0';

export default function App() {
  const systemColorScheme = useColorScheme();
  const { themeMode, setDarkMode } = useUIStore();
  const { setLoading } = useAuthStore();
  const [appIsReady, setAppIsReady] = React.useState(false);

  // Determine if dark mode should be active
  const isDarkMode = Boolean(
    themeMode === 'dark' || (themeMode === 'system' && systemColorScheme === 'dark')
  );

  // Initialize app
  useEffect(() => {
    async function prepare() {
      try {
        console.log('[App] Initializing full app...');
        // Pre-load logic here if needed
        await new Promise((resolve) => setTimeout(resolve, 500)); // Short delay for smooth splash transition
      } catch (e) {
        console.warn(e);
      } finally {
        setLoading(false);
        setAppIsReady(true);
        console.log('[App] Ready');
      }
    }

    prepare();
  }, [setLoading]);

  // Update theme when it changes
  useEffect(() => {
    setDarkMode(isDarkMode);
  }, [isDarkMode, setDarkMode]);

  const onLayoutRootView = useCallback(async () => {
    if (appIsReady) {
      console.log('[App] Hiding splash screen');
      await SplashScreen.hideAsync();
    }
  }, [appIsReady]);

  if (!appIsReady) {
    return null;
  }

  const theme = isDarkMode ? darkTheme : lightTheme;
  const baseTheme = isDarkMode ? DarkTheme : DefaultTheme;

  const navigationTheme = {
    ...baseTheme,
    colors: {
      ...baseTheme.colors,
      primary: theme.colors.primary,
      background: theme.colors.background,
      card: theme.colors.surface,
      text: theme.colors.text,
      border: theme.colors.border,
      notification: theme.colors.accent,
    },
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }} onLayout={onLayoutRootView}>
      <ErrorBoundary>
        <SafeAreaProvider>
          <NavigationContainer theme={navigationTheme}>
            <StatusBar
              barStyle={isDarkMode ? 'light-content' : 'dark-content'}
              backgroundColor={theme.colors.background}
            />
            <RootNavigator />
          </NavigationContainer>
        </SafeAreaProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}
