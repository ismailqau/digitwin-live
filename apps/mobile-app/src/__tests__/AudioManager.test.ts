/**
 * AudioManager Tests
 * Tests for audio recording and streaming functionality
 */

// Mock expo-audio and expo-file-system
jest.mock('expo-audio');
jest.mock('expo-file-system');

import { check, request } from 'react-native-permissions';

import {
  mockAudioRecorder,
  getRecordingPermissionsAsync,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  AudioModule,
} from '../__mocks__/expo-audio';
import { AudioManager, AudioRecordingState } from '../services/AudioManager';

const mockCheck = check as jest.MockedFunction<typeof check>;
const mockRequest = request as jest.MockedFunction<typeof request>;

describe('AudioManager', () => {
  let audioManager: AudioManager;
  let mockCallbacks: {
    onChunk: jest.Mock;
    onQualityUpdate: jest.Mock;
    onStateChange: jest.Mock;
    onError: jest.Mock;
    onVoiceActivityDetected: jest.Mock;
  };

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Clear and set up permission mocks
    mockCheck.mockClear();
    mockRequest.mockClear();
    mockCheck.mockResolvedValue('granted');
    mockRequest.mockResolvedValue('granted');

    // Reset expo-audio mocks to default values
    (getRecordingPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
    (requestRecordingPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
    (setAudioModeAsync as jest.Mock).mockResolvedValue(undefined);
    (AudioModule.AudioRecorder as jest.Mock).mockImplementation(() => mockAudioRecorder);

    mockAudioRecorder.prepareToRecordAsync.mockResolvedValue(undefined);
    mockAudioRecorder.record.mockReturnValue(undefined);
    mockAudioRecorder.stop.mockResolvedValue(undefined);
    mockAudioRecorder.pause.mockReturnValue(undefined);

    mockCallbacks = {
      onChunk: jest.fn(),
      onQualityUpdate: jest.fn(),
      onStateChange: jest.fn(),
      onError: jest.fn(),
      onVoiceActivityDetected: jest.fn(),
    };

    audioManager = new AudioManager({}, mockCallbacks);
  });

  afterEach(async () => {
    await audioManager.cleanup();
  });

  describe('Initialization', () => {
    it('should initialize with default configuration', () => {
      expect(audioManager).toBeDefined();
      expect(audioManager.getState()).toBe(AudioRecordingState.IDLE);
    });

    it('should initialize with custom configuration', () => {
      const customManager = new AudioManager({
        sampleRate: 48000,
        vadThreshold: 50,
      });

      expect(customManager).toBeDefined();
      expect(customManager.getState()).toBe(AudioRecordingState.IDLE);
    });

    it('should validate audio format configuration', () => {
      const isValid = audioManager.validateAudioFormat();
      expect(isValid).toBe(true);
    });
  });

  describe('Permissions', () => {
    it('should check microphone permissions', async () => {
      const hasPermission = await audioManager.checkPermissions();

      // Verify the mock was called
      expect(getRecordingPermissionsAsync).toHaveBeenCalled();
      expect(hasPermission).toBe(true);
    });

    it('should request microphone permissions', async () => {
      const granted = await audioManager.requestPermissions();
      // Uses expo-audio's requestRecordingPermissionsAsync
      expect(requestRecordingPermissionsAsync).toHaveBeenCalled();
      expect(granted).toBe(true);
    });
  });

  describe('Recording Control', () => {
    it('should start recording successfully', async () => {
      await audioManager.startRecording();

      expect(audioManager.getState()).toBe(AudioRecordingState.RECORDING);
      expect(mockCallbacks.onStateChange).toHaveBeenCalledWith(AudioRecordingState.RECORDING);
    });

    it('should stop recording successfully', async () => {
      await audioManager.startRecording();
      await audioManager.stopRecording();

      expect(audioManager.getState()).toBe(AudioRecordingState.IDLE);
      expect(mockCallbacks.onStateChange).toHaveBeenCalledWith(AudioRecordingState.IDLE);
    });

    it('should pause recording successfully', async () => {
      await audioManager.startRecording();
      await audioManager.pauseRecording();

      expect(audioManager.getState()).toBe(AudioRecordingState.PAUSED);
      expect(mockCallbacks.onStateChange).toHaveBeenCalledWith(AudioRecordingState.PAUSED);
    });

    it('should resume recording successfully', async () => {
      await audioManager.startRecording();
      await audioManager.pauseRecording();
      await audioManager.resumeRecording();

      expect(audioManager.getState()).toBe(AudioRecordingState.RECORDING);
    });

    it('should handle starting recording when already recording', async () => {
      await audioManager.startRecording();
      await audioManager.startRecording(); // Should not throw

      expect(audioManager.getState()).toBe(AudioRecordingState.RECORDING);
    });

    it('should handle stopping when not recording', async () => {
      await audioManager.stopRecording(); // Should not throw
      expect(audioManager.getState()).toBe(AudioRecordingState.IDLE);
    });
  });

  describe('Configuration Management', () => {
    it('should update configuration', () => {
      audioManager.updateConfig({ vadThreshold: 40 });
      // Configuration updated successfully (no error thrown)
      expect(audioManager).toBeDefined();
    });

    it('should update callbacks', () => {
      const newCallback = jest.fn();
      audioManager.updateCallbacks({ onChunk: newCallback });
      // Callbacks updated successfully (no error thrown)
      expect(audioManager).toBeDefined();
    });
  });

  describe('State Management', () => {
    it('should return current state', () => {
      const state = audioManager.getState();
      expect(state).toBe(AudioRecordingState.IDLE);
    });

    it('should transition through states correctly', async () => {
      // IDLE -> RECORDING
      await audioManager.startRecording();
      expect(audioManager.getState()).toBe(AudioRecordingState.RECORDING);

      // RECORDING -> PAUSED
      await audioManager.pauseRecording();
      expect(audioManager.getState()).toBe(AudioRecordingState.PAUSED);

      // PAUSED -> RECORDING
      await audioManager.resumeRecording();
      expect(audioManager.getState()).toBe(AudioRecordingState.RECORDING);

      // RECORDING -> IDLE
      await audioManager.stopRecording();
      expect(audioManager.getState()).toBe(AudioRecordingState.IDLE);
    });
  });

  describe('Cleanup', () => {
    it('should cleanup resources', async () => {
      await audioManager.startRecording();
      await audioManager.cleanup();

      expect(audioManager.getState()).toBe(AudioRecordingState.IDLE);
    });

    it('should cleanup when not recording', async () => {
      await audioManager.cleanup();
      expect(audioManager.getState()).toBe(AudioRecordingState.IDLE);
    });
  });
});
