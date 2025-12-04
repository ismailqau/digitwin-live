/**
 * React Native Mobile App - DigiTwin Live
 *
 * Main application entry point with navigation and state management.
 * Enables real-time conversation with AI clone using audio streaming
 * and WebSocket communication.
 */

import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import React, { useEffect } from 'react';
import { StatusBar, useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { RootNavigator } from './src/navigation';
import { useUIStore, useAuthStore } from './src/store';
import { lightTheme, darkTheme } from './src/theme';

export const APP_VERSION = '1.0.0';

export default function App() {
  const systemColorScheme = useColorScheme();
  const { themeMode, setDarkMode } = useUIStore();
  const { setLoading } = useAuthStore();

  // Determine if dark mode should be active
  const isDarkMode = Boolean(
    themeMode === 'dark' || (themeMode === 'system' && systemColorScheme === 'dark')
  );

  // Initialize app - set loading to false immediately
  useEffect(() => {
    console.log('[App] Initializing...');
    setDarkMode(isDarkMode);
    setLoading(false);
    console.log('[App] Ready');
  }, [isDarkMode, setDarkMode, setLoading]);

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
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <NavigationContainer theme={navigationTheme}>
          <StatusBar
            barStyle={isDarkMode ? 'light-content' : 'dark-content'}
            backgroundColor={theme.colors.background}
          />
          <RootNavigator />
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
