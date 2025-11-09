/**
 * React Native Mobile App - Conversational Clone
 *
 * Main application entry point demonstrating real-time conversation
 * with AI clone using audio streaming and WebSocket communication.
 */

import React from 'react';
import { SafeAreaView, StyleSheet, StatusBar } from 'react-native';

import ConversationScreen from './src/components/ConversationScreen';

export const APP_VERSION = '1.0.0';

// Configuration - these should come from environment variables in production
const WEBSOCKET_URL = process.env.WEBSOCKET_URL || 'ws://localhost:3001';
const AUTH_TOKEN = process.env.AUTH_TOKEN || 'demo-token';

export default function App() {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f5f5f5" />
      <ConversationScreen websocketUrl={WEBSOCKET_URL} authToken={AUTH_TOKEN} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
});
