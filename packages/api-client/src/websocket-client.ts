import type { ClientMessage, ServerMessage } from '@clone/shared-types';
import { io, Socket } from 'socket.io-client';

export interface WebSocketClientConfig {
  url: string;
  token: string;
  reconnection?: boolean;
  reconnectionDelay?: number;
  reconnectionAttempts?: number;
}

export class WebSocketClient {
  private socket: Socket | null = null;
  private config: WebSocketClientConfig;
  private messageHandlers: Map<string, (message: ServerMessage) => void> = new Map();

  constructor(config: WebSocketClientConfig) {
    this.config = config;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log('[WebSocketClient] Attempting to connect to:', this.config.url);
      console.log('[WebSocketClient] Token length:', this.config.token?.length || 0);

      this.socket = io(this.config.url, {
        auth: {
          token: this.config.token,
        },
        reconnection: this.config.reconnection ?? true,
        reconnectionDelay: this.config.reconnectionDelay ?? 1000,
        reconnectionAttempts: this.config.reconnectionAttempts ?? 5,
        // Use polling first for React Native compatibility, then upgrade to websocket
        transports: ['polling', 'websocket'],
        timeout: 20000,
        forceNew: true,
        // Additional options for React Native
        upgrade: true,
        rememberUpgrade: false,
      });

      this.socket.on('connect', () => {
        console.log('[WebSocketClient] Connected successfully!');
        resolve();
      });

      this.socket.on('connect_error', (error) => {
        console.error('[WebSocketClient] Connection error:', error.message);
        console.error('[WebSocketClient] Error details:', JSON.stringify(error));
        reject(error);
      });

      this.socket.on('connect_timeout', () => {
        console.error('[WebSocketClient] Connection timeout');
        reject(new Error('Connection timeout'));
      });

      this.socket.on('error', (error) => {
        console.error('[WebSocketClient] Socket error:', error);
      });

      this.socket.on('disconnect', (reason) => {
        console.log('[WebSocketClient] Disconnected:', reason);
      });

      this.socket.on('message', (message: ServerMessage) => {
        const handler = this.messageHandlers.get(message.type);
        if (handler) {
          handler(message);
        }
      });
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  send(message: ClientMessage) {
    if (!this.socket) {
      throw new Error('WebSocket not connected');
    }
    this.socket.emit('message', message);
  }

  on(messageType: string, handler: (message: ServerMessage) => void) {
    this.messageHandlers.set(messageType, handler);
  }

  off(messageType: string) {
    this.messageHandlers.delete(messageType);
  }

  onConnect(handler: () => void) {
    if (this.socket) {
      this.socket.on('connect', handler);
    }
  }

  onDisconnect(handler: () => void) {
    if (this.socket) {
      this.socket.on('disconnect', handler);
    }
  }

  onError(handler: (error: Error) => void) {
    if (this.socket) {
      this.socket.on('error', handler);
    }
  }

  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }
}
