const base = require('../../jest.config.base');

module.exports = {
  ...base,
  displayName: 'mobile-app',
  preset: 'react-native',
  setupFilesAfterEnv: ['<rootDir>/../../jest.setup.base.ts'],
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|expo|@expo|@unimodules|unimodules|react-native-audio-recorder-player|react-native-permissions|expo-av)/)',
  ],
  moduleNameMapper: {
    '^react-native$': '<rootDir>/../../node_modules/react-native',
    '^expo-av$': '<rootDir>/../../node_modules/expo-av',
  },
  testEnvironment: 'node',
};
