/**
 * ConversationManager Service
 *
 * Orchestrates real-time conversations by integrating:
 * - Audio recording and streaming (AudioManager)
 * - WebSocket communication (WebSocketClient)
 * - Conversation state management
 * - Audio playback
 */

import type {
  AudioChunkMessage,
  InterruptionMessage,
  EndUtteranceMessage,
  TranscriptMessage,
  ResponseAudioMessage,
  ResponseVideoMessage,
  ResponseStartMessage,
  ResponseEndMessage,
  ErrorMessage,
} from '@clone/shared-types';

import AudioManager, {
  AudioRecordingState,
  type AudioChunk,
  type AudioQualityMetrics,
  type AudioManagerConfig,
} from './AudioManager';
import AudioPlaybackManager, {
  AudioPlaybackState,
  type AudioChunkData,
  type PlaybackConfig,
} from './AudioPlaybackManager';
import { getWebSocketClient, ConnectionState, type WebSocketClient } from './WebSocketClient';

export enum ConversationState {
  IDLE = 'idle',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  LISTENING = 'listening',
  PROCESSING = 'processing',
  SPEAKING = 'speaking',
  INTERRUPTED = 'interrupted',
  ERROR = 'error',
  DISCONNECTED = 'disconnected',
}

export interface ConversationManagerConfig {
  websocketUrl: string;
  authToken: string;
  audioConfig?: Partial<AudioManagerConfig>;
  playbackConfig?: Partial<PlaybackConfig>;
}

export interface ConversationCallbacks {
  onStateChange?: (state: ConversationState) => void;
  onTranscript?: (transcript: string, isFinal: boolean, confidence: number) => void;
  onResponseStart?: (turnId: string) => void;
  onResponseAudio?: (audioData: string, sequenceNumber: number) => void;
  onResponseVideo?: (frameData: string, sequenceNumber: number, format: 'jpeg' | 'h264') => void;
  onResponseEnd?: (metrics: ResponseEndMessage['metrics']) => void;
  onError?: (error: string, recoverable: boolean) => void;
  onAudioQuality?: (metrics: AudioQualityMetrics) => void;
  onVoiceActivity?: (isActive: boolean) => void;
  onPlaybackStateChange?: (state: AudioPlaybackState) => void;
  onPlaybackProgress?: (position: number, duration: number) => void;
  onPlaybackBufferUpdate?: (bufferedDuration: number) => void;
}

export class ConversationManager {
  private wsClient: WebSocketClient;
  private audioManager: AudioManager;
  private playbackManager: AudioPlaybackManager;
  private callbacks: ConversationCallbacks;
  private state: ConversationState = ConversationState.IDLE;
  private sessionId: string = '';
  private silenceTimer: NodeJS.Timeout | null = null;
  private readonly SILENCE_THRESHOLD_MS = 500;
  private turnIndex: number = 0;
  private isMonitoringForInterruption: boolean = false;
  private interruptionDetectionTimer: NodeJS.Timeout | null = null;
  private readonly INTERRUPTION_THRESHOLD_MS = 200; // 200ms of continuous speech to trigger interruption

  constructor(config: ConversationManagerConfig, callbacks: ConversationCallbacks = {}) {
    this.callbacks = callbacks;

    // Initialize WebSocket client (using singleton)
    this.wsClient = getWebSocketClient();

    // Set auth token if provided
    if (config.authToken) {
      this.wsClient.setAuthToken(config.authToken);
    }

    // Initialize Audio Manager
    this.audioManager = new AudioManager(config.audioConfig, {
      onChunk: this.handleAudioChunk.bind(this),
      onQualityUpdate: this.handleAudioQuality.bind(this),
      onStateChange: this.handleAudioStateChange.bind(this),
      onError: this.handleAudioError.bind(this),
      onVoiceActivityDetected: this.handleVoiceActivity.bind(this),
    });

    // Initialize Audio Playback Manager
    this.playbackManager = new AudioPlaybackManager(config.playbackConfig, {
      onStateChange: this.handlePlaybackStateChange.bind(this),
      onProgress: this.handlePlaybackProgress.bind(this),
      onBufferUpdate: this.handlePlaybackBufferUpdate.bind(this),
      onPlaybackComplete: this.handlePlaybackComplete.bind(this),
      onError: this.handlePlaybackError.bind(this),
      onInterruption: this.handlePlaybackInterruption.bind(this),
    });

    this.setupWebSocketHandlers();
  }

