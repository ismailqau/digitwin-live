# WebSocket Connection Flow Diagrams

## Successful Connection Flow

```mermaid
sequenceDiagram
    participant Client as Mobile Client
    participant SocketIO as Socket.IO
    participant Server as WebSocket Server
    participant Auth as Auth Service
    participant DB as Database

    Client->>Client: State: DISCONNECTED
    Client->>SocketIO: connect() with token
    Client->>Client: State: CONNECTING

    SocketIO->>Server: HTTP Upgrade Request
    Server->>SocketIO: 101 Switching Protocols

    SocketIO->>Client: 'connect' event
    Client->>Client: State: AUTHENTICATING
    Client->>Client: Start 10s timeout

    Server->>Auth: verifyToken(token)
    Auth->>Auth: Validate JWT/Guest token
    Auth-->>Server: Token valid

    Server->>DB: createSession()
    DB-->>Server: Session created

    Server->>Client: 'session_created' event
    Client->>Client: Clear timeout
    Client->>Client: State: CONNECTED
```

## Failed Connection Flow (Invalid Token)

```mermaid
sequenceDiagram
    participant Client as Mobile Client
    participant SocketIO as Socket.IO
    participant Server as WebSocket Server
    participant Auth as Auth Service

    Client->>Client: State: DISCONNECTED
    Client->>SocketIO: connect() with invalid token
    Client->>Client: State: CONNECTING

    SocketIO->>Server: HTTP Upgrade Request
    Server->>SocketIO: 101 Switching Protocols

    SocketIO->>Client: 'connect' event
    Client->>Client: State: AUTHENTICATING
    Client->>Client: Start 10s timeout

    Server->>Auth: verifyToken(token)
    Auth->>Auth: Validate token
    Auth-->>Server: Token invalid

    Server->>Client: 'auth_error' event
    Server->>Client: disconnect()

    Client->>Client: Clear timeout
    Client->>Client: State: ERROR
    Client->>Client: Handle auth error
    Client->>Client: Fall back to guest token
    Client->>Client: Schedule reconnect
```

## Timeout Flow

```mermaid
sequenceDiagram
    participant Client as Mobile Client
    participant SocketIO as Socket.IO
    participant Server as WebSocket Server

    Client->>Client: State: DISCONNECTED
    Client->>SocketIO: connect() with token
    Client->>Client: State: CONNECTING

    SocketIO->>Server: HTTP Upgrade Request
    Server->>SocketIO: 101 Switching Protocols

    SocketIO->>Client: 'connect' event
    Client->>Client: State: AUTHENTICATING
    Client->>Client: Start 10s timeout

    Note over Server: Server processing delay<br/>(e.g., cold start)

    Client->>Client: 10s timeout expires
    Client->>Client: State: ERROR
    Client->>Client: Log timeout error
    Client->>Client: Schedule reconnect with backoff
```

## Guest Token Flow

```mermaid
sequenceDiagram
    participant User as User
    participant Client as Mobile Client
    participant Storage as SecureStorage
    participant Server as WebSocket Server
    participant Auth as Auth Service

    User->>Client: Skip sign-in
    Client->>Client: generateGuestToken()
    Note over Client: guest_<uuid>_<timestamp>

    Client->>Storage: Store guest token
    Client->>Client: connect()
    Client->>Client: State: CONNECTING

    Client->>Server: connect() with guest token
    Server->>Auth: verifyToken(guestToken)
    Auth->>Auth: Validate guest token format
    Auth->>Auth: Check token age < 1 hour
    Auth-->>Server: Token valid, isGuest: true

    Server->>Server: createGuestSession()
    Server->>Client: 'session_created' {isGuest: true}

    Client->>Client: State: CONNECTED
    Client->>User: Show "Guest Mode" UI
```

## Token Refresh Flow

```mermaid
sequenceDiagram
    participant Client as Mobile Client
    participant Server as WebSocket Server
    participant Auth as Auth Service
    participant TokenAPI as Token API

    Client->>Server: connect() with expired token
    Server->>Auth: verifyToken(token)
    Auth-->>Server: Token expired

    Server->>Client: 'auth_error' {code: 'AUTH_EXPIRED'}
    Client->>Client: State: ERROR

    Client->>TokenAPI: refreshToken()
    TokenAPI-->>Client: New JWT token

    Client->>Client: Store new token
    Client->>Client: Schedule reconnect (0ms)
    Client->>Server: connect() with new token

    Server->>Auth: verifyToken(newToken)
    Auth-->>Server: Token valid
    Server->>Client: 'session_created'
    Client->>Client: State: CONNECTED
```

## State Machine Diagram

