/**
 * Authentication Handler for native WebSocket connections
 *
 * Implements Requirements:
 * - 2.1: JWT token authentication in initial handshake
 * - 2.2: Session creation and session_created event
 */

import { IncomingMessage } from 'http';

import WebSocket from 'ws';

import {
  AuthService,
  TokenPayload,
  AuthError,
  AuthErrorCode,
} from '../../application/services/AuthService';
import logger from '../logging/logger';

import { MessageProtocol } from './MessageProtocol';

/**
 * Authentication result
 */
export interface AuthenticationResult {
  success: boolean;
  payload?: TokenPayload;
  error?: {
    code: string;
    message: string;
  };
}

/**
 * Session created payload
 */
export interface SessionCreatedPayload {
  sessionId: string;
  userId: string;
  isGuest: boolean;
  timestamp: number;
}

/**
 * Auth error payload
 */
export interface AuthErrorPayload {
  code: string;
  message: string;
  timestamp: number;
}

/**
 * Handles authentication for WebSocket connections
 */
export class AuthenticationHandler {
  constructor(private authService: AuthService) {}

  /**
   * Authenticates a connection using the token from the request
   */
  async authenticateConnection(
    token: string | undefined,
    connectionId: string
  ): Promise<TokenPayload> {
    logger.debug('[AuthenticationHandler] Authenticating connection', {
      connectionId,
      hasToken: !!token,
    });

    // This will throw AuthError if authentication fails
    return this.authService.verifyToken(token);
  }

  /**
   * Extracts token from the WebSocket upgrade request
   * Supports:
   * - Query parameter: ?token=xxx
   * - Authorization header: Bearer xxx
   * - Sec-WebSocket-Protocol header (for browsers that can't set custom headers)
   */
  extractTokenFromRequest(request: IncomingMessage): string | undefined {
    // Try query parameter first
    const url = new URL(request.url || '', `http://${request.headers.host || 'localhost'}`);
    const queryToken = url.searchParams.get('token');
    if (queryToken) {
      return queryToken;
    }

    // Try Authorization header
    const authHeader = request.headers.authorization;
    if (authHeader) {
      const parts = authHeader.split(' ');
      if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
        return parts[1];
      }
      // If no Bearer prefix, use the whole header
      return authHeader;
    }

    // Try Sec-WebSocket-Protocol header (used by some clients)
    const protocol = request.headers['sec-websocket-protocol'];
    if (protocol && typeof protocol === 'string') {
      // Protocol might be comma-separated, look for token
      const protocols = protocol.split(',').map((p) => p.trim());
      for (const p of protocols) {
        if (p.startsWith('token.')) {
          return p.substring(6); // Remove 'token.' prefix
        }
      }
    }

    return undefined;
  }

  /**
   * Sends an authentication error to the client
   */
  sendAuthError(ws: WebSocket, code: string, message: string): void {
    const payload: AuthErrorPayload = {
      code,
      message,
      timestamp: Date.now(),
    };

    const envelope = MessageProtocol.createEnvelope('auth_error', payload);

    try {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(MessageProtocol.serialize(envelope));
      }
    } catch (error) {
      logger.error('[AuthenticationHandler] Failed to send auth error', {
        code,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Sends a session_created event to the client
   */
  sendSessionCreated(ws: WebSocket, sessionId: string, userId: string, isGuest: boolean): void {
    const payload: SessionCreatedPayload = {
      sessionId,
      userId,
      isGuest,
      timestamp: Date.now(),
    };

    const envelope = MessageProtocol.createEnvelope('session_created', payload);

    try {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(MessageProtocol.serialize(envelope));
      }
    } catch (error) {
      logger.error('[AuthenticationHandler] Failed to send session_created', {
        sessionId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Maps AuthError to error code and message
   */
  mapAuthError(error: unknown): { code: string; message: string } {
    if (error instanceof AuthError) {
      return {
        code: error.code,
        message: error.message,
      };
    }

    if (error instanceof Error) {
      if (error.message === 'Session creation timeout') {
        return {
          code: AuthErrorCode.AUTH_INVALID,
          message: 'Session creation failed',
        };
      }
      return {
        code: AuthErrorCode.AUTH_INVALID,
        message: error.message,
      };
    }

    return {
      code: AuthErrorCode.AUTH_INVALID,
      message: 'Authentication failed',
    };
  }
}
