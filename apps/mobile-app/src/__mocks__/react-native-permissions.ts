/**
 * Mock for react-native-permissions
 * Used in tests to avoid dependency on native modules
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
declare const jest: any;

export const PERMISSIONS = {
  IOS: {
    MICROPHONE: 'ios.permission.MICROPHONE',
  },
  ANDROID: {
    RECORD_AUDIO: 'android.permission.RECORD_AUDIO',
  },
};

export const RESULTS = {
  GRANTED: 'granted',
  DENIED: 'denied',
  BLOCKED: 'blocked',
  UNAVAILABLE: 'unavailable',
  LIMITED: 'limited',
};

// Mock functions using jest.fn() for proper mock functionality
export const check = jest.fn(() => Promise.resolve(RESULTS.GRANTED));
export const request = jest.fn(() => Promise.resolve(RESULTS.GRANTED));
export const checkMultiple = jest.fn(() => Promise.resolve({}));
export const requestMultiple = jest.fn(() => Promise.resolve({}));
export const openSettings = jest.fn(() => Promise.resolve());
export const checkNotifications = jest.fn(() =>
  Promise.resolve({ status: RESULTS.GRANTED, settings: {} })
);
export const requestNotifications = jest.fn(() =>
  Promise.resolve({ status: RESULTS.GRANTED, settings: {} })
);

export default {
  PERMISSIONS,
  RESULTS,
  check,
  request,
  checkMultiple,
  requestMultiple,
  openSettings,
  checkNotifications,
  requestNotifications,
};
