/**
 * AudioPlaybackManager Service (Expo Compatible)
 *
 * Handles audio playback for TTS-generated responses using expo-audio.
 */

import { createAudioPlayer, AudioPlayer, AudioStatus, setAudioModeAsync } from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';
import { AppState, type AppStateStatus } from 'react-native';

export enum AudioPlaybackState {
  IDLE = 'idle',
  BUFFERING = 'buffering',
  PLAYING = 'playing',
  PAUSED = 'paused',
  STOPPED = 'stopped',
  ERROR = 'error',
}

export interface AudioChunkData {
  data: string;
  sequenceNumber: number;
  timestamp: number;
  audioTimestamp?: number;
}

export interface PlaybackConfig {
  bufferSize: number;
  syncThreshold: number;
  enableCrossfade: boolean;
  crossfadeDuration: number;
  playbackSpeed: number;
  volume: number;
  enableDucking: boolean;
}

export interface PlaybackCallbacks {
  onStateChange?: (state: AudioPlaybackState) => void;
  onProgress?: (position: number, duration: number) => void;
  onBufferUpdate?: (bufferedDuration: number) => void;
  onPlaybackComplete?: () => void;
  onError?: (error: Error) => void;
  onAudioTimestamp?: (timestamp: number) => void;
  onInterruption?: (type: 'begin' | 'end') => void;
}

const DEFAULT_CONFIG: PlaybackConfig = {
  bufferSize: 300,
  syncThreshold: 50,
  enableCrossfade: false,
  crossfadeDuration: 100,
  playbackSpeed: 1.0,
  volume: 1.0,
  enableDucking: true,
};

export class AudioPlaybackManager {
  private player: AudioPlayer | null = null;
  private config: PlaybackConfig;
  private callbacks: PlaybackCallbacks;
  private state: AudioPlaybackState = AudioPlaybackState.IDLE;
  private playbackQueue: AudioChunkData[] = [];
  private isProcessingQueue: boolean = false;
  private bufferedDuration: number = 0;
  private currentPosition: number = 0;
  private isMuted: boolean = false;
  private appStateSubscription: ReturnType<typeof AppState.addEventListener> | null = null;

  constructor(config: Partial<PlaybackConfig> = {}, callbacks: PlaybackCallbacks = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.callbacks = callbacks;
    this.setupAudioSession();
    this.setupAppStateListener();
  }

