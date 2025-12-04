/**
 * Conversation Store
 *
 * Zustand store for conversation state management
 */

import { create } from 'zustand';

export type ConversationState =
  | 'idle'
  | 'listening'
  | 'processing'
  | 'speaking'
  | 'interrupted'
  | 'error';

export interface ConversationTurn {
  id: string;
  userTranscript: string;
  assistantResponse: string;
  timestamp: Date;
  sources?: string[];
  metrics?: {
    asrLatencyMs: number;
    ragLatencyMs: number;
    llmLatencyMs: number;
    ttsLatencyMs: number;
    totalLatencyMs: number;
  };
}

export interface ConversationSession {
  id: string;
  startedAt: Date;
  endedAt?: Date;
  turns: ConversationTurn[];
  totalDurationMs: number;
}

export interface ConversationStoreState {
  // Current session
  currentSession: ConversationSession | null;
  conversationState: ConversationState;

  // Current turn
  currentTranscript: string;
  interimTranscript: string;
  currentResponse: string;

  // Connection
  isConnected: boolean;
  connectionError: string | null;

  // History
  recentSessions: ConversationSession[];

  // Actions
  startSession: (sessionId: string) => void;
  endSession: () => void;
  setConversationState: (state: ConversationState) => void;
  setCurrentTranscript: (transcript: string) => void;
  setInterimTranscript: (transcript: string) => void;
  setCurrentResponse: (response: string) => void;
  addTurn: (turn: ConversationTurn) => void;
  setConnected: (isConnected: boolean) => void;
  setConnectionError: (error: string | null) => void;
  clearCurrentTurn: () => void;
  reset: () => void;
}

export const useConversationStore = create<ConversationStoreState>((set, get) => ({
  // Initial state
  currentSession: null,
  conversationState: 'idle',
  currentTranscript: '',
  interimTranscript: '',
  currentResponse: '',
  isConnected: false,
  connectionError: null,
  recentSessions: [],

  // Actions
  startSession: (sessionId) =>
    set({
      currentSession: {
        id: sessionId,
        startedAt: new Date(),
        turns: [],
        totalDurationMs: 0,
      },
      conversationState: 'idle',
      currentTranscript: '',
      interimTranscript: '',
      currentResponse: '',
    }),

  endSession: () => {
    const { currentSession, recentSessions } = get();
    if (currentSession) {
      const endedSession = {
        ...currentSession,
        endedAt: new Date(),
        totalDurationMs: Date.now() - currentSession.startedAt.getTime(),
      };
      set({
        currentSession: null,
        conversationState: 'idle',
        recentSessions: [endedSession, ...recentSessions].slice(0, 10), // Keep last 10 sessions
      });
    }
  },

  setConversationState: (state) =>
    set({
      conversationState: state,
    }),

  setCurrentTranscript: (transcript) =>
    set({
      currentTranscript: transcript,
    }),

  setInterimTranscript: (transcript) =>
    set({
      interimTranscript: transcript,
    }),

  setCurrentResponse: (response) =>
    set({
      currentResponse: response,
    }),

  addTurn: (turn) => {
    const { currentSession } = get();
    if (currentSession) {
      set({
        currentSession: {
          ...currentSession,
          turns: [...currentSession.turns, turn],
        },
      });
    }
  },

  setConnected: (isConnected) =>
    set({
      isConnected,
      connectionError: isConnected ? null : get().connectionError,
    }),

  setConnectionError: (error) =>
    set({
      connectionError: error,
      isConnected: error ? false : get().isConnected,
    }),

  clearCurrentTurn: () =>
    set({
      currentTranscript: '',
      interimTranscript: '',
      currentResponse: '',
    }),

  reset: () =>
    set({
      currentSession: null,
      conversationState: 'idle',
      currentTranscript: '',
      interimTranscript: '',
      currentResponse: '',
      isConnected: false,
      connectionError: null,
    }),
}));