  /**
   * Setup WebSocket message handlers
   */
  private setupWebSocketHandlers(): void {
    // Handle session creation
    this.wsClient.on('session_created', (data: unknown) => {
      const sessionData = data as { sessionId: string; userId: string; isGuest: boolean };
      this.sessionId = sessionData.sessionId;

      // Update auth store with guest status
      if (sessionData.isGuest !== undefined) {
        const { useAuthStore } = require('../store/authStore');
        useAuthStore.getState().setIsGuest(sessionData.isGuest);
      }
    });

    this.wsClient.on('transcript', (message: unknown) => {
      const msg = message as TranscriptMessage;
      this.callbacks.onTranscript?.(msg.transcript, msg.isFinal, msg.confidence);
    });

    this.wsClient.on('response_start', (message: unknown) => {
      const msg = message as ResponseStartMessage;
      this.setState(ConversationState.SPEAKING);
      this.callbacks.onResponseStart?.(msg.turnId);

      // Start monitoring for interruption during clone response
      this.startInterruptionMonitoring();
    });

    this.wsClient.on('response_audio', (message: unknown) => {
      const msg = message as ResponseAudioMessage;
      this.callbacks.onResponseAudio?.(msg.audioData, msg.sequenceNumber);

      // Add audio chunk to playback queue
      const audioChunk: AudioChunkData = {
        data: msg.audioData,
        sequenceNumber: msg.sequenceNumber,
        timestamp: msg.timestamp,
        audioTimestamp: msg.timestamp,
      };
      this.playbackManager.addChunk(audioChunk);
    });

    this.wsClient.on('response_video', (message: unknown) => {
      const msg = message as ResponseVideoMessage;
      this.callbacks.onResponseVideo?.(msg.frameData, msg.sequenceNumber, msg.format);
    });

    this.wsClient.on('response_end', (message: unknown) => {
      const msg = message as ResponseEndMessage;
      this.setState(ConversationState.IDLE);
      this.callbacks.onResponseEnd?.(msg.metrics);

      // Stop monitoring for interruption when response ends
      this.stopInterruptionMonitoring();
    });

    this.wsClient.on('error', (message: unknown) => {
      const msg = message as ErrorMessage;
      this.handleError(msg.errorMessage, msg.recoverable);
    });

    // Handle connection state changes
    this.wsClient.onConnectionStateChange((state) => {
      if (state === ConnectionState.CONNECTED) {
        this.setState(ConversationState.CONNECTED);
      } else if (state === ConnectionState.DISCONNECTED) {
        this.setState(ConversationState.DISCONNECTED);
      } else if (state === ConnectionState.ERROR) {
        this.handleError('WebSocket connection error', true);
      }
    });

    // Handle WebSocket errors
    this.wsClient.on('error', (error: unknown) => {
      const errorMessage =
        error && typeof error === 'object' && 'message' in error
          ? String(error.message)
          : 'WebSocket error';
      this.handleError(errorMessage, false);
    });
  }

  /**
   * Connect to the WebSocket server
   */
  async connect(): Promise<void> {
    console.log('[ConversationManager] connect() called');
    try {
      console.log('[ConversationManager] Setting state to CONNECTING');
      this.setState(ConversationState.CONNECTING);

      console.log('[ConversationManager] Calling wsClient.connect()');
      await this.wsClient.connect();

      console.log('[ConversationManager] Connection successful, generating session ID');
      this.sessionId = this.generateSessionId();
      this.setState(ConversationState.CONNECTED);
      console.log('[ConversationManager] Connected with session:', this.sessionId);
    } catch (error) {
      console.error('[ConversationManager] Connection failed:', error);
      this.handleError(`Failed to connect: ${error}`, true);
      throw error;
    }
  }

  /**
   * Disconnect from the WebSocket server
   */
  disconnect(): void {
    this.wsClient.disconnect();
    this.setState(ConversationState.DISCONNECTED);
  }

  /**
   * Start listening for user speech
   */
  async startListening(): Promise<void> {
    try {
      if (this.state !== ConversationState.CONNECTED && this.state !== ConversationState.IDLE) {
        throw new Error(`Cannot start listening in state: ${this.state}`);
      }

      // Request microphone permissions
      const hasPermission = await this.audioManager.checkPermissions();
      if (!hasPermission) {
        const granted = await this.audioManager.requestPermissions();
        if (!granted) {
          throw new Error('Microphone permission denied');
        }
      }

      // Start recording
      await this.audioManager.startRecording();
      this.setState(ConversationState.LISTENING);
    } catch (error) {
      this.handleError(`Failed to start listening: ${error}`, true);
      throw error;
    }
  }

