/**
 * ConversationScreen Component
 *
 * Example screen demonstrating real-time conversation with AI clone.
 * Shows:
 * - Connection status
 * - Voice activity indicator
 * - Transcript display
 * - Audio quality metrics
 * - Start/stop listening controls
 * - Interrupt functionality
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';

import { useConversation } from '../hooks/useConversation';
import { ConversationState } from '../services/ConversationManager';

interface ConversationScreenProps {
  websocketUrl: string;
  authToken: string;
}

export const ConversationScreen: React.FC<ConversationScreenProps> = ({
  websocketUrl,
  authToken,
}) => {
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

  const handleConnect = async () => {
    Alert.alert('Debug', 'Connect button pressed!');
    console.log('[ConversationScreen] Connect button pressed');
    console.log('[ConversationScreen] WebSocket URL:', websocketUrl);
    console.log('[ConversationScreen] Token length:', authToken?.length);

    try {
      await connect();
      console.log('[ConversationScreen] Connected successfully!');
      Alert.alert('Success', 'Connected to server!');
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error('[ConversationScreen] Connection failed:', errorMsg);
      Alert.alert(
        'Connection Failed',
        `Could not connect to server:\n\n${errorMsg}\n\nURL: ${websocketUrl}`,
        [{ text: 'OK' }]
      );
    }
  };

  const getStateColor = () => {
    switch (state) {
      case ConversationState.CONNECTED:
      case ConversationState.LISTENING:
        return '#4CAF50';
      case ConversationState.PROCESSING:
        return '#FF9800';
      case ConversationState.SPEAKING:
        return '#2196F3';
      case ConversationState.ERROR:
        return '#F44336';
      default:
        return '#9E9E9E';
    }
  };

  const getStateText = () => {
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
        return 'Processing...';
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
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>AI Clone Conversation</Text>
        <View style={[styles.statusIndicator, { backgroundColor: getStateColor() }]}>
          <Text style={styles.statusText}>{getStateText()}</Text>
        </View>
      </View>

      {/* Session Info */}
      {sessionId && (
        <View style={styles.sessionInfo}>
          <Text style={styles.sessionLabel}>Session ID:</Text>
          <Text style={styles.sessionId}>{sessionId.substring(0, 20)}...</Text>
        </View>
      )}

      {/* Error Display */}
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>⚠️ {error}</Text>
        </View>
      )}

      {/* Voice Activity Indicator */}
      {isListening && (
        <View style={styles.voiceActivityContainer}>
          <View style={[styles.voiceActivityIndicator, data.isVoiceActive && styles.voiceActive]}>
            <Text style={styles.voiceActivityText}>
              {data.isVoiceActive ? '🎤 Speaking' : '🎤 Waiting...'}
            </Text>
          </View>
        </View>
      )}

      {/* Audio Quality Metrics */}
      {data.audioQuality && isListening && (
        <View style={styles.metricsContainer}>
          <Text style={styles.metricsTitle}>Audio Quality</Text>
          <View style={styles.metricsRow}>
            <Text style={styles.metricLabel}>Volume:</Text>
            <Text style={styles.metricValue}>{data.audioQuality.volume}%</Text>
          </View>
          <View style={styles.metricsRow}>
            <Text style={styles.metricLabel}>SNR:</Text>
            <Text style={styles.metricValue}>{data.audioQuality.snr} dB</Text>
          </View>
          {data.audioQuality.isClipping && (
            <Text style={styles.warningText}>⚠️ Audio clipping detected</Text>
          )}
          {data.audioQuality.isSilent && <Text style={styles.warningText}>🔇 Silent</Text>}
        </View>
      )}

      {/* Transcript Display */}
      <ScrollView style={styles.transcriptContainer}>
        <Text style={styles.transcriptLabel}>Transcript:</Text>
        <Text style={styles.transcriptText}>{data.transcript || 'No transcript yet...'}</Text>
        {data.isFinalTranscript && (
          <Text style={styles.confidenceText}>
            Confidence: {(data.transcriptConfidence * 100).toFixed(1)}%
          </Text>
        )}
      </ScrollView>

      {/* Performance Metrics */}
      {data.metrics && (
        <View style={styles.performanceContainer}>
          <Text style={styles.performanceTitle}>Performance Metrics</Text>
          <View style={styles.metricsRow}>
            <Text style={styles.metricLabel}>Total Latency:</Text>
            <Text style={styles.metricValue}>{data.metrics.totalLatencyMs}ms</Text>
          </View>
          <View style={styles.metricsRow}>
            <Text style={styles.metricLabel}>ASR:</Text>
            <Text style={styles.metricValue}>{data.metrics.asrLatencyMs}ms</Text>
          </View>
          <View style={styles.metricsRow}>
            <Text style={styles.metricLabel}>RAG:</Text>
            <Text style={styles.metricValue}>{data.metrics.ragLatencyMs}ms</Text>
          </View>
          <View style={styles.metricsRow}>
            <Text style={styles.metricLabel}>LLM:</Text>
            <Text style={styles.metricValue}>{data.metrics.llmLatencyMs}ms</Text>
          </View>
          <View style={styles.metricsRow}>
            <Text style={styles.metricLabel}>TTS:</Text>
            <Text style={styles.metricValue}>{data.metrics.ttsLatencyMs}ms</Text>
          </View>
        </View>
      )}

      {/* Control Buttons */}
      <View style={styles.controlsContainer}>
        {!isConnected && (
          <TouchableOpacity
            style={[styles.button, styles.connectButton]}
            onPress={handleConnect}
            disabled={state === ConversationState.CONNECTING}
          >
            {state === ConversationState.CONNECTING ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Connect</Text>
            )}
          </TouchableOpacity>
        )}

        {isConnected && !isListening && !isSpeaking && (
          <TouchableOpacity style={[styles.button, styles.listenButton]} onPress={startListening}>
            <Text style={styles.buttonText}>🎤 Start Listening</Text>
          </TouchableOpacity>
        )}

        {isListening && (
          <TouchableOpacity style={[styles.button, styles.stopButton]} onPress={stopListening}>
            <Text style={styles.buttonText}>⏹️ Stop Listening</Text>
          </TouchableOpacity>
        )}

        {isSpeaking && (
          <TouchableOpacity style={[styles.button, styles.interruptButton]} onPress={interrupt}>
            <Text style={styles.buttonText}>✋ Interrupt</Text>
          </TouchableOpacity>
        )}

        {isConnected && (
          <TouchableOpacity style={[styles.button, styles.disconnectButton]} onPress={disconnect}>
            <Text style={styles.buttonText}>Disconnect</Text>
          </TouchableOpacity>
        )}
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
  statusIndicator: {
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
  voiceActivityContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  voiceActivityIndicator: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    backgroundColor: '#e0e0e0',
  },
  voiceActive: {
    backgroundColor: '#4CAF50',
  },
  voiceActivityText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  metricsContainer: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  metricsTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  metricLabel: {
    fontSize: 14,
    color: '#666',
  },
  metricValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  warningText: {
    fontSize: 12,
    color: '#ff9800',
    marginTop: 4,
  },
  transcriptContainer: {
    flex: 1,
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
  performanceContainer: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  performanceTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  controlsContainer: {
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
    backgroundColor: '#4CAF50',
  },
  listenButton: {
    backgroundColor: '#2196F3',
  },
  stopButton: {
    backgroundColor: '#FF9800',
  },
  interruptButton: {
    backgroundColor: '#F44336',
  },
  disconnectButton: {
    backgroundColor: '#9E9E9E',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ConversationScreen;
