const baseConfig = require('../../jest.config.base');

module.exports = {
  ...baseConfig,
  displayName: 'job-queue',
  rootDir: '.',
  testMatch: ['<rootDir>/src/**/*.test.ts'],
};
