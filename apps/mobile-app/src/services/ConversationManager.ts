/**
 * ConversationManager Service
 *
 * Orchestrates real-time conversations by integrating:
 * - Audio recording and streaming (AudioManager)
 * - WebSocket communication (WebSocketClient)
 * - Conversation state management
 * - Audio playback
 */

import { WebSocketClient } from '@clone/api-client';
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
}

export class ConversationManager {
  private wsClient: WebSocketClient;
  private audioManager: AudioManager;
  private config: ConversationManagerConfig;
  private callbacks: ConversationCallbacks;
  private state: ConversationState = ConversationState.IDLE;
  private sessionId: string = '';
  private currentTurnId: string = '';
  private silenceTimer: NodeJS.Timeout | null = null;
  private readonly SILENCE_THRESHOLD_MS = 500;

  constructor(config: ConversationManagerConfig, callbacks: ConversationCallbacks = {}) {
    this.config = config;
    this.callbacks = callbacks;

    // Initialize WebSocket client
    this.wsClient = new WebSocketClient({
      url: config.websocketUrl,
      token: config.authToken,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    // Initialize Audio Manager
    this.audioManager = new AudioManager(config.audioConfig, {
      onChunk: this.handleAudioChunk.bind(this),
      onQualityUpdate: this.handleAudioQuality.bind(this),
      onStateChange: this.handleAudioStateChange.bind(this),
      onError: this.handleAudioError.bind(this),
      onVoiceActivityDetected: this.handleVoiceActivity.bind(this),
    });

    this.setupWebSocketHandlers();
  }

  /**
   * Setup WebSocket message handlers
   */
  private setupWebSocketHandlers(): void {
    this.wsClient.on('transcript', (message) => {
      const msg = message as TranscriptMessage;
      this.callbacks.onTranscript?.(msg.transcript, msg.isFinal, msg.confidence);
    });

    this.wsClient.on('response_start', (message) => {
      const msg = message as ResponseStartMessage;
      this.currentTurnId = msg.turnId;
      this.setState(ConversationState.SPEAKING);
      this.callbacks.onResponseStart?.(msg.turnId);
    });

    this.wsClient.on('response_audio', (message) => {
      const msg = message as ResponseAudioMessage;
      this.callbacks.onResponseAudio?.(msg.audioData, msg.sequenceNumber);
    });

    this.wsClient.on('response_video', (message) => {
      const msg = message as ResponseVideoMessage;
      this.callbacks.onResponseVideo?.(msg.frameData, msg.sequenceNumber, msg.format);
    });

    this.wsClient.on('response_end', (message) => {
      const msg = message as ResponseEndMessage;
      this.setState(ConversationState.IDLE);
      this.callbacks.onResponseEnd?.(msg.metrics);
    });

    this.wsClient.on('error', (message) => {
      const msg = message as ErrorMessage;
      this.handleError(msg.errorMessage, msg.recoverable);
    });

    this.wsClient.onConnect(() => {
      this.setState(ConversationState.CONNECTED);
    });

    this.wsClient.onDisconnect(() => {
      this.setState(ConversationState.DISCONNECTED);
    });

    this.wsClient.onError((error) => {
      this.handleError(error.message, false);
    });
  }

  /**
   * Connect to the WebSocket server
   */
  async connect(): Promise<void> {
    try {
      this.setState(ConversationState.CONNECTING);
      await this.wsClient.connect();
      this.sessionId = this.generateSessionId();
      this.setState(ConversationState.CONNECTED);
    } catch (error) {
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
      // Send interruption message
      const message: InterruptionMessage = {
        type: 'interruption',
        sessionId: this.sessionId,
        timestamp: Date.now(),
      };
      this.wsClient.send(message);

      // Stop any ongoing playback (to be implemented in audio playback service)
      this.setState(ConversationState.INTERRUPTED);

      // Start listening again
      await this.startListening();
    } catch (error) {
      this.handleError(`Failed to interrupt: ${error}`, true);
      throw error;
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

    // Reset silence timer when voice is detected
    if (isActive) {
      if (this.silenceTimer) {
        clearTimeout(this.silenceTimer);
        this.silenceTimer = null;
      }
    } else {
      // Start silence timer when voice stops
      if (!this.silenceTimer && this.state === ConversationState.LISTENING) {
        this.silenceTimer = setTimeout(() => {
          this.stopListening().catch((error) => {
            console.error('Failed to stop listening after silence:', error);
          });
        }, this.SILENCE_THRESHOLD_MS);
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
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    try {
      if (this.silenceTimer) {
        clearTimeout(this.silenceTimer);
        this.silenceTimer = null;
      }
      await this.audioManager.cleanup();
      this.wsClient.disconnect();
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  }
}

export default ConversationManager;
