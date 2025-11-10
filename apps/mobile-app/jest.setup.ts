// Jest setup for mobile app
// Basic setup without ESM dependencies

// Mock react-native
jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
    select: jest.fn((obj) => obj.ios),
  },
  PermissionsAndroid: {
    PERMISSIONS: {
      RECORD_AUDIO: 'android.permission.RECORD_AUDIO',
    },
    RESULTS: {
      GRANTED: 'granted',
      DENIED: 'denied',
      NEVER_ASK_AGAIN: 'never_ask_again',
    },
    request: jest.fn().mockResolvedValue('granted'),
    check: jest.fn().mockResolvedValue(true),
  },
  AppState: {
    addEventListener: jest.fn().mockReturnValue({ remove: jest.fn() }),
    currentState: 'active',
  },
}));

// Mock audio recorder player
jest.mock('react-native-audio-recorder-player', () => {
  class MockAudioRecorderPlayer {
    startRecorder = jest.fn().mockResolvedValue('file://path');
    stopRecorder = jest.fn().mockResolvedValue('file://path');
    pauseRecorder = jest.fn().mockResolvedValue(undefined);
    resumeRecorder = jest.fn().mockResolvedValue(undefined);
    startPlayer = jest.fn().mockResolvedValue('success');
    stopPlayer = jest.fn().mockResolvedValue('success');
    pausePlayer = jest.fn().mockResolvedValue('success');
    resumePlayer = jest.fn().mockResolvedValue('success');
    seekToPlayer = jest.fn().mockResolvedValue('success');
    setVolume = jest.fn().mockResolvedValue('success');
    setSubscriptionDuration = jest.fn();
    addRecordBackListener = jest.fn();
    addPlayBackListener = jest.fn();
    removeRecordBackListener = jest.fn();
    removePlayBackListener = jest.fn();
  }

  const module = MockAudioRecorderPlayer;
  module.default = MockAudioRecorderPlayer;

  return Object.assign(module, {
    AudioEncoderAndroidType: {
      AAC: 'aac',
      AAC_ELD: 'aac_eld',
      AMR_NB: 'amr_nb',
      AMR_WB: 'amr_wb',
      HE_AAC: 'he_aac',
      VORBIS: 'vorbis',
    },
    AudioSourceAndroidType: {
      DEFAULT: 0,
      MIC: 1,
      VOICE_UPLINK: 2,
      VOICE_DOWNLINK: 3,
      VOICE_CALL: 4,
      CAMCORDER: 5,
      VOICE_RECOGNITION: 6,
      VOICE_COMMUNICATION: 7,
    },
    AVEncoderAudioQualityIOSType: {
      min: 0,
      low: 32,
      medium: 64,
      high: 96,
      max: 127,
    },
    AVEncodingOption: {
      lpcm: 'lpcm',
      ima4: 'ima4',
      aac: 'aac',
      MAC3: 'MAC3',
      MAC6: 'MAC6',
      ulaw: 'ulaw',
      alaw: 'alaw',
      mp1: 'mp1',
      mp2: 'mp2',
      alac: 'alac',
      amr: 'amr',
      flac: 'flac',
      opus: 'opus',
    },
    OutputFormatAndroidType: {
      DEFAULT: 0,
      THREE_GPP: 1,
      MPEG_4: 2,
      AMR_NB: 3,
      AMR_WB: 4,
      AAC_ADTS: 6,
      MPEG_2_TS: 8,
      WEBM: 9,
    },
  });
});

// Mock expo-av
jest.mock('expo-av', () => ({
  Audio: {
    setAudioModeAsync: jest.fn().mockResolvedValue(undefined),
    INTERRUPTION_MODE_IOS_DO_NOT_MIX: 1,
    INTERRUPTION_MODE_ANDROID_DO_NOT_MIX: 1,
    Recording: jest.fn().mockImplementation(() => ({
      prepareToRecordAsync: jest.fn().mockResolvedValue(undefined),
      startAsync: jest.fn().mockResolvedValue(undefined),
      stopAndUnloadAsync: jest.fn().mockResolvedValue({ uri: 'file://test' }),
      getURI: jest.fn().mockReturnValue('file://test'),
    })),
    Sound: {
      createAsync: jest.fn().mockResolvedValue({
        sound: {
          playAsync: jest.fn(),
          stopAsync: jest.fn(),
          unloadAsync: jest.fn(),
        },
        status: {},
      }),
    },
  },
}));

// Mock permissions
// Note: The actual mock implementation is in each test file that needs it
// This is because jest.mock in setup files doesn't get hoisted properly

// Silence console errors during tests
const originalError = console.error;
const originalWarn = console.warn;

beforeAll(() => {
  console.error = jest.fn();
  console.warn = jest.fn();
});

afterAll(() => {
  console.error = originalError;
  console.warn = originalWarn;
});

// Ensure all timers and async operations are cleaned up
afterEach(() => {
  jest.clearAllTimers();
});
