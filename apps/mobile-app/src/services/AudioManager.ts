/**
 * AudioManager Service (Expo Compatible)
 *
 * Handles audio recording using expo-av.
 * Note: Real-time low-latency streaming (100ms chunks) is limited in pure Expo Go.
 * This implementation provides a stable recording interface that won't crash the app.
 */

import * as ExpoAV from 'expo-av';
import * as FileSystem from 'expo-file-system';

export enum AudioRecordingState {
  IDLE = 'idle',
  RECORDING = 'recording',
  PAUSED = 'paused',
  ERROR = 'error',
}

export interface AudioChunk {
  data: string; // base64 encoded audio data
  sequenceNumber: number;
  timestamp: number;
  duration: number; // in milliseconds
}

export interface AudioQualityMetrics {
  volume: number; // 0-100
  snr: number; // Signal-to-noise ratio in dB
  isClipping: boolean;
  isSilent: boolean;
}

export interface AudioManagerConfig {
  sampleRate: number; // 16000 Hz
  channels: number; // 1 (mono)
  bitDepth: number; // 16-bit
  chunkDuration: number; // 100ms
  vadThreshold: number; // 0-100
  enableNoiseReduction: boolean;
}

export interface AudioManagerCallbacks {
  onChunk?: (chunk: AudioChunk) => void;
  onQualityUpdate?: (metrics: AudioQualityMetrics) => void;
  onStateChange?: (state: AudioRecordingState) => void;
  onError?: (error: Error) => void;
  onVoiceActivityDetected?: (isActive: boolean) => void;
  onProgress?: (position: number, duration: number) => void;
}

const DEFAULT_CONFIG: AudioManagerConfig = {
  sampleRate: 16000,
  channels: 1,
  bitDepth: 16,
  chunkDuration: 100,
  vadThreshold: -40, // dB threshold for silence
  enableNoiseReduction: true,
};

export class AudioManager {
  private recording: any = null;
  private config: AudioManagerConfig;
  private callbacks: AudioManagerCallbacks;
  private state: AudioRecordingState = AudioRecordingState.IDLE;
  private sequenceNumber: number = 0;
  private isVoiceActive: boolean = false;

  constructor(config: Partial<AudioManagerConfig> = {}, callbacks: AudioManagerCallbacks = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.callbacks = callbacks;
  }

  async requestPermissions(): Promise<boolean> {
    try {
      const response = await (ExpoAV.Audio as any).requestPermissionsAsync();
      return response.status === 'granted';
    } catch (error) {
      this.handleError(new Error(`Permission request failed: ${error}`));
      return false;
    }
  }

  async checkPermissions(): Promise<boolean> {
    try {
      const response = await (ExpoAV.Audio as any).getPermissionsAsync();
      return response.status === 'granted';
    } catch (error) {
      this.handleError(new Error(`Permission check failed: ${error}`));
      return false;
    }
  }

  async startRecording(): Promise<void> {
    try {
      if (this.state === AudioRecordingState.RECORDING) {
        console.warn('Already recording');
        return;
      }

      const hasPermission = await this.checkPermissions();
      if (!hasPermission) {
        const granted = await this.requestPermissions();
        if (!granted) throw new Error('Microphone permission denied');
      }

      await ExpoAV.Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      // Configuring for low-quality (smaller size) fast recording
      // Note: expo-av does not support true streaming of raw PCM bytes access easily in Expo Go.
      // We use HIGH_QUALITY preset for clarity, but this writes to a file.
      const recording = new (ExpoAV.Audio as any).Recording();
      await recording.prepareToRecordAsync(
        (ExpoAV.Audio as any).RecordingOptionsPresets.HIGH_QUALITY
      );

      recording.setOnRecordingStatusUpdate((status: any) => {
        if (!status.isRecording) return;

        // Basic metering for VAD
        if (status.metering !== undefined) {
          const volume = Math.max(0, (status.metering + 160) / 1.6); // Normalize -160..0 to 0..100
          const isSilent = status.metering < this.config.vadThreshold;
          const isClipping = status.metering > -1.0;

          const metrics: AudioQualityMetrics = {
            volume,
            snr: 0, // Not easily calculated
            isClipping,
            isSilent,
          };
          this.callbacks.onQualityUpdate?.(metrics);
          this.callbacks.onProgress?.(status.positionMillis, status.durationMillis || 0);

          const active = !isSilent;
          if (active !== this.isVoiceActive) {
            this.isVoiceActive = active;
            this.callbacks.onVoiceActivityDetected?.(active);
          }
        }
      });

      await recording.startAsync();
      this.recording = recording;
      this.setState(AudioRecordingState.RECORDING);
      console.log('Recording started');
    } catch (error) {
      this.handleError(new Error(`Failed to start recording: ${error}`));
    }
  }

  async stopRecording(): Promise<void> {
    try {
      if (!this.recording) return;

      console.log('Stopping recording..');
      await this.recording.stopAndUnloadAsync();
      const uri = this.recording.getURI();
      this.recording = null;
      this.setState(AudioRecordingState.IDLE);

      console.log('Recording stopped, saved at:', uri);

      // In a real implementation, we would now read the file and emit it
      // Since this is a replacement for streaming, we will emit one large chunk for now
      // or implement a file watcher if strictly needed.
      if (uri) {
        this.emitFinalChunk(uri);
      }
    } catch (error) {
      this.handleError(new Error(`Failed to stop recording: ${error}`));
    }
  }

  private async emitFinalChunk(uri: string) {
    try {
      const base64Data = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const chunk: AudioChunk = {
        data: base64Data,
        sequenceNumber: this.sequenceNumber++,
        timestamp: Date.now(),
        duration: 0, // Unknown without analysis
      };
      this.callbacks.onChunk?.(chunk);
    } catch (e) {
      console.error('Error creating chunk from file', e);
    }
  }

  async pauseRecording(): Promise<void> {
    try {
      if (this.recording) {
        await this.recording.pauseAsync();
        this.setState(AudioRecordingState.PAUSED);
      }
    } catch (error) {
      this.handleError(new Error(`Failed to pause: ${error}`));
    }
  }

  async resumeRecording(): Promise<void> {
    try {
      if (this.recording) {
        await this.recording.startAsync();
        this.setState(AudioRecordingState.RECORDING);
      }
    } catch (error) {
      this.handleError(new Error(`Failed to resume: ${error}`));
    }
  }

  getState(): AudioRecordingState {
    return this.state;
  }

  updateConfig(config: Partial<AudioManagerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  updateCallbacks(callbacks: Partial<AudioManagerCallbacks>): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  private setState(state: AudioRecordingState): void {
    this.state = state;
    this.callbacks.onStateChange?.(state);
  }

  private handleError(error: Error): void {
    console.error('AudioManager error:', error);
    this.setState(AudioRecordingState.ERROR);
    this.callbacks.onError?.(error);
  }

  async cleanup(): Promise<void> {
    try {
      if (this.recording) {
        await this.recording.stopAndUnloadAsync();
        this.recording = null;
      }
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  }
}

export default AudioManager;
