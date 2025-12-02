const baseConfig = require('../../jest.config.base');

module.exports = {
  ...baseConfig,
  displayName: '@clone/security',
  rootDir: '.',
  testMatch: ['<rootDir>/src/**/*.test.ts'],
};