```mermaid
stateDiagram-v2
    [*] --> DISCONNECTED

    DISCONNECTED --> CONNECTING: connect()

    CONNECTING --> AUTHENTICATING: Socket.IO 'connect' event
    CONNECTING --> ERROR: Connection failed

    AUTHENTICATING --> CONNECTED: 'session_created' received
    AUTHENTICATING --> ERROR: 'auth_error' received
    AUTHENTICATING --> ERROR: 10s timeout

    CONNECTED --> DISCONNECTED: disconnect()
    CONNECTED --> ERROR: Connection lost

    ERROR --> RECONNECTING: Schedule reconnect
    RECONNECTING --> CONNECTING: Retry after backoff

    ERROR --> DISCONNECTED: Manual disconnect
```

## Cloud Run Connection Flow

```mermaid
sequenceDiagram
    participant Client as Mobile Client
    participant LB as Load Balancer
    participant CR as Cloud Run Instance
    participant Server as WebSocket Server

    Note over CR: Instance may be cold

    Client->>LB: HTTP Upgrade Request
    LB->>CR: Route to instance

    alt Cold Start
        CR->>CR: Start container (5-10s)
        CR->>Server: Initialize server
    end

    CR->>LB: 101 Switching Protocols
    LB->>Client: 101 Switching Protocols

    Client->>Client: 'connect' event
    Client->>Client: State: AUTHENTICATING

    Note over Client,Server: Client waits up to 10s<br/>to account for cold start

    Server->>Server: Authenticate & create session
    Server->>Client: 'session_created'

    Client->>Client: State: CONNECTED
```

## Error Recovery Flow

```mermaid
flowchart TD
    Start[Connection Attempt] --> Connect[Socket.IO Connect]
    Connect --> Auth[Wait for Auth Response]

    Auth --> |session_created| Success[CONNECTED State]
    Auth --> |auth_error| CheckError{Error Code?}
    Auth --> |timeout| Timeout[Log Timeout]

    CheckError --> |AUTH_EXPIRED| Refresh[Refresh Token]
    CheckError --> |AUTH_INVALID| Guest[Use Guest Token]
    CheckError --> |AUTH_REQUIRED| Guest

    Refresh --> |Success| Reconnect[Reconnect]
    Refresh --> |Failure| Guest

    Guest --> Reconnect
    Timeout --> Reconnect

    Reconnect --> Backoff[Exponential Backoff]
    Backoff --> Start

    Success --> Monitor[Monitor Connection]
    Monitor --> |Disconnect| Start
```

## Authentication Decision Tree

```mermaid
flowchart TD
    Start[Receive Token] --> Check{Token Type?}

    Check --> |Starts with 'guest_'| GuestCheck{Valid Format?}
    Check --> |JWT| JWTCheck{Valid JWT?}
    Check --> |Empty/Null| NoToken[AUTH_REQUIRED]

    GuestCheck --> |Yes| AgeCheck{Age < 1 hour?}
    GuestCheck --> |No| InvalidGuest[AUTH_INVALID]

    AgeCheck --> |Yes| GuestSuccess[Create Guest Session]
    AgeCheck --> |No| ExpiredGuest[AUTH_EXPIRED]

    JWTCheck --> |Valid| JWTSuccess[Create User Session]
    JWTCheck --> |Invalid Signature| InvalidJWT[AUTH_INVALID]
    JWTCheck --> |Expired| ExpiredJWT[AUTH_EXPIRED]

    GuestSuccess --> Emit[Emit session_created]
    JWTSuccess --> Emit

    NoToken --> Error[Emit auth_error]
    InvalidGuest --> Error
    ExpiredGuest --> Error
    InvalidJWT --> Error
    ExpiredJWT --> Error

    Error --> Disconnect[Disconnect Client]
```

## Legend

### States

- **DISCONNECTED**: No active connection
- **CONNECTING**: Socket.IO establishing transport
- **AUTHENTICATING**: Waiting for server authentication response
- **CONNECTED**: Fully connected and authenticated
- **ERROR**: Connection or authentication failed
- **RECONNECTING**: Waiting before retry attempt

### Events

- **connect**: Socket.IO transport established
- **session_created**: Authentication successful, session created
- **auth_error**: Authentication failed
- **disconnect**: Connection closed

### Timeouts

- **Connection Timeout**: 30 seconds (Socket.IO)
- **Authentication Timeout**: 10 seconds (session_created wait)
- **Reconnection Backoff**: Exponential (1s, 2s, 4s, 8s, ...)

### Error Codes

- **AUTH_REQUIRED**: No authentication token provided
- **AUTH_INVALID**: Token format or signature invalid
- **AUTH_EXPIRED**: Token has expired
