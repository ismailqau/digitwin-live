/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Mock for expo-audio
 * Used in tests to avoid dependency on native modules
 */

export const mockAudioRecorder = {
  prepareToRecordAsync: jest.fn().mockResolvedValue(undefined) as any,
  record: jest.fn() as any,
  stop: jest.fn().mockResolvedValue(undefined) as any,
  pause: jest.fn() as any,
  uri: 'file://test-recording.m4a',
  addListener: jest.fn() as any,
  removeAllListeners: jest.fn() as any,
};

export const AudioModule = {
  AudioRecorder: jest.fn().mockImplementation(() => mockAudioRecorder) as any,
};

export const RecordingPresets = {
  HIGH_QUALITY: {
    extension: '.m4a',
    sampleRate: 44100,
    numberOfChannels: 2,
    bitRate: 128000,
  },
};

export const setAudioModeAsync = jest.fn().mockResolvedValue(undefined) as any;

export const requestRecordingPermissionsAsync = jest
  .fn()
  .mockResolvedValue({ status: 'granted' }) as any;

export const getRecordingPermissionsAsync = jest
  .fn()
  .mockResolvedValue({ status: 'granted' }) as any;

// Audio player hooks (used by RecordingListItem)
export const useAudioPlayer = jest.fn().mockReturnValue({
  play: jest.fn(),
  pause: jest.fn(),
  seekTo: jest.fn(),
}) as any;

export const useAudioPlayerStatus = jest.fn().mockReturnValue({
  playing: false,
  currentTime: 0,
  duration: 60,
  isBuffering: false,
}) as any;

export const PermissionStatus = {
  GRANTED: 'granted',
  DENIED: 'denied',
  UNDETERMINED: 'undetermined',
};