  /**
   * Stop listening
   */
  async stopListening(): Promise<void> {
    try {
      await this.audioManager.stopRecording();
      this.sendEndUtterance();
      this.setState(ConversationState.PROCESSING);
    } catch (error) {
      this.handleError(`Failed to stop listening: ${error}`, true);
      throw error;
    }
  }

  /**
   * Interrupt the current response
   */
  async interrupt(): Promise<void> {
    try {
      // Send interruption message with current turnIndex
      const message: InterruptionMessage = {
        type: 'interruption',
        sessionId: this.sessionId,
        timestamp: Date.now(),
        turnIndex: this.turnIndex,
      };
      this.wsClient.send(message);

      // Stop audio playback immediately (< 50ms target)
      await this.playbackManager.stop();

      // Clear audio/video response queues
      this.playbackManager.clearQueue();

      // Stop monitoring for interruption
      this.stopInterruptionMonitoring();

      this.setState(ConversationState.INTERRUPTED);

      // Increment turn index for new conversation turn
      this.turnIndex++;

      // Start listening again for new query
      await this.startListening();
    } catch (error) {
      this.handleError(`Failed to interrupt: ${error}`, true);
      throw error;
    }
  }

  /**
   * Start monitoring for interruption during clone response playback
   */
  private startInterruptionMonitoring(): void {
    if (this.isMonitoringForInterruption) {
      return;
    }

    this.isMonitoringForInterruption = true;

    // Continue monitoring microphone during playback
    // The AudioManager's VAD will detect speech onset
    // We just need to track if speech continues for INTERRUPTION_THRESHOLD_MS
  }

  /**
   * Stop monitoring for interruption
   */
  private stopInterruptionMonitoring(): void {
    this.isMonitoringForInterruption = false;

    if (this.interruptionDetectionTimer) {
      clearTimeout(this.interruptionDetectionTimer);
      this.interruptionDetectionTimer = null;
    }
  }

  /**
   * Handle audio chunk from AudioManager
   */
  private handleAudioChunk(chunk: AudioChunk): void {
    try {
      const message: AudioChunkMessage = {
        type: 'audio_chunk',
        sessionId: this.sessionId,
        sequenceNumber: chunk.sequenceNumber,
        audioData: chunk.data,
        timestamp: chunk.timestamp,
      };
      this.wsClient.send(message);
    } catch (error) {
      console.error('Failed to send audio chunk:', error);
    }
  }

  /**
   * Handle audio quality updates
   */
  private handleAudioQuality(metrics: AudioQualityMetrics): void {
    this.callbacks.onAudioQuality?.(metrics);

    // Warn if audio quality is poor
    if (metrics.isClipping) {
      console.warn('Audio clipping detected - volume too high');
    }
    if (metrics.snr < 10) {
      console.warn('Low signal-to-noise ratio - noisy environment');
    }
  }

  /**
   * Handle audio state changes
   */
  private handleAudioStateChange(audioState: AudioRecordingState): void {
    if (audioState === AudioRecordingState.ERROR) {
      this.setState(ConversationState.ERROR);
    }
  }

  /**
   * Handle audio errors
   */
  private handleAudioError(error: Error): void {
    this.handleError(error.message, true);
  }

  /**
   * Handle voice activity detection
   */
  private handleVoiceActivity(isActive: boolean): void {
    this.callbacks.onVoiceActivity?.(isActive);

    // Handle interruption detection during clone response
    if (this.isMonitoringForInterruption && this.state === ConversationState.SPEAKING) {
      if (isActive) {
        // User started speaking during clone response
        // Start interruption detection timer
        if (!this.interruptionDetectionTimer) {
          this.interruptionDetectionTimer = setTimeout(() => {
            // User has been speaking for INTERRUPTION_THRESHOLD_MS
            // Trigger interruption
            this.interrupt().catch((error) => {
              console.error('Failed to trigger interruption:', error);
            });
          }, this.INTERRUPTION_THRESHOLD_MS);
        }
      } else {
        // User stopped speaking, cancel interruption detection
        if (this.interruptionDetectionTimer) {
          clearTimeout(this.interruptionDetectionTimer);
          this.interruptionDetectionTimer = null;
        }
      }
      return;
    }

    // Normal voice activity handling during listening state
    if (this.state === ConversationState.LISTENING) {
      // Reset silence timer when voice is detected
      if (isActive) {
        if (this.silenceTimer) {
          clearTimeout(this.silenceTimer);
          this.silenceTimer = null;
        }
      } else {
        // Start silence timer when voice stops
        if (!this.silenceTimer) {
          this.silenceTimer = setTimeout(() => {
            this.stopListening().catch((error) => {
              console.error('Failed to stop listening after silence:', error);
            });
          }, this.SILENCE_THRESHOLD_MS);
        }
      }
    }
  }

