/**
 * Main Navigator
 *
 * Bottom tab navigator for main app screens:
 * Conversation | History | Knowledge | Settings
 *
 * The Conversation tab uses a nested stack navigator that checks
 * face model availability to determine conversation mode:
 * - No face model → defaults to voice-only mode
 * - Has face model → presents mode choice (video or voice-only)
 */

import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

import ConversationScreen from '../components/ConversationScreen';
import ENV from '../config/env';
import { VoiceOnlyConversationScreen } from '../screens/conversation/VoiceOnlyConversationScreen';
import { useFaceStore } from '../store/faceStore';
import type { ConversationStackParamList, MainTabParamList } from '../types/navigation';
import { generateGuestToken } from '../utils/guestToken';

const Tab = createBottomTabNavigator<MainTabParamList>();
const ConversationStack = createNativeStackNavigator<ConversationStackParamList>();

const WEBSOCKET_URL = ENV.WEBSOCKET_URL;

/**
 * Conversation mode selection screen.
 * If user has no face model → auto-navigates to voice-only.
 * If user has face model → presents choice between video and voice-only.
 */
const ConversationModeSelect: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { faceModel } = useFaceStore();
  const hasFaceModel = faceModel !== null;

  // No face model: default straight to voice-only
  React.useEffect(() => {
    if (!hasFaceModel) {
      navigation.replace('VoiceOnlyConversation');
    }
  }, [hasFaceModel, navigation]);

  // If no face model, render nothing while redirecting
  if (!hasFaceModel) {
    return null;
  }

  // User has face model: present choice
  return (
    <View style={styles.modeSelect}>
      <Text style={styles.modeTitle}>Start Conversation</Text>
      <Text style={styles.modeSubtitle}>Choose your conversation mode</Text>

      <TouchableOpacity
        style={[styles.modeCard, styles.videoCard]}
        onPress={() => navigation.navigate('ConversationDetail', { sessionId: '' })}
        accessibilityRole="button"
        accessibilityLabel="Start video conversation with face animation"
      >
        <Text style={styles.modeCardEmoji}>🎥</Text>
        <Text style={styles.modeCardTitle}>Video Mode</Text>
        <Text style={styles.modeCardDesc}>Full conversation with face animation</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.modeCard, styles.voiceCard]}
        onPress={() => navigation.navigate('VoiceOnlyConversation')}
        accessibilityRole="button"
        accessibilityLabel="Start voice-only conversation"
      >
        <Text style={styles.modeCardEmoji}>🎤</Text>
        <Text style={styles.modeCardTitle}>Voice Only</Text>
        <Text style={styles.modeCardDesc}>Audio conversation without video</Text>
      </TouchableOpacity>
    </View>
  );
};

// Video conversation wrapper (existing behavior)
const VideoConversationScreen: React.FC = () => {
  const authToken = useMemo(() => generateGuestToken(), []);
  return <ConversationScreen websocketUrl={WEBSOCKET_URL} authToken={authToken} />;
};

// Voice-only conversation wrapper
const VoiceOnlyScreen: React.FC = () => {
  const authToken = useMemo(() => generateGuestToken(), []);
  return <VoiceOnlyConversationScreen websocketUrl={WEBSOCKET_URL} authToken={authToken} />;
};

// Conversation tab with nested stack
const ConversationTab: React.FC = () => {
  return (
    <ConversationStack.Navigator screenOptions={{ headerShown: false }}>
      <ConversationStack.Screen name="ConversationMain" component={ConversationModeSelect} />
      <ConversationStack.Screen name="ConversationDetail" component={VideoConversationScreen} />
      <ConversationStack.Screen name="VoiceOnlyConversation" component={VoiceOnlyScreen} />
    </ConversationStack.Navigator>
  );
};

// Placeholder screens
const HistoryScreen: React.FC = () => (
  <View style={styles.placeholder}>
    <Text style={styles.title}>History</Text>
    <Text style={styles.subtitle}>View past conversations</Text>
  </View>
);

const KnowledgeScreen: React.FC = () => (
  <View style={styles.placeholder}>
    <Text style={styles.title}>Knowledge Base</Text>
    <Text style={styles.subtitle}>Manage documents and FAQs</Text>
  </View>
);

const SettingsScreen: React.FC = () => (
  <View style={styles.placeholder}>
    <Text style={styles.title}>Settings</Text>
    <Text style={styles.subtitle}>Configure your preferences</Text>
  </View>
);

const TabIcon = ({ name, focused }: { name: string; focused: boolean }): React.JSX.Element => (
  <Text style={[styles.icon, focused && styles.iconFocused]}>{name}</Text>
);

export default function MainNavigator(): React.JSX.Element {
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
  modeSelect: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 24,
  },
  modeTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  modeSubtitle: {
    fontSize: 16,
    color: '#8E8E93',
    marginBottom: 32,
  },
  modeCard: {
    width: '100%',
    padding: 24,
    borderRadius: 16,
    marginBottom: 16,
    alignItems: 'center',
  },
  videoCard: {
    backgroundColor: '#007AFF',
  },
  voiceCard: {
    backgroundColor: '#34C759',
  },
  modeCardEmoji: {
    fontSize: 40,
    marginBottom: 12,
  },
  modeCardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  modeCardDesc: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
  },
});
