/**
 * AudioManager Service (Expo Compatible)
 *
 * Handles audio recording using expo-audio.
 * Note: Real-time low-latency streaming (100ms chunks) is limited in pure Expo Go.
 * This implementation provides a stable recording interface that won't crash the app.
 */

// Safely import expo-audio
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let AudioModule: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let RecordingPresets: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let setAudioModeAsync: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let requestRecordingPermissionsAsync: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let getRecordingPermissionsAsync: any = null;

try {
  const Audio = require('expo-audio');
  AudioModule = Audio.AudioModule;
  RecordingPresets = Audio.RecordingPresets;
  setAudioModeAsync = Audio.setAudioModeAsync;
  requestRecordingPermissionsAsync = Audio.requestRecordingPermissionsAsync;
  getRecordingPermissionsAsync = Audio.getRecordingPermissionsAsync;
} catch (error) {
  console.warn('[AudioManager] Failed to load expo-audio module:', error);
}
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
  onRecordingComplete?: (uri: string, durationMs: number) => void;
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
const RECORDING_OPTIONS = RecordingPresets?.HIGH_QUALITY || {};

export class AudioManager {
  // Use 'any' for now as AudioRecorder class type is hard to access directly without using 'typeof AudioModule.AudioRecorder'
  // or relying on type inference. It's an instance of the native class.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private recording: any | null = null;
  private config: AudioManagerConfig;
  private callbacks: AudioManagerCallbacks;
  private state: AudioRecordingState = AudioRecordingState.IDLE;
  private sequenceNumber: number = 0;
  private recordingStartTime: number = 0;
  private isAvailable: boolean = false;

  constructor(config: Partial<AudioManagerConfig> = {}, callbacks: AudioManagerCallbacks = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.callbacks = callbacks;
    this.isAvailable = !!AudioModule && !!RecordingPresets;
    if (!this.isAvailable) {
      console.warn('[AudioManager] expo-audio is not available. Recording will be disabled.');
    }
  }

  async requestPermissions(): Promise<boolean> {
    if (!this.isAvailable || !requestRecordingPermissionsAsync) return false;
    try {
      const response = await requestRecordingPermissionsAsync();
      return response.status === 'granted';
    } catch (error) {
      this.handleError(new Error(`Permission request failed: ${error}`));
      return false;
    }
  }

  async checkPermissions(): Promise<boolean> {
    if (!this.isAvailable || !getRecordingPermissionsAsync) return false;
    try {
      const response = await getRecordingPermissionsAsync();
      return response.status === 'granted';
    } catch (error) {
      this.handleError(new Error(`Permission check failed: ${error}`));
      return false;
    }
  }

  async startRecording(): Promise<void> {
    if (!this.isAvailable) {
      this.handleError(new Error('Audio recording not available on this device/build'));
      return;
    }
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

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.recording.addListener('recordingStatusUpdate', (status: any) => {
        if (!status.isRecording) return;

        this.callbacks.onProgress?.(status.currentTime * 1000, 0);

        // Basic metering from recorder if available (this.recording is typed as any so checking properties safely)
        // const volume = this.recording?.metering || 0;
        // We'll skip complex metering logic for now as it differs in expo-audio
      });

      // IMPORTANT: Must prepare before recording to set up file path
      await this.recording.prepareToRecordAsync();
      this.recordingStartTime = Date.now();
      this.recording.record();
      this.setState(AudioRecordingState.RECORDING);
      console.log('Recording started');
    } catch (error) {
      this.handleError(new Error(`Failed to start recording: ${error}`));
    }
  }

  async stopRecording(): Promise<void> {
    try {
      if (!this.recording) {
        this.setState(AudioRecordingState.IDLE);
        return;
      }

      console.log('Stopping recording..');
      await this.recording.stop();
      const uri = this.recording.uri;
      const durationMs = Date.now() - this.recordingStartTime;
      this.recording = null; // No unload needed
      this.setState(AudioRecordingState.IDLE);

      console.log('Recording stopped, saved at:', uri, 'duration:', durationMs, 'ms');

      // Notify about recording completion with URI for saving
      if (uri) {
        try {
          // Wait for file to be written before notifying
          await this.waitForFile(uri);
          this.callbacks.onRecordingComplete?.(uri, durationMs);
          // Also emit the chunk for WebSocket streaming
          await this.emitFinalChunk(uri);
        } catch (fileError) {
          console.error('Error processing recording file:', fileError);
          // Don't transition to error state - recording was stopped successfully
        }
      }
    } catch (error) {
      this.handleError(new Error(`Failed to stop recording: ${error}`));
    }
  }

  private async waitForFile(uri: string): Promise<boolean> {
    let fileExists = false;
    let retries = 0;
    const maxRetries = 10;
    const retryDelayMs = 100;

    while (!fileExists && retries < maxRetries) {
      const fileInfo = await FileSystem.getInfoAsync(uri);
      if (fileInfo.exists && fileInfo.size && fileInfo.size > 0) {
        fileExists = true;
      } else {
        retries++;
        console.log(`Waiting for recording file... (attempt ${retries}/${maxRetries})`);
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
      }
    }
    return fileExists;
  }

  private async emitFinalChunk(uri: string): Promise<void> {
    try {
      // File existence already verified, but double-check
      const fileInfo = await FileSystem.getInfoAsync(uri);
      if (!fileInfo.exists) {
        console.warn('Recording file does not exist:', uri);
        return;
      }

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

      // NOTE: We don't delete the file here anymore because onRecordingComplete
      // might need it for saving to history
    } catch (e) {
      console.error('Error creating chunk from file:', uri, e);
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
