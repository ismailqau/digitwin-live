const baseConfig = require('../../jest.config.base');

module.exports = {
  ...baseConfig,
  displayName: '@clone/cache-service',
  rootDir: '.',
  testMatch: ['<rootDir>/src/**/*.test.ts'],
};
