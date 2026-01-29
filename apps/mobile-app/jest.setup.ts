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
  StyleSheet: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    create: (styles: any) => styles,
  },
  View: 'View',
  Text: 'Text',
  TouchableOpacity: 'TouchableOpacity',
  ScrollView: 'ScrollView',
  ActivityIndicator: 'ActivityIndicator',
}));

// Note: react-native-audio-recorder-player mock is in __mocks__/react-native-audio-recorder-player.js

// Note: expo-av and expo-file-system are mocked in individual test files
// to allow for test-specific mock configurations

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
