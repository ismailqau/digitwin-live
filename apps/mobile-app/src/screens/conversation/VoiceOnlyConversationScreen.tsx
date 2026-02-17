/**
 * VoiceOnlyConversationScreen
 *
 * Audio-only conversation UI without video/face animation.
 * Uses the same WebSocket conversation flow as the video mode
 * but displays an audio waveform indicator instead of face animation.
 */

import { useNavigation } from '@react-navigation/native';
import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AudioWaveform } from '../../components/audio/AudioWaveform';
import GuestModeBanner from '../../components/GuestModeBanner';
import { useConversation } from '../../hooks/useConversation';
import { ConversationState } from '../../services/ConversationManager';
import { useAuthStore } from '../../store/authStore';

interface VoiceOnlyConversationScreenProps {
  websocketUrl: string;
  authToken: string;
}

export const VoiceOnlyConversationScreen: React.FC<VoiceOnlyConversationScreenProps> = ({
  websocketUrl,
  authToken,
}) => {
  const navigation = useNavigation();
  const { isGuest } = useAuthStore();
  const insets = useSafeAreaInsets();

  const {
    state,
    isConnected,
    isListening,
    isSpeaking,
    error,
    data,
    connect,
    disconnect,
    startListening,
    stopListening,
    interrupt,
    sessionId,
  } = useConversation({
    websocketUrl,
    authToken,
    autoConnect: false,
  });

  const handleConnect = async (): Promise<void> => {
    try {
      await connect();
    } catch {
      // Errors handled by useConversation hook's error state
    }
  };

  const handleSignInPress = (): void => {
    // @ts-expect-error - Navigation types updated in task 8.3
    navigation.navigate('Auth');
  };

  const getStateColor = (): string => {
    switch (state) {
      case ConversationState.CONNECTED:
      case ConversationState.LISTENING:
        return '#34C759';
      case ConversationState.PROCESSING:
        return '#FF9500';
      case ConversationState.SPEAKING:
        return '#007AFF';
      case ConversationState.ERROR:
        return '#FF3B30';
      default:
        return '#8E8E93';
    }
  };

  const getStateText = (): string => {
    switch (state) {
      case ConversationState.IDLE:
        return 'Not Connected';
      case ConversationState.CONNECTING:
        return 'Connecting...';
      case ConversationState.CONNECTED:
        return 'Connected';
      case ConversationState.LISTENING:
        return 'Listening...';
      case ConversationState.PROCESSING:
        return 'Thinking...';
      case ConversationState.SPEAKING:
        return 'Speaking...';
      case ConversationState.INTERRUPTED:
        return 'Interrupted';
      case ConversationState.ERROR:
        return 'Error';
      case ConversationState.DISCONNECTED:
        return 'Disconnected';
      default:
        return 'Unknown';
    }
  };

  return (
    <View
      style={[styles.container, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}
    >
      {isGuest && <GuestModeBanner onSignInPress={handleSignInPress} />}

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Voice Conversation</Text>
        <View style={[styles.statusBadge, { backgroundColor: getStateColor() }]}>
          <Text style={styles.statusText}>{getStateText()}</Text>
        </View>
      </View>

      {sessionId ? (
        <View style={styles.sessionInfo}>
          <Text style={styles.sessionLabel}>Session:</Text>
          <Text style={styles.sessionId}>{sessionId.substring(0, 20)}...</Text>
        </View>
      ) : null}

      {error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>⚠️ {error}</Text>
        </View>
      ) : null}

      {/* Waveform area — central visual focus for voice-only mode */}
      <View style={styles.waveformArea}>
        <AudioWaveform isPlaying={isSpeaking} color={getStateColor()} size="large" />
        <Text style={styles.waveformLabel}>
          {isSpeaking ? 'AI is speaking' : isListening ? 'Listening to you...' : ''}
        </Text>
      </View>

      {/* Transcript */}
      <ScrollView style={styles.transcriptContainer}>
        <Text style={styles.transcriptLabel}>Transcript</Text>
        <Text style={styles.transcriptText}>{data.transcript || 'No transcript yet...'}</Text>
        {data.isFinalTranscript ? (
          <Text style={styles.confidenceText}>
            Confidence: {(data.transcriptConfidence * 100).toFixed(1)}%
          </Text>
        ) : null}
      </ScrollView>

      {/* Controls */}
      <View style={styles.controls}>
        {!isConnected ? (
          <TouchableOpacity
            style={[styles.button, styles.connectButton]}
            onPress={handleConnect}
            disabled={state === ConversationState.CONNECTING}
            accessibilityRole="button"
            accessibilityLabel="Connect to conversation"
          >
            {state === ConversationState.CONNECTING ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Connect</Text>
            )}
          </TouchableOpacity>
        ) : null}

        {isConnected && !isListening && !isSpeaking ? (
          <TouchableOpacity
            style={[styles.button, styles.listenButton]}
            onPress={startListening}
            accessibilityRole="button"
            accessibilityLabel="Start listening"
          >
            <Text style={styles.buttonText}>🎤 Start Listening</Text>
          </TouchableOpacity>
        ) : null}

        {isListening ? (
          <TouchableOpacity
            style={[styles.button, styles.stopButton]}
            onPress={stopListening}
            accessibilityRole="button"
            accessibilityLabel="Stop listening"
          >
            <Text style={styles.buttonText}>⏹️ Stop</Text>
          </TouchableOpacity>
        ) : null}

        {isSpeaking ? (
          <TouchableOpacity
            style={[styles.button, styles.interruptButton]}
            onPress={interrupt}
            accessibilityRole="button"
            accessibilityLabel="Interrupt AI"
          >
            <Text style={styles.buttonText}>✋ Interrupt</Text>
          </TouchableOpacity>
        ) : null}

        {isConnected ? (
          <TouchableOpacity
            style={[styles.button, styles.disconnectButton]}
            onPress={disconnect}
            accessibilityRole="button"
            accessibilityLabel="Disconnect"
          >
            <Text style={styles.buttonText}>Disconnect</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 16,
  },
  header: {
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    alignSelf: 'flex-start',
  },
  statusText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  sessionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    padding: 8,
    backgroundColor: '#fff',
    borderRadius: 8,
  },
  sessionLabel: {
    fontSize: 12,
    color: '#666',
    marginRight: 8,
  },
  sessionId: {
    fontSize: 12,
    color: '#333',
    fontFamily: 'monospace',
  },
  errorContainer: {
    backgroundColor: '#ffebee',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#f44336',
  },
  errorText: {
    color: '#c62828',
    fontSize: 14,
  },
  waveformArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 12,
    minHeight: 120,
  },
  waveformLabel: {
    marginTop: 16,
    fontSize: 14,
    color: '#8E8E93',
  },
  transcriptContainer: {
    maxHeight: 150,
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  transcriptLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: '#666',
  },
  transcriptText: {
    fontSize: 16,
    color: '#333',
    lineHeight: 24,
  },
  confidenceText: {
    fontSize: 12,
    color: '#666',
    marginTop: 8,
    fontStyle: 'italic',
  },
  controls: {
    gap: 8,
  },
  button: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  connectButton: {
    backgroundColor: '#34C759',
  },
  listenButton: {
    backgroundColor: '#007AFF',
  },
  stopButton: {
    backgroundColor: '#FF9500',
  },
  interruptButton: {
    backgroundColor: '#FF3B30',
  },
  disconnectButton: {
    backgroundColor: '#8E8E93',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default VoiceOnlyConversationScreen;