  /**
   * Send end utterance message
   */
  private sendEndUtterance(): void {
    const message: EndUtteranceMessage = {
      type: 'end_utterance',
      sessionId: this.sessionId,
      timestamp: Date.now(),
    };
    this.wsClient.send(message);
  }

  /**
   * Handle errors
   */
  private handleError(errorMessage: string, recoverable: boolean): void {
    console.error('ConversationManager error:', errorMessage);
    this.setState(ConversationState.ERROR);
    this.callbacks.onError?.(errorMessage, recoverable);
  }

  /**
   * Set conversation state
   */
  private setState(state: ConversationState): void {
    this.state = state;
    this.callbacks.onStateChange?.(state);
  }

  /**
   * Generate a unique session ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Get current state
   */
  getState(): ConversationState {
    return this.state;
  }

  /**
   * Get session ID
   */
  getSessionId(): string {
    return this.sessionId;
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.wsClient.isConnected();
  }

  /**
   * Handle playback state changes
   */
  private handlePlaybackStateChange(state: AudioPlaybackState): void {
    this.callbacks.onPlaybackStateChange?.(state);

    // Update conversation state based on playback state
    if (state === AudioPlaybackState.PLAYING && this.state !== ConversationState.SPEAKING) {
      this.setState(ConversationState.SPEAKING);
    } else if (state === AudioPlaybackState.IDLE && this.state === ConversationState.SPEAKING) {
      this.setState(ConversationState.IDLE);
    }
  }

  /**
   * Handle playback progress
   */
  private handlePlaybackProgress(position: number, duration: number): void {
    this.callbacks.onPlaybackProgress?.(position, duration);
  }

  /**
   * Handle playback buffer updates
   */
  private handlePlaybackBufferUpdate(bufferedDuration: number): void {
    this.callbacks.onPlaybackBufferUpdate?.(bufferedDuration);
  }

  /**
   * Handle playback completion
   */
  private handlePlaybackComplete(): void {
    // Playback finished, return to idle state
    if (this.state === ConversationState.SPEAKING) {
      this.setState(ConversationState.IDLE);
    }
  }

  /**
   * Handle playback errors
   */
  private handlePlaybackError(error: Error): void {
    this.handleError(`Playback error: ${error.message}`, true);
  }

  /**
   * Handle playback interruptions (phone calls, notifications)
   */
  private handlePlaybackInterruption(type: 'begin' | 'end'): void {
    if (type === 'begin') {
      // Pause conversation on interruption
      this.setState(ConversationState.INTERRUPTED);
    } else {
      // Resume conversation after interruption
      if (this.state === ConversationState.INTERRUPTED) {
        this.setState(ConversationState.IDLE);
      }
    }
  }

  /**
   * Control playback volume (0.0 - 1.0)
   */
  async setVolume(volume: number): Promise<void> {
    await this.playbackManager.setVolume(volume);
  }

  /**
   * Mute/unmute playback
   */
  async setMuted(muted: boolean): Promise<void> {
    await this.playbackManager.setMuted(muted);
  }

  /**
   * Set playback speed (0.5x - 2.0x)
   */
  async setPlaybackSpeed(speed: number): Promise<void> {
    await this.playbackManager.setPlaybackSpeed(speed);
  }

  /**
   * Get playback state
   */
  getPlaybackState(): AudioPlaybackState {
    return this.playbackManager.getState();
  }

  /**
   * Check if audio is playing
   */
  isPlaying(): boolean {
    return this.playbackManager.isPlaying();
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    try {
      if (this.silenceTimer) {
        clearTimeout(this.silenceTimer);
        this.silenceTimer = null;
      }

      if (this.interruptionDetectionTimer) {
        clearTimeout(this.interruptionDetectionTimer);
        this.interruptionDetectionTimer = null;
      }

      this.stopInterruptionMonitoring();

      await this.audioManager.cleanup();
      await this.playbackManager.cleanup();
      this.wsClient.disconnect();
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  }
}

export default ConversationManager;
