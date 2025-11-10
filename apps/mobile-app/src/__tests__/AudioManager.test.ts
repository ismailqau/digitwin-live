/**
 * AudioManager Tests
 * Tests for audio recording and streaming functionality
 */

import { AudioManager, AudioRecordingState } from '../services/AudioManager';

// Mock react-native modules
jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
  PermissionsAndroid: {
    PERMISSIONS: { RECORD_AUDIO: 'android.permission.RECORD_AUDIO' },
    RESULTS: { GRANTED: 'granted' },
    request: jest.fn(),
    check: jest.fn(),
  },
}));

// Mock react-native-audio-recorder-player
jest.mock('react-native-audio-recorder-player', () => {
  return jest.fn().mockImplementation(() => ({
    startRecorder: jest.fn().mockResolvedValue('file://test-recording.m4a'),
    stopRecorder: jest.fn().mockResolvedValue('file://test-recording.m4a'),
    pauseRecorder: jest.fn().mockResolvedValue(undefined),
    resumeRecorder: jest.fn().mockResolvedValue(undefined),
    addRecordBackListener: jest.fn(),
    removeRecordBackListener: jest.fn(),
  }));
});

// Mock react-native-permissions
jest.mock('react-native-permissions', () => ({
  check: jest.fn().mockResolvedValue('granted'),
  request: jest.fn().mockResolvedValue('granted'),
  PERMISSIONS: {
    IOS: { MICROPHONE: 'ios.permission.MICROPHONE' },
    ANDROID: { RECORD_AUDIO: 'android.permission.RECORD_AUDIO' },
  },
  RESULTS: {
    GRANTED: 'granted',
    DENIED: 'denied',
    BLOCKED: 'blocked',
  },
}));

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
      expect(hasPermission).toBe(true);
    });

    it('should request microphone permissions', async () => {
      const granted = await audioManager.requestPermissions();
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