  private async setupAudioSession(): Promise<void> {
    try {
      await setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
        shouldPlayInBackground: true,
        interruptionModeAndroid: this.config.enableDucking ? 'duckOthers' : 'doNotMix',
        interruptionMode: 'doNotMix',
        shouldRouteThroughEarpiece: false,
      });
    } catch (error) {
      console.error('Failed to setup audio session:', error);
    }
  }

  private setupAppStateListener(): void {
    this.appStateSubscription = AppState.addEventListener(
      'change',
      this.handleAppStateChange.bind(this)
    );
  }

  private handleAppStateChange(nextAppState: AppStateStatus): void {
    if (nextAppState === 'background' || nextAppState === 'inactive') {
      this.handleInterruption('begin');
    } else if (nextAppState === 'active') {
      this.handleInterruption('end');
    }
  }

  private handleInterruption(type: 'begin' | 'end'): void {
    this.callbacks.onInterruption?.(type);
    if (type === 'begin' && this.state === AudioPlaybackState.PLAYING) {
      this.pause().catch((e) => console.error('Pause on interrupt failed', e));
    }
  }

  addChunk(chunk: AudioChunkData): void {
    this.playbackQueue.push(chunk);
    this.bufferedDuration += this.estimateChunkDuration(chunk);
    this.callbacks.onBufferUpdate?.(this.bufferedDuration);
    if (!this.isProcessingQueue && this.shouldStartPlayback()) {
      this.processQueue().catch((e) => console.error('Queue processing failed', e));
    }
  }

  private shouldStartPlayback(): boolean {
    return this.bufferedDuration >= this.config.bufferSize;
  }

  private estimateChunkDuration(chunk: AudioChunkData): number {
    const dataSize = chunk.data.length * 0.75;
    return (dataSize / 32) * 1000;
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue) return;
    this.isProcessingQueue = true;
    this.setState(AudioPlaybackState.BUFFERING);
    try {
      while (this.playbackQueue.length > 0) {
        const chunk = this.playbackQueue.shift();
        if (!chunk) break;
        await this.playChunk(chunk);
        this.bufferedDuration -= this.estimateChunkDuration(chunk);
        this.callbacks.onBufferUpdate?.(this.bufferedDuration);
      }
      this.setState(AudioPlaybackState.IDLE);
      this.callbacks.onPlaybackComplete?.();
    } catch (error) {
      this.handleError(new Error(`Queue processing failed: ${error}`));
    } finally {
      this.isProcessingQueue = false;
    }
  }

  private async playChunk(chunk: AudioChunkData): Promise<void> {
    const tempUri = FileSystem.cacheDirectory + `audio_chunk_${chunk.sequenceNumber}.wav`;
    await FileSystem.writeAsStringAsync(tempUri, chunk.data, {
      encoding: FileSystem.EncodingType.Base64,
    });

    // Create new player for this chunk
    const player = createAudioPlayer(tempUri);
    this.player = player;

    // Configure player
    player.volume = this.isMuted ? 0 : this.config.volume;
    player.playbackRate = this.config.playbackSpeed;

    // Setup listener
    const subscription = player.addListener('playbackStatusUpdate', (status) => {
      this.onPlaybackStatusUpdate(status);
    });

    this.setState(AudioPlaybackState.PLAYING);
    player.play();

    await new Promise<void>((resolve) => {
      const checkStatus = () => {
        if (!this.player) {
          resolve();
          return;
        }

        // Check if finished
        // Note: expo-audio might not report didJustFinish in the same way
        // We might need to listen to status updates or poll
        if (player.currentTime >= player.duration && player.duration > 0) {
          resolve();
        } else if (!player.isLoaded) {
          resolve();
        } else {
          setTimeout(checkStatus, 100);
        }
      };
      checkStatus();
    });

    subscription.remove();
    player.remove();
    this.player = null;
    await FileSystem.deleteAsync(tempUri, { idempotent: true });
  }

  private onPlaybackStatusUpdate(status: AudioStatus): void {
    if (!status.isLoaded) return;
    this.currentPosition = (status.currentTime || 0) * 1000; // Convert to ms
    const duration = (status.duration || 0) * 1000; // Convert to ms
    this.callbacks.onProgress?.(this.currentPosition, duration);
  }

  async play(): Promise<void> {
    if (this.state === AudioPlaybackState.PAUSED) {
      await this.resume();
      return;
    }
    if (this.playbackQueue.length === 0) {
      console.warn('No audio chunks');
      return;
    }
    await this.processQueue();
  }

  async pause(): Promise<void> {
    if (this.player && this.state === AudioPlaybackState.PLAYING) {
      this.player.pause();
      this.setState(AudioPlaybackState.PAUSED);
    }
  }

  async resume(): Promise<void> {
    if (this.player && this.state === AudioPlaybackState.PAUSED) {
      this.player.play();
      this.setState(AudioPlaybackState.PLAYING);
    }
  }

  async stop(): Promise<void> {
    if (this.player) {
      this.player.pause();
      // Reset position not directly supported via stop(), but we can remove it.
      this.player.remove();
      this.player = null;
    }
    this.playbackQueue = [];
    this.bufferedDuration = 0;
    this.isProcessingQueue = false;
    this.setState(AudioPlaybackState.STOPPED);
  }

  async setVolume(volume: number): Promise<void> {
    this.config.volume = Math.max(0, Math.min(1, volume));
    if (this.player && !this.isMuted) this.player.volume = this.config.volume;
  }

  async setMuted(muted: boolean): Promise<void> {
    this.isMuted = muted;
    if (this.player) this.player.volume = muted ? 0 : this.config.volume;
  }

  async setPlaybackSpeed(speed: number): Promise<void> {
    this.config.playbackSpeed = Math.max(0.5, Math.min(2.0, speed));
    if (this.player) this.player.playbackRate = this.config.playbackSpeed;
  }

  getCurrentPosition(): number {
    return this.currentPosition;
  }
  getBufferedDuration(): number {
    return this.bufferedDuration;
  }
  getState(): AudioPlaybackState {
    return this.state;
  }
  isPlaying(): boolean {
    return this.state === AudioPlaybackState.PLAYING;
  }
  isMutedState(): boolean {
    return this.isMuted;
  }
  clearQueue(): void {
    this.playbackQueue = [];
    this.bufferedDuration = 0;
  }
  getQueueLength(): number {
    return this.playbackQueue.length;
  }
  updateConfig(config: Partial<PlaybackConfig>): void {
    this.config = { ...this.config, ...config };
  }
  updateCallbacks(callbacks: Partial<PlaybackCallbacks>): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  private setState(state: AudioPlaybackState): void {
    this.state = state;
    this.callbacks.onStateChange?.(state);
  }

  private handleError(error: Error): void {
    console.error('AudioPlaybackManager error:', error);
    this.setState(AudioPlaybackState.ERROR);
    this.callbacks.onError?.(error);
  }

  async cleanup(): Promise<void> {
    await this.stop();
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }
  }
}

export default AudioPlaybackManager;
