/**
 * useConversation Hook
 *
 * React hook for managing real-time conversations with the AI clone.
 * Provides easy-to-use interface for:
 * - Starting/stopping conversations
 * - Handling transcripts and responses
 * - Managing conversation state
 * - Audio quality monitoring
 */

import type { ResponseEndMessage } from '@clone/shared-types';
import { useState, useEffect, useCallback, useRef } from 'react';

import type { AudioQualityMetrics } from '../services/AudioManager';
import ConversationManager, {
  ConversationState,
  type ConversationManagerConfig,
  type ConversationCallbacks,
} from '../services/ConversationManager';

export interface UseConversationOptions {
  websocketUrl: string;
  authToken: string;
  autoConnect?: boolean;
}

export interface ConversationData {
  transcript: string;
  isFinalTranscript: boolean;
  transcriptConfidence: number;
  responseAudio: Array<{ data: string; sequence: number }>;
  responseVideo: Array<{ data: string; sequence: number; format: 'jpeg' | 'h264' }>;
  currentTurnId: string;
  metrics: ResponseEndMessage['metrics'] | null;
  audioQuality: AudioQualityMetrics | null;
  isVoiceActive: boolean;
}

export interface UseConversationReturn {
  // State
  state: ConversationState;
  isConnected: boolean;
  isListening: boolean;
  isSpeaking: boolean;
  error: string | null;
  data: ConversationData;

  // Actions
  connect: () => Promise<void>;
  disconnect: () => void;
  startListening: () => Promise<void>;
  stopListening: () => Promise<void>;
  interrupt: () => Promise<void>;

  // Utilities
  sessionId: string;
}

export function useConversation(options: UseConversationOptions): UseConversationReturn {
  const [state, setState] = useState<ConversationState>(ConversationState.IDLE);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string>('');

  const [data, setData] = useState<ConversationData>({
    transcript: '',
    isFinalTranscript: false,
    transcriptConfidence: 0,
    responseAudio: [],
    responseVideo: [],
    currentTurnId: '',
    metrics: null,
    audioQuality: null,
    isVoiceActive: false,
  });

  const managerRef = useRef<ConversationManager | null>(null);

  // Initialize ConversationManager
  useEffect(() => {
    const callbacks: ConversationCallbacks = {
      onStateChange: (newState) => {
        setState(newState);
        if (newState === ConversationState.ERROR) {
          // Error state is handled by onError callback
        }
      },

      onTranscript: (transcript, isFinal, confidence) => {
        setData((prev) => ({
          ...prev,
          transcript,
          isFinalTranscript: isFinal,
          transcriptConfidence: confidence,
        }));
      },

      onResponseStart: (turnId) => {
        setData((prev) => ({
          ...prev,
          currentTurnId: turnId,
          responseAudio: [],
          responseVideo: [],
          metrics: null,
        }));
      },

      onResponseAudio: (audioData, sequenceNumber) => {
        setData((prev) => ({
          ...prev,
          responseAudio: [...prev.responseAudio, { data: audioData, sequence: sequenceNumber }],
        }));
      },

      onResponseVideo: (frameData, sequenceNumber, format) => {
        setData((prev) => ({
          ...prev,
          responseVideo: [
            ...prev.responseVideo,
            { data: frameData, sequence: sequenceNumber, format },
          ],
        }));
      },

      onResponseEnd: (metrics) => {
        setData((prev) => ({
          ...prev,
          metrics,
        }));
      },

      onError: (errorMessage, recoverable) => {
        setError(errorMessage);
        console.error('Conversation error:', errorMessage, 'Recoverable:', recoverable);
      },

      onAudioQuality: (metrics) => {
        setData((prev) => ({
          ...prev,
          audioQuality: metrics,
        }));
      },

      onVoiceActivity: (isActive) => {
        setData((prev) => ({
          ...prev,
          isVoiceActive: isActive,
        }));
      },
    };

    const config: ConversationManagerConfig = {
      websocketUrl: options.websocketUrl,
      authToken: options.authToken,
    };

    managerRef.current = new ConversationManager(config, callbacks);

    // Auto-connect if specified
    if (options.autoConnect) {
      managerRef.current.connect().catch((err) => {
        setError(`Auto-connect failed: ${err}`);
      });
    }

    // Cleanup on unmount
    return () => {
      if (managerRef.current) {
        managerRef.current.cleanup().catch((err) => {
          console.error('Cleanup error:', err);
        });
      }
    };
  }, [options.websocketUrl, options.authToken, options.autoConnect]);

  // Update session ID when connected
  useEffect(() => {
    if (managerRef.current && state === ConversationState.CONNECTED) {
      setSessionId(managerRef.current.getSessionId());
    }
  }, [state]);

  // Actions
  const connect = useCallback(async () => {
    if (!managerRef.current) {
      throw new Error('ConversationManager not initialized');
    }
    setError(null);
    await managerRef.current.connect();
  }, []);

  const disconnect = useCallback(() => {
    if (!managerRef.current) {
      return;
    }
    managerRef.current.disconnect();
  }, []);

  const startListening = useCallback(async () => {
    if (!managerRef.current) {
      throw new Error('ConversationManager not initialized');
    }
    setError(null);
    await managerRef.current.startListening();
  }, []);

  const stopListening = useCallback(async () => {
    if (!managerRef.current) {
      throw new Error('ConversationManager not initialized');
    }
    await managerRef.current.stopListening();
  }, []);

  const interrupt = useCallback(async () => {
    if (!managerRef.current) {
      throw new Error('ConversationManager not initialized');
    }
    await managerRef.current.interrupt();
  }, []);

  // Computed state
  const isConnected =
    state === ConversationState.CONNECTED ||
    state === ConversationState.LISTENING ||
    state === ConversationState.PROCESSING ||
    state === ConversationState.SPEAKING;

  const isListening = state === ConversationState.LISTENING;
  const isSpeaking = state === ConversationState.SPEAKING;

  return {
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
  };
}

export default useConversation;
