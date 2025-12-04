/**
 * Main Navigator
 *
 * Bottom tab navigator for main app screens:
 * Conversation | History | Knowledge | Settings
 */

import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

import ConversationScreen from '../components/ConversationScreen';
import type { MainTabParamList } from '../types/navigation';

const Tab = createBottomTabNavigator<MainTabParamList>();

// Configuration - these should come from environment variables in production
// Socket.io uses HTTP/HTTPS protocol, not ws://
// For iOS Simulator: use 127.0.0.1 or localhost
// For Physical Device: use your computer's IP (192.168.100.204)
const WEBSOCKET_URL = process.env.WEBSOCKET_URL || 'http://127.0.0.1:3001';
// Valid JWT token for development (expires in 24h)
const AUTH_TOKEN =
  process.env.AUTH_TOKEN ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ0ZXN0LXVzZXItMTIzIiwiZW1haWwiOiJ0ZXN0QGV4YW1wbGUuY29tIiwic3Vic2NyaXB0aW9uVGllciI6ImZyZWUiLCJwZXJtaXNzaW9ucyI6WyJjb252ZXJzYXRpb246Y3JlYXRlIiwiY29udmVyc2F0aW9uOnJlYWQiLCJrbm93bGVkZ2U6cmVhZCJdLCJyb2xlcyI6WyJ1c2VyIl0sImlhdCI6MTc2NDg0NTA2MCwiZXhwIjoxNzY0OTMxNDYwfQ.eHuR_xxq0FhxWAR8MuQS7dT0Jt8cgAZZPh-m6ASjta0';

// Wrapper for existing ConversationScreen
const ConversationTab = () => (
  <ConversationScreen websocketUrl={WEBSOCKET_URL} authToken={AUTH_TOKEN} />
);

// Placeholder screens - will be replaced with actual implementations
const HistoryScreen = () => (
  <View style={styles.placeholder}>
    <Text style={styles.title}>History</Text>
    <Text style={styles.subtitle}>View past conversations</Text>
  </View>
);

const KnowledgeScreen = () => (
  <View style={styles.placeholder}>
    <Text style={styles.title}>Knowledge Base</Text>
    <Text style={styles.subtitle}>Manage documents and FAQs</Text>
  </View>
);

const SettingsScreen = () => (
  <View style={styles.placeholder}>
    <Text style={styles.title}>Settings</Text>
    <Text style={styles.subtitle}>Configure your preferences</Text>
  </View>
);

// Simple icon components (will be replaced with proper icons)
const TabIcon = ({ name, focused }: { name: string; focused: boolean }) => (
  <Text style={[styles.icon, focused && styles.iconFocused]}>{name}</Text>
);

export default function MainNavigator() {
  return (
    <Tab.Navigator
      initialRouteName="Conversation"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#007AFF',
        tabBarInactiveTintColor: '#8E8E93',
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor: '#E5E5EA',
          paddingBottom: 4,
          paddingTop: 4,
          height: 56,
        },
        tabBarLabelStyle: {
          fontSize: 11,
        },
      }}
    >
      <Tab.Screen
        name="Conversation"
        component={ConversationTab}
        options={{
          tabBarLabel: 'Chat',
          tabBarIcon: ({ focused }) => <TabIcon name="💬" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="History"
        component={HistoryScreen}
        options={{
          tabBarLabel: 'History',
          tabBarIcon: ({ focused }) => <TabIcon name="📜" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Knowledge"
        component={KnowledgeScreen}
        options={{
          tabBarLabel: 'Knowledge',
          tabBarIcon: ({ focused }) => <TabIcon name="📚" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          tabBarLabel: 'Settings',
          tabBarIcon: ({ focused }) => <TabIcon name="⚙️" focused={focused} />,
        }}
      />
    </Tab.Navigator>
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
  },
  icon: {
    fontSize: 20,
    opacity: 0.6,
  },
  iconFocused: {
    opacity: 1,
  },
});
