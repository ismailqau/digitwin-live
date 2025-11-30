const baseConfig = require('../../jest.config.base');

/** @type {import('jest').Config} */
module.exports = {
  ...baseConfig,
  displayName: 'rag-service',
  rootDir: '.',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  coveragePathIgnorePatterns: ['/node_modules/', '/dist/', '/coverage/'],
  forceExit: true,
  detectOpenHandles: true,
};
