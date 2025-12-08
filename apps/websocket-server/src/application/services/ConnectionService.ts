import { injectable } from 'tsyringe';
import WebSocket from 'ws';

import { ServerMessage } from '../../domain/models/Message';
import { MessageProtocol } from '../../infrastructure/websocket/MessageProtocol';

/**
 * Connection info stored for each session
 */
interface ConnectionInfo {
  ws: WebSocket;
  connectionId: string;
}

@injectable()
export class ConnectionService {
  private connections: Map<string, ConnectionInfo> = new Map();

  /**
   * Registers a WebSocket connection for a session
   */
  registerConnection(sessionId: string, ws: WebSocket, connectionId?: string): void {
    this.connections.set(sessionId, {
      ws,
      connectionId: connectionId || sessionId,
    });
  }

  /**
   * Unregisters a connection for a session
   */
  unregisterConnection(sessionId: string): void {
    this.connections.delete(sessionId);
  }

  /**
   * Sends a message to a client by session ID
   */
  sendToClient(sessionId: string, message: ServerMessage): boolean {
    const connectionInfo = this.connections.get(sessionId);
    if (!connectionInfo || connectionInfo.ws.readyState !== WebSocket.OPEN) {
      return false;
    }

    try {
      // Wrap the message in an envelope
      const envelope = MessageProtocol.createEnvelope('message', message, sessionId);
      connectionInfo.ws.send(MessageProtocol.serialize(envelope));
      return true;
    } catch (error) {
      console.error(`Failed to send message to session ${sessionId}:`, error);
      return false;
    }
  }

  /**
   * Gets the WebSocket for a session
   */
  getConnection(sessionId: string): WebSocket | undefined {
    return this.connections.get(sessionId)?.ws;
  }

  /**
   * Checks if a session is connected
   */
  isConnected(sessionId: string): boolean {
    const connectionInfo = this.connections.get(sessionId);
    return connectionInfo !== undefined && connectionInfo.ws.readyState === WebSocket.OPEN;
  }

  /**
   * Gets the count of active connections
   */
  getActiveConnectionCount(): number {
    return this.connections.size;
  }

  /**
   * Emits an event to a client (for backward compatibility)
   */
  emit(sessionId: string, event: string, data: unknown): boolean {
    const connectionInfo = this.connections.get(sessionId);
    if (!connectionInfo || connectionInfo.ws.readyState !== WebSocket.OPEN) {
      return false;
    }

    try {
      const envelope = MessageProtocol.createEnvelope(event, data, sessionId);
      connectionInfo.ws.send(MessageProtocol.serialize(envelope));
      return true;
    } catch (error) {
      console.error(`Failed to emit ${event} to session ${sessionId}:`, error);
      return false;
    }
  }
}
