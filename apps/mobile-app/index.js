/**
 * App Entry Point
 *
 * Loads polyfills and registers the root component
 */

// Polyfills for Socket.io in React Native
// These must be imported before any other code
import 'react-native-url-polyfill/auto';

console.log('[index.js] Starting app initialization...');

// Add global error handler
if (global.ErrorUtils) {
  global.ErrorUtils.setGlobalHandler((error, isFatal) => {
    console.error('[index.js] Unhandled Global Error:', error, isFatal);
  });
}

import { registerRootComponent } from 'expo';

// Import App component
import App from './App';

// Register the root component
// This calls AppRegistry.registerComponent('main', () => App)
registerRootComponent(App);
