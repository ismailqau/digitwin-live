/* eslint-disable @typescript-eslint/no-explicit-any */

export const mockRecordingInstance = {
  prepareToRecordAsync: jest.fn().mockResolvedValue(undefined) as any,
  startAsync: jest.fn().mockResolvedValue(undefined) as any,
  stopAndUnloadAsync: jest.fn().mockResolvedValue({ uri: 'file://test' }) as any,
  pauseAsync: jest.fn().mockResolvedValue(undefined) as any,
  getURI: jest.fn().mockReturnValue('file://test') as any,
  setOnRecordingStatusUpdate: jest.fn() as any,
};

export const mockAudio = {
  setAudioModeAsync: jest.fn().mockResolvedValue(undefined) as any,
  requestPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }) as any,
  getPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }) as any,
  INTERRUPTION_MODE_IOS_DO_NOT_MIX: 1,
  INTERRUPTION_MODE_ANDROID_DO_NOT_MIX: 1,
  Recording: jest.fn().mockImplementation(() => mockRecordingInstance) as any,
  RecordingOptionsPresets: {
    HIGH_QUALITY: {},
  },
  Sound: {
    createAsync: jest.fn().mockResolvedValue({
      sound: {
        playAsync: jest.fn() as any,
        stopAsync: jest.fn() as any,
        unloadAsync: jest.fn() as any,
      },
      status: {},
    }) as any,
  },
};

export const Audio = mockAudio;
