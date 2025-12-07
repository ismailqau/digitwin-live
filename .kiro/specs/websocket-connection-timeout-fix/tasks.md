# Implementation Plan

- [x] 1. Add guest token generation to mobile app
  - Create `generateGuestToken()` utility function that returns `guest_<uuid>_<timestamp>` format
  - Update sign-in skip flow to generate and store guest token in SecureStorage
  - Add guest token validation helper
  - _Requirements: 3.1, 3.2_

- [x] 2. Update AuthService on server to support guest tokens
  - Add `verifyGuestToken()` method to validate guest token format
  - Update `verifyToken()` to detect and handle guest tokens
  - Return `isGuest: true` in token payload for guest tokens
  - Add specific error codes: AUTH_REQUIRED, AUTH_INVALID, AUTH_EXPIRED
  - _Requirements: 2.3, 2.4, 2.5, 3.2_

- [x] 2.1 Write property test for guest token validation
  - **Property 4: Guest session creation**
  - **Validates: Requirements 3.1, 3.2, 3.3**

- [x] 3. Update WebSocketController to always emit auth response
  - Wrap `handleConnection()` in try-catch to ensure errors are caught
  - Always emit `auth_error` with error code and message before disconnecting on auth failure
  - Emit `session_created` with `isGuest` flag for successful connections
  - Add 2-second timeout for session creation
  - Add detailed logging for all connection attempts and outcomes
  - _Requirements: 1.1, 1.2, 1.3, 2.1, 4.1, 4.2, 4.3_

- [x] 3.1 Write property test for authentication response guarantee
  - **Property 1: Authentication response guarantee**
  - **Validates: Requirements 1.1, 1.2, 1.3**

- [x] 3.2 Write unit tests for WebSocketController error handling
  - Test auth failure with missing token
  - Test auth failure with invalid token
  - Test auth failure with expired token
  - Test successful auth with valid JWT
  - Test successful auth with guest token
  - _Requirements: 1.1, 1.2, 1.3, 3.2_

- [x] 4. Add AUTHENTICATING state to WebSocketClient
  - Add AUTHENTICATING to ConnectionState enum
  - Update state machine to transition: CONNECTING → AUTHENTICATING → (CONNECTED | ERROR)
  - Add state transition logging
  - _Requirements: 5.1, 5.2_

- [x] 4.1 Write property test for client state consistency
  - **Property 2: Client state consistency**
  - **Validates: Requirements 5.1, 5.2, 5.3**

- [x] 5. Update WebSocketClient connection flow
  - After Socket.IO `connect` event, transition to AUTHENTICATING state
  - Wait for `session_created` event before transitioning to CONNECTED
  - Add 10-second timeout for waiting for `session_created` (accounts for Cloud Run cold start)
  - Update transport order to `['polling', 'websocket']` for Cloud Run compatibility
  - Increase connection timeout to 30 seconds
  - On timeout, transition to ERROR and schedule reconnection
  - _Requirements: 5.2, 5.3, 5.5_

- [x] 5.1 Write property test for connection timeout handling
  - **Property 5: Connection timeout handling**
  - **Validates: Requirements 5.5**

- [x] 6. Add auth_error event handling to WebSocketClient
  - Listen for `auth_error` event from server
  - Log error with full context (error code, message, token type)
  - On AUTH_EXPIRED, attempt token refresh before reconnecting
  - On AUTH_REQUIRED or AUTH_INVALID, fall back to guest token
  - Transition to ERROR state and schedule reconnection
  - _Requirements: 2.2, 5.4_

- [x] 6.1 Write property test for error message completeness
  - **Property 3: Error message completeness**
  - **Validates: Requirements 2.1, 2.3, 2.4, 2.5**

- [x] 6.2 Write unit tests for auth_error handling
  - Test AUTH_EXPIRED triggers token refresh
  - Test AUTH_REQUIRED falls back to guest token
  - Test AUTH_INVALID falls back to guest token
  - Test error logging includes full context
  - _Requirements: 2.2, 5.4_

- [-] 7. Add guest mode UI indicators to mobile app
  - Display "Guest Mode" badge when `isGuest: true` in session
  - Show "Sign in to save your data" prompt for guest users
  - Add "Sign In" button in guest mode UI
  - _Requirements: 3.4_

- [ ] 8. Add comprehensive logging to server
  - Log all connection attempts with socket ID, token type, timestamp
  - Log session creation with user ID, session ID, socket ID
  - Log authentication failures with reason, token type, socket ID
  - Log disconnections with session ID, socket ID, connection duration
  - Log connection errors with full stack trace and context
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [ ] 8.1 Write property test for logging completeness
  - **Property 6: Logging completeness**
  - **Validates: Requirements 4.1, 4.2, 4.3**

- [ ] 9. Add integration tests for end-to-end connection flows
  - Test successful connection with valid JWT token
  - Test connection with guest token
  - Test connection failure with invalid token
  - Test connection timeout handling
  - Test reconnection after auth_error
  - _Requirements: 1.1, 1.2, 1.3, 3.1, 3.2, 3.3_

- [ ] 10. Add monitoring and metrics
  - Add connection success rate metric
  - Add authentication failure reason tracking
  - Add average connection establishment time metric
  - Add timeout rate metric
  - Set up alerts for connection success rate < 95%
  - Set up alerts for average connection time > 3 seconds
  - _Requirements: 4.1, 4.2, 4.3_

- [ ] 11. Update documentation
  - Document guest token format and generation
  - Document new AUTHENTICATING state in client
  - Document auth_error event format
  - Document connection flow diagrams
  - Add troubleshooting guide for connection issues
  - _Requirements: 2.1, 2.2, 3.1_

- [ ] 12. Update Cloud Run configuration for WebSocket support
  - Enable session affinity for sticky sessions
  - Set minimum instances to 1 to reduce cold starts
  - Increase request timeout to 3600 seconds for long-lived connections
  - Set CPU always allocated for consistent WebSocket performance
  - Update Socket.IO transport order to `['polling', 'websocket']` on both client and server
  - Align heartbeat intervals (client and server both use 25 seconds)
  - _Requirements: 1.1, 5.5_

- [ ] 13. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
