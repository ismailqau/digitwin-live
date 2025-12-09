/**
 * AudioManager Service (Expo Compatible)
 *
 * Handles audio recording using expo-av.
 * Note: Real-time low-latency streaming (100ms chunks) is limited in pure Expo Go.
 * This implementation provides a stable recording interface that won't crash the app.
 */

import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  requestRecordingPermissionsAsync,
  getRecordingPermissionsAsync,
} from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';

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

// Use RecordingPresets directly
const RECORDING_OPTIONS = RecordingPresets.HIGH_QUALITY;

export class AudioManager {
  // Use 'any' for now as AudioRecorder class type is hard to access directly without using 'typeof AudioModule.AudioRecorder'
  // or relying on type inference. It's an instance of the native class.
  private recording: any | null = null;
  private config: AudioManagerConfig;
  private callbacks: AudioManagerCallbacks;
  private state: AudioRecordingState = AudioRecordingState.IDLE;
  private sequenceNumber: number = 0;

  constructor(config: Partial<AudioManagerConfig> = {}, callbacks: AudioManagerCallbacks = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.callbacks = callbacks;
  }

  async requestPermissions(): Promise<boolean> {
    try {
      const response = await requestRecordingPermissionsAsync();
      return response.status === 'granted';
    } catch (error) {
      this.handleError(new Error(`Permission request failed: ${error}`));
      return false;
    }
  }

  async checkPermissions(): Promise<boolean> {
    try {
      const response = await getRecordingPermissionsAsync();
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

      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
        interruptionMode: 'doNotMix',
        interruptionModeAndroid: 'doNotMix',
        shouldPlayInBackground: false,
        shouldRouteThroughEarpiece: false,
      });

      this.recording = new AudioModule.AudioRecorder(RECORDING_OPTIONS);

      this.recording.addListener('recordingStatusUpdate', (status: any) => {
        if (!status.isRecording) return;

        this.callbacks.onProgress?.(status.currentTime * 1000, 0);

        // Basic metering from recorder if available (this.recording is typed as any so checking properties safely)
        // const volume = this.recording?.metering || 0;
        // We'll skip complex metering logic for now as it differs in expo-audio
      });

      this.recording.record();
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
      await this.recording.stop();
      const uri = this.recording.uri;
      this.recording = null; // No unload needed
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
        this.recording.pause();
        this.setState(AudioRecordingState.PAUSED);
      }
    } catch (error) {
      this.handleError(new Error(`Failed to pause: ${error}`));
    }
  }

  async resumeRecording(): Promise<void> {
    try {
      if (this.recording) {
        this.recording.record();
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

  validateAudioFormat(): boolean {
    // Validate that the audio configuration is supported
    const validSampleRates = [8000, 16000, 22050, 44100, 48000];
    const validChannels = [1, 2];
    const validBitDepths = [8, 16, 24, 32];

    return (
      validSampleRates.includes(this.config.sampleRate) &&
      validChannels.includes(this.config.channels) &&
      validBitDepths.includes(this.config.bitDepth)
    );
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
        await this.recording.stop();
        this.recording = null;
      }
      this.setState(AudioRecordingState.IDLE);
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  }
}

export default AudioManager;
