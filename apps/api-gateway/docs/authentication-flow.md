# Authentication and Authorization Flow

## Overview

The DigiTwin Live API uses JWT (JSON Web Tokens) for authentication with a dual-token system:

- **Access Token**: Short-lived (15 minutes) token for API requests
- **Refresh Token**: Long-lived (7 days) token for obtaining new access tokens

## Authentication Methods

### 1. Email/Password Authentication

#### Registration

```http
POST /api/v1/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securePassword123",
  "name": "John Doe"
}
```

**Response:**

```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "subscriptionTier": "free",
    "roles": ["user"],
    "createdAt": "2025-10-28T...",
    "updatedAt": "2025-10-28T..."
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
  "expiresIn": 900
}
```

#### Login

```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

**Response:** Same as registration

### 2. OAuth Authentication

#### Google OAuth

```http
POST /api/v1/auth/oauth/google
Content-Type: application/json

{
  "token": "google_oauth_id_token"
}
```

#### Apple OAuth

```http
POST /api/v1/auth/oauth/apple
Content-Type: application/json

{
  "token": "apple_oauth_id_token"
}
```

**Response:** Same as email/password login

## Token Management

### Refresh Access Token

```http
POST /api/v1/auth/refresh
Content-Type: application/json

{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Response:**

```json
{
  "accessToken": "new_access_token",
  "refreshToken": "new_refresh_token",
  "expiresIn": 900
}
```

### Logout (Revoke Refresh Token)

```http
POST /api/v1/auth/logout
Content-Type: application/json

{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Response:**

```json
{
  "message": "Logout successful"
}
```

## Using Access Tokens

Include the access token in the `Authorization` header for all authenticated requests:

```http
GET /api/v1/auth/me
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

## JWT Payload Structure

### Access Token Payload

```json
{
  "userId": "uuid",
  "email": "user@example.com",
  "subscriptionTier": "free",
  "permissions": ["conversation:create", "conversation:read", "knowledge:read"],
  "roles": ["user"],
  "iat": 1234567890,
  "exp": 1234568790
}
```

### Refresh Token Payload

```json
{
  "userId": "uuid",
  "tokenId": "unique_token_id",
  "iat": 1234567890,
  "exp": 1235172690
}
```

## Role-Based Access Control (RBAC)

### Roles

- **user**: Standard user with basic permissions
- **admin**: Administrator with full system access

### Subscription Tiers

- **free**: Basic features (60 min/day conversations)
- **pro**: Advanced features (unlimited conversations, voice cloning)
- **enterprise**: All features + team management

### Permissions by Tier

#### Free Tier

- `conversation:create`
- `conversation:read`
- `knowledge:read`

#### Pro Tier (includes Free)

- `knowledge:write`
- `voice:create`
- `face:create`

#### Enterprise Tier (includes Pro)

- `analytics:read`
- `team:manage`

#### Admin Role

- `admin:all`
- `user:manage`
- `system:manage`

## WebSocket Authentication

WebSocket connections require authentication via JWT token:

```javascript
const socket = io('wss://api.example.com', {
  auth: {
    token: 'your_access_token',
  },
});

// Or via headers
const socket = io('wss://api.example.com', {
  extraHeaders: {
    Authorization: 'Bearer your_access_token',
  },
});
```

## Error Codes

| Code                    | Status | Description                               |
| ----------------------- | ------ | ----------------------------------------- |
| `UNAUTHORIZED`          | 401    | No authentication provided                |
| `INVALID_TOKEN`         | 401    | Token is invalid or malformed             |
| `TOKEN_EXPIRED`         | 401    | Access token has expired                  |
| `INVALID_CREDENTIALS`   | 401    | Email/password is incorrect               |
| `FORBIDDEN`             | 403    | Insufficient permissions                  |
| `SUBSCRIPTION_REQUIRED` | 403    | Feature requires higher subscription tier |
| `USER_EXISTS`           | 409    | Email already registered                  |

## Security Best Practices

1. **Store tokens securely**
   - Use secure storage (Keychain on iOS, Keystore on Android)
   - Never store tokens in localStorage in web apps

2. **Handle token expiry**
   - Implement automatic token refresh before expiry
   - Handle 401 errors by refreshing token

3. **Revoke tokens on logout**
   - Always call the logout endpoint to revoke refresh tokens
   - Clear all stored tokens from client

4. **Use HTTPS only**
   - All API calls must use HTTPS in production
   - WebSocket connections must use WSS

5. **Implement token rotation**
   - Refresh tokens are rotated on each refresh
   - Old refresh tokens are invalidated

## Example: Token Refresh Flow

```javascript
async function makeAuthenticatedRequest(url, options = {}) {
  let accessToken = getStoredAccessToken();

  // Add auth header
  options.headers = {
    ...options.headers,
    Authorization: `Bearer ${accessToken}`,
  };

  let response = await fetch(url, options);

  // If token expired, refresh and retry
  if (response.status === 401) {
    const refreshToken = getStoredRefreshToken();

    const refreshResponse = await fetch('/api/v1/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (refreshResponse.ok) {
      const { accessToken: newAccessToken, refreshToken: newRefreshToken } =
        await refreshResponse.json();

      // Store new tokens
      storeTokens(newAccessToken, newRefreshToken);

      // Retry original request
      options.headers['Authorization'] = `Bearer ${newAccessToken}`;
      response = await fetch(url, options);
    } else {
      // Refresh failed, redirect to login
      redirectToLogin();
    }
  }

  return response;
}
```

## Environment Variables

```bash
# JWT Configuration
JWT_SECRET=your-secret-key-here
REFRESH_SECRET=your-refresh-secret-here
ACCESS_TOKEN_EXPIRY=15m
REFRESH_TOKEN_EXPIRY=7d

# OAuth Configuration (Production)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
APPLE_CLIENT_ID=your-apple-client-id
APPLE_TEAM_ID=your-apple-team-id
APPLE_KEY_ID=your-apple-key-id
```

## Testing Authentication

### Using cURL

```bash
# Register
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123","name":"Test User"}'

# Login
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'

# Get current user
curl -X GET http://localhost:3000/api/v1/auth/me \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# Refresh token
curl -X POST http://localhost:3000/api/v1/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"YOUR_REFRESH_TOKEN"}'
```

### Using Postman

1. Import the OpenAPI spec from `/docs.json`
2. Set up environment variables for tokens
3. Use the "Bearer Token" auth type
4. Configure automatic token refresh in pre-request scripts
