/**
 * AudioPlaybackManager Service (Expo Compatible)
 *
 * Handles audio playback for TTS-generated responses using expo-av.
 */

import * as ExpoAV from 'expo-av';
import { AVPlaybackStatus } from 'expo-av';
import * as FileSystem from 'expo-file-system';
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
  private sound: any = null;
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
      await ExpoAV.Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: this.config.enableDucking,
        playThroughEarpieceAndroid: false,
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
    const { sound } = await (ExpoAV.Audio.Sound as any).createAsync(
      { uri: tempUri },
      { shouldPlay: true, volume: this.isMuted ? 0 : this.config.volume },
      this.onPlaybackStatusUpdate.bind(this)
    );
    this.sound = sound;
    this.setState(AudioPlaybackState.PLAYING);
    await new Promise<void>((resolve) => {
      const checkStatus = async () => {
        if (!this.sound) {
          resolve();
          return;
        }
        const status = await this.sound.getStatusAsync();
        if (status.isLoaded && !status.isPlaying && status.didJustFinish) {
          resolve();
        } else if (status.isLoaded && status.isPlaying) {
          setTimeout(checkStatus, 100);
        } else {
          resolve();
        }
      };
      checkStatus();
    });
    await this.sound?.unloadAsync();
    this.sound = null;
    await FileSystem.deleteAsync(tempUri, { idempotent: true });
  }

  private onPlaybackStatusUpdate(status: AVPlaybackStatus): void {
    if (!status.isLoaded) return;
    this.currentPosition = status.positionMillis || 0;
    this.callbacks.onProgress?.(status.positionMillis || 0, status.durationMillis || 0);
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
    if (this.sound && this.state === AudioPlaybackState.PLAYING) {
      await this.sound.pauseAsync();
      this.setState(AudioPlaybackState.PAUSED);
    }
  }

  async resume(): Promise<void> {
    if (this.sound && this.state === AudioPlaybackState.PAUSED) {
      await this.sound.playAsync();
      this.setState(AudioPlaybackState.PLAYING);
    }
  }

  async stop(): Promise<void> {
    if (this.sound) {
      await this.sound.stopAsync();
      await this.sound.unloadAsync();
      this.sound = null;
    }
    this.playbackQueue = [];
    this.bufferedDuration = 0;
    this.isProcessingQueue = false;
    this.setState(AudioPlaybackState.STOPPED);
  }

  async setVolume(volume: number): Promise<void> {
    this.config.volume = Math.max(0, Math.min(1, volume));
    if (this.sound && !this.isMuted) await this.sound.setVolumeAsync(this.config.volume);
  }

  async setMuted(muted: boolean): Promise<void> {
    this.isMuted = muted;
    if (this.sound) await this.sound.setVolumeAsync(muted ? 0 : this.config.volume);
  }

  async setPlaybackSpeed(speed: number): Promise<void> {
    this.config.playbackSpeed = Math.max(0.5, Math.min(2.0, speed));
    if (this.sound) await this.sound.setRateAsync(this.config.playbackSpeed, true);
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
