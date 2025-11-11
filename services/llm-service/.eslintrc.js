module.exports = {
  root: false,
  extends: ['../../.eslintrc.js'],
  rules: {
    // Disable no-explicit-any for this service since we're dealing with external APIs
    // and temporary type definitions that require any types
    '@typescript-eslint/no-explicit-any': 'warn', // Change from error to warning
  },
};
