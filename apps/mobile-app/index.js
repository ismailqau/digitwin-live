/**
 * App Entry Point
 *
 * Loads polyfills and registers the root component
 */

// Polyfills for Socket.io in React Native
// These must be imported before any other code
import 'react-native-get-random-values';
import 'react-native-url-polyfill/auto';

import { registerRootComponent } from 'expo';

// Import App component
import App from './App';

// Register the root component
// This calls AppRegistry.registerComponent('main', () => App)
registerRootComponent(App);
