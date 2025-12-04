/**
 * Store Tests
 *
 * Tests for Zustand stores
 */

import { useAuthStore } from '../store/authStore';
import { useConversationStore } from '../store/conversationStore';
import { useSettingsStore } from '../store/settingsStore';
import { useUIStore } from '../store/uiStore';

describe('AuthStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    useAuthStore.setState({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isOnboarded: false,
      isLoading: true,
      error: null,
    });
  });

  it('should have initial state', () => {
    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.isAuthenticated).toBe(false);
    expect(state.isOnboarded).toBe(false);
    expect(state.isLoading).toBe(true);
  });

  it('should login user', () => {
    const mockUser = {
      id: '123',
      email: 'test@example.com',
      name: 'Test User',
      createdAt: new Date().toISOString(),
    };

    useAuthStore.getState().login(mockUser, 'access-token', 'refresh-token');

    const state = useAuthStore.getState();
    expect(state.user).toEqual(mockUser);
    expect(state.accessToken).toBe('access-token');
    expect(state.refreshToken).toBe('refresh-token');
    expect(state.isAuthenticated).toBe(true);
  });

  it('should logout user', () => {
    const mockUser = {
      id: '123',
      email: 'test@example.com',
      name: 'Test User',
      createdAt: new Date().toISOString(),
    };

    useAuthStore.getState().login(mockUser, 'access-token', 'refresh-token');
    useAuthStore.getState().logout();

    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.accessToken).toBeNull();
    expect(state.isAuthenticated).toBe(false);
  });

  it('should set onboarded status', () => {
    useAuthStore.getState().setOnboarded(true);
    expect(useAuthStore.getState().isOnboarded).toBe(true);
  });

  it('should set and clear error', () => {
    useAuthStore.getState().setError('Test error');
    expect(useAuthStore.getState().error).toBe('Test error');

    useAuthStore.getState().clearError();
    expect(useAuthStore.getState().error).toBeNull();
  });
});

describe('UIStore', () => {
  beforeEach(() => {
    useUIStore.setState({
      themeMode: 'system',
      isDarkMode: false,
      isGlobalLoading: false,
      loadingMessage: null,
      isModalVisible: false,
      modalContent: null,
      toastMessage: null,
      toastType: null,
    });
  });

  it('should have initial state', () => {
    const state = useUIStore.getState();
    expect(state.themeMode).toBe('system');
    expect(state.isDarkMode).toBe(false);
    expect(state.isGlobalLoading).toBe(false);
  });

  it('should set theme mode', () => {
    useUIStore.getState().setThemeMode('dark');
    expect(useUIStore.getState().themeMode).toBe('dark');
  });

  it('should show and hide toast', () => {
    useUIStore.getState().showToast('Test message', 'success');

    let state = useUIStore.getState();
    expect(state.toastMessage).toBe('Test message');
    expect(state.toastType).toBe('success');

    useUIStore.getState().hideToast();
    state = useUIStore.getState();
    expect(state.toastMessage).toBeNull();
    expect(state.toastType).toBeNull();
  });

  it('should show and hide modal', () => {
    useUIStore.getState().showModal('Modal content');

    let state = useUIStore.getState();
    expect(state.isModalVisible).toBe(true);
    expect(state.modalContent).toBe('Modal content');

    useUIStore.getState().hideModal();
    state = useUIStore.getState();
    expect(state.isModalVisible).toBe(false);
    expect(state.modalContent).toBeNull();
  });
});

describe('ConversationStore', () => {
  beforeEach(() => {
    useConversationStore.setState({
      currentSession: null,
      conversationState: 'idle',
      currentTranscript: '',
      interimTranscript: '',
      currentResponse: '',
      isConnected: false,
      connectionError: null,
      recentSessions: [],
    });
  });

  it('should have initial state', () => {
    const state = useConversationStore.getState();
    expect(state.currentSession).toBeNull();
    expect(state.conversationState).toBe('idle');
    expect(state.isConnected).toBe(false);
  });

  it('should start session', () => {
    useConversationStore.getState().startSession('session-123');

    const state = useConversationStore.getState();
    expect(state.currentSession).not.toBeNull();
    expect(state.currentSession?.id).toBe('session-123');
    expect(state.currentSession?.turns).toEqual([]);
  });

  it('should set conversation state', () => {
    useConversationStore.getState().setConversationState('listening');
    expect(useConversationStore.getState().conversationState).toBe('listening');
  });

  it('should set transcripts', () => {
    useConversationStore.getState().setCurrentTranscript('Hello');
    useConversationStore.getState().setInterimTranscript('Hello world');

    const state = useConversationStore.getState();
    expect(state.currentTranscript).toBe('Hello');
    expect(state.interimTranscript).toBe('Hello world');
  });

  it('should add turn to session', () => {
    useConversationStore.getState().startSession('session-123');

    const turn = {
      id: 'turn-1',
      userTranscript: 'Hello',
      assistantResponse: 'Hi there!',
      timestamp: new Date(),
    };

    useConversationStore.getState().addTurn(turn);

    const state = useConversationStore.getState();
    expect(state.currentSession?.turns).toHaveLength(1);
    expect(state.currentSession?.turns[0]).toEqual(turn);
  });

  it('should end session and add to recent sessions', () => {
    useConversationStore.getState().startSession('session-123');
    useConversationStore.getState().endSession();

    const state = useConversationStore.getState();
    expect(state.currentSession).toBeNull();
    expect(state.recentSessions).toHaveLength(1);
    expect(state.recentSessions[0].id).toBe('session-123');
  });
});

describe('SettingsStore', () => {
  beforeEach(() => {
    useSettingsStore.getState().resetToDefaults();
  });

  it('should have default settings', () => {
    const state = useSettingsStore.getState();
    expect(state.ttsProvider).toBe('xtts-v2');
    expect(state.llmProvider).toBe('gemini-flash');
    expect(state.videoQuality).toBe('auto');
    expect(state.voiceSpeed).toBe(1.0);
  });

  it('should update voice settings', () => {
    useSettingsStore.getState().setVoiceModelId('voice-123');
    useSettingsStore.getState().setTTSProvider('openai-tts');
    useSettingsStore.getState().setVoiceSpeed(1.5);

    const state = useSettingsStore.getState();
    expect(state.voiceModelId).toBe('voice-123');
    expect(state.ttsProvider).toBe('openai-tts');
    expect(state.voiceSpeed).toBe(1.5);
  });

  it('should update AI settings', () => {
    useSettingsStore.getState().setLLMProvider('gpt4-turbo');
    useSettingsStore.getState().setEnableConversationHistory(false);

    const state = useSettingsStore.getState();
    expect(state.llmProvider).toBe('gpt4-turbo');
    expect(state.enableConversationHistory).toBe(false);
  });

  it('should reset to defaults', () => {
    useSettingsStore.getState().setLLMProvider('gpt4-turbo');
    useSettingsStore.getState().setVoiceSpeed(2.0);
    useSettingsStore.getState().resetToDefaults();

    const state = useSettingsStore.getState();
    expect(state.llmProvider).toBe('gemini-flash');
    expect(state.voiceSpeed).toBe(1.0);
  });
});
