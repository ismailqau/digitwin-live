# Implementation Plan

- [ ] 1. Migrate WebSocket server from Socket.IO to native ws library
  - Install `ws` and `@types/ws` dependencies
  - Replace Socket.IO server with native WebSocket server
  - Maintain authentication, heartbeat, and message handling
  - Update index.ts to use native WebSocket
  - Remove `socket.io` dependency
  - _Requirements: 1.1, 1.3, 2.1, 2.2, 3.1, 3.2, 3.4, 3.5_

- [ ] 2. Migrate mobile app from Socket.IO client to native WebSocket
  - Replace Socket.IO client with React Native built-in WebSocket
  - Implement connection state management and reconnection with exponential backoff
  - Implement message queuing for offline scenarios
  - Implement heartbeat mechanism (ping/pong)
  - Update all WebSocket event handlers
  - Remove `socket.io-client` dependency
  - _Requirements: 1.2, 1.3, 2.3, 2.4, 2.5, 3.4, 3.5, 4.1, 4.2, 4.3, 4.4, 4.5_

- [ ] 3. Upgrade Expo SDK from 52 to 54
  - Update `expo` to `~54.0.0`
  - Update `react-native` to `0.81.x`
  - Update `react` to `18.3.x`
  - Update all Expo modules (expo-av, expo-camera, expo-file-system, expo-secure-store, etc.)
  - Update React Navigation packages
  - Update `@expo/metro-runtime` and TypeScript types
  - Fix breaking changes and deprecated APIs
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 6.2, 6.3, 6.5_

- [ ] 4. Test end-to-end WebSocket connectivity
  - Test mobile app connects to server successfully
  - Test JWT authentication and session creation
  - Test bidirectional message flow
  - Test reconnection after network interruption
  - Test real-time features (audio, transcripts, LLM responses)
  - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

- [ ] 5. Verify backward compatibility and performance
  - Test all existing features work (audio streaming, conversations, navigation)
  - Test on iOS and Android devices
  - Verify workspace packages work correctly
  - Measure bundle size reduction (verify 100KB+ smaller)
  - Verify no performance regressions
  - _Requirements: 1.4, 7.1, 7.2, 7.3, 7.4, 7.5, 10.1, 10.2, 10.3, 10.4, 10.5_
