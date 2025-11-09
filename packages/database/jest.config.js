const baseConfig = require('../../jest.config.base');

/** @type {import('jest').Config} */
module.exports = {
  ...baseConfig,
  displayName: 'database',
  rootDir: '.',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  coveragePathIgnorePatterns: [
    ...(baseConfig.coveragePathIgnorePatterns || []),
    '/node_modules/',
    '/dist/',
    '/coverage/',
  ],
};
