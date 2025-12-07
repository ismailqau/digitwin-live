const baseConfig = require('../../jest.config.base');

/** @type {import('jest').Config} */
module.exports = {
  ...baseConfig,
  displayName: 'websocket-server',
  rootDir: '.',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  coveragePathIgnorePatterns: [
    ...(baseConfig.coveragePathIgnorePatterns || []),
    '/node_modules/',
    '/dist/',
    '/coverage/',
  ],
  transformIgnorePatterns: ['node_modules/(?!(uuid)/)'],
  moduleNameMapper: {
    ...baseConfig.moduleNameMapper,
    '^uuid$': require.resolve('uuid'),
  },
};
