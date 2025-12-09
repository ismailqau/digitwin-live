/**
 * Main Navigator
 *
 * Bottom tab navigator for main app screens:
 * Conversation | History | Knowledge | Settings
 */

import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';

import ConversationScreen from '../components/ConversationScreen';
import ENV from '../config/env';
import type { MainTabParamList } from '../types/navigation';
import { generateGuestToken } from '../utils/guestToken';

const Tab = createBottomTabNavigator<MainTabParamList>();

// Configuration
const WEBSOCKET_URL = ENV.WEBSOCKET_URL;

// Wrapper for existing ConversationScreen
const ConversationTab = () => {
  // Generate a guest token for development/testing
  // In production, this would use a real JWT from authentication
  const authToken = useMemo(() => generateGuestToken(), []);

  return <ConversationScreen websocketUrl={WEBSOCKET_URL} authToken={authToken} />;
};

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
