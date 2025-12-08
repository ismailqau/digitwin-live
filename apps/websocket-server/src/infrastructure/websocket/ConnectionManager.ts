/**
 * Connection Manager for native WebSocket connections
 *
 * Manages WebSocket connections with session tracking
 */

import WebSocket from 'ws';

/**
 * WebSocket connection with metadata
 */
export interface WebSocketConnection {
  id: string;
  ws: WebSocket;
  userId?: string;
  sessionId?: string;
  isAuthenticated: boolean;
  lastPing: number;
  createdAt: number;
}

/**
 * Manages WebSocket connections
 */
export class ConnectionManager {
  private connections: Map<string, WebSocketConnection> = new Map();

  /**
   * Registers a new connection
   */
  registerConnection(id: string, connection: WebSocketConnection): void {
    this.connections.set(id, connection);
  }

  /**
   * Unregisters a connection
   */
  unregisterConnection(id: string): void {
    this.connections.delete(id);
  }

  /**
   * Gets a connection by ID
   */
  getConnection(id: string): WebSocketConnection | undefined {
    return this.connections.get(id);
  }

  /**
   * Gets all connections for a session
   */
  getConnectionsBySession(sessionId: string): WebSocketConnection[] {
    const result: WebSocketConnection[] = [];
    for (const connection of this.connections.values()) {
      if (connection.sessionId === sessionId) {
        result.push(connection);
      }
    }
    return result;
  }

  /**
   * Gets all connections for a user
   */
  getConnectionsByUser(userId: string): WebSocketConnection[] {
    const result: WebSocketConnection[] = [];
    for (const connection of this.connections.values()) {
      if (connection.userId === userId) {
        result.push(connection);
      }
    }
    return result;
  }

  /**
   * Gets the count of active connections
   */
  getActiveConnectionCount(): number {
    return this.connections.size;
  }

  /**
   * Updates connection metadata
   */
  updateConnection(id: string, updates: Partial<WebSocketConnection>): void {
    const connection = this.connections.get(id);
    if (connection) {
      Object.assign(connection, updates);
    }
  }

  /**
   * Gets all connections
   */
  getAllConnections(): WebSocketConnection[] {
    return Array.from(this.connections.values());
  }

  /**
   * Clears all connections
   */
  clear(): void {
    this.connections.clear();
  }
}
