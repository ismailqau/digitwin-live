const base = require('../../jest.config.base');

module.exports = {
  ...base,
  displayName: 'mobile-app',
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/../../jest.setup.base.ts'],
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|expo|@expo|@unimodules|unimodules)/)',
  ],
};
