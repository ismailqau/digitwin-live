const base = require('../../jest.config.base');

module.exports = {
  ...base,
  displayName: 'mobile-app',
  // Don't use preset - configure manually to avoid ESM issues
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testEnvironment: 'node',
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': ['babel-jest', { configFile: './babel.config.js' }],
  },
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|@react-native/.*|expo|@expo|@unimodules|unimodules|react-native-audio-recorder-player|react-native-permissions|expo-av)/)',
  ],
  moduleNameMapper: {
    '\\.(jpg|jpeg|png|gif|svg)$': '<rootDir>/__mocks__/fileMock.js',
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  testMatch: ['**/__tests__/**/*.(test|spec).(ts|tsx|js)'],
  haste: {
    defaultPlatform: 'ios',
    platforms: ['android', 'ios', 'native'],
  },
  // Ensure tests exit cleanly
  testTimeout: 10000,
  forceExit: false,
  detectOpenHandles: false,
};
