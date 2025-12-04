/**
 * Mock for react-native-permissions
 * Used in tests to avoid dependency on native modules
 */

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

// Mock functions - these will be replaced by jest.fn() at runtime
export const check = () => Promise.resolve(RESULTS.GRANTED);
export const request = () => Promise.resolve(RESULTS.GRANTED);
export const checkMultiple = () => Promise.resolve({});
export const requestMultiple = () => Promise.resolve({});
export const openSettings = () => Promise.resolve();
export const checkNotifications = () => Promise.resolve({ status: RESULTS.GRANTED, settings: {} });
export const requestNotifications = () =>
  Promise.resolve({ status: RESULTS.GRANTED, settings: {} });

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
