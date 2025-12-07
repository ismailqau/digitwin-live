# Requirements Document

## Introduction

The mobile app is experiencing WebSocket connection timeouts when connecting to the websocket-server. The server successfully upgrades the connection (HTTP 101), but the client times out waiting for the `session_created` event. This is caused by authentication failures that are not properly communicated to the client.

## Glossary

- **WebSocket Client**: The Socket.IO client running in the React Native mobile app
- **WebSocket Server**: The Socket.IO server running on Cloud Run
- **Session Created Event**: The `session_created` event emitted by the server after successful authentication
- **Connection Handshake**: The initial connection establishment and authentication process
- **Authentication Token**: JWT token passed in the Socket.IO handshake auth object
- **Connection Timeout**: The 20-second timeout configured in the client before giving up on connection

## Requirements

### Requirement 1

**User Story:** As a mobile app user, I want the WebSocket connection to establish quickly and reliably, so that I can start conversations without delays or errors.

#### Acceptance Criteria

1. WHEN the mobile app initiates a WebSocket connection with a valid token THEN the server SHALL emit the `session_created` event within 5 seconds (accounting for Cloud Run cold start)
2. WHEN the mobile app initiates a WebSocket connection with an invalid token THEN the server SHALL emit an `auth_error` event immediately and disconnect the client
3. WHEN the mobile app initiates a WebSocket connection without a token THEN the server SHALL emit an `auth_error` event immediately and disconnect the client
4. WHEN the server emits `session_created` THEN the mobile client SHALL transition to CONNECTED state within 500ms
5. WHEN the server emits `auth_error` THEN the mobile client SHALL log the error and attempt to refresh the token before reconnecting

### Requirement 2

**User Story:** As a developer, I want clear error messages when authentication fails, so that I can quickly diagnose and fix connection issues.

#### Acceptance Criteria

1. WHEN authentication fails on the server THEN the server SHALL emit an `auth_error` event with a descriptive error message before disconnecting
2. WHEN the mobile client receives an `auth_error` event THEN the client SHALL log the error message with full context (token type, error reason)
3. WHEN authentication fails due to missing token THEN the error message SHALL be "Authentication token required"
4. WHEN authentication fails due to invalid token THEN the error message SHALL be "Invalid authentication token"
5. WHEN authentication fails due to expired token THEN the error message SHALL be "Authentication token expired"

### Requirement 3

**User Story:** As a mobile app user, I want the app to handle guest mode gracefully, so that I can try the app without creating an account.

#### Acceptance Criteria

1. WHEN the mobile app has no stored authentication token THEN the app SHALL use a guest token for WebSocket connection
2. WHEN the server receives a guest token THEN the server SHALL create a guest session with limited permissions
3. WHEN a guest session is created THEN the server SHALL emit `session_created` with `isGuest: true` flag
4. WHEN the mobile client receives a guest session THEN the client SHALL display appropriate UI indicating guest mode
5. WHEN a guest user attempts to access protected features THEN the app SHALL prompt for authentication

### Requirement 4

**User Story:** As a system administrator, I want detailed connection logs, so that I can monitor and troubleshoot WebSocket connection issues.

#### Acceptance Criteria

1. WHEN a client attempts to connect THEN the server SHALL log the connection attempt with socket ID, token type, and timestamp
2. WHEN authentication succeeds THEN the server SHALL log the session creation with user ID, session ID, and socket ID
3. WHEN authentication fails THEN the server SHALL log the failure reason, token type, and socket ID
4. WHEN a client disconnects THEN the server SHALL log the disconnection with session ID, socket ID, and connection duration
5. WHEN connection errors occur THEN the server SHALL log the error with full stack trace and context

### Requirement 5

**User Story:** As a mobile app developer, I want the client to handle connection state transitions correctly, so that the UI accurately reflects the connection status.

#### Acceptance Criteria

1. WHEN the client calls `connect()` THEN the client SHALL transition to CONNECTING state immediately
2. WHEN the Socket.IO `connect` event fires THEN the client SHALL wait for `session_created` before transitioning to CONNECTED state
3. WHEN `session_created` is received THEN the client SHALL transition to CONNECTED state and emit the session data to listeners
4. WHEN `auth_error` is received THEN the client SHALL transition to ERROR state and schedule reconnection
5. WHEN the connection times out waiting for `session_created` after 10 seconds THEN the client SHALL transition to ERROR state and schedule reconnection with exponential backoff
