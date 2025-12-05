/**
 * WebSocket Hooks
 *
 * React hooks for WebSocket functionality:
 * - useWebSocket: Access WebSocket client instance
 * - useWebSocketEvent: Subscribe to WebSocket events
 * - useConnectionStatus: Monitor connection state
 */

import { useEffect, useState, useCallback } from 'react';

import {
  getWebSocketClient,
  ConnectionState,
  type WebSocketMessage,
} from '../services/WebSocketClient';

/**
 * Hook to access WebSocket client instance
 */
export const useWebSocket = () => {
  const client = getWebSocketClient();

  const send = useCallback(
    (message: WebSocketMessage) => {
      client.send(message);
    },
    [client]
  );

  const connect = useCallback(async () => {
    await client.connect();
  }, [client]);

  const disconnect = useCallback(() => {
    client.disconnect();
  }, [client]);

  return {
    client,
    send,
    connect,
    disconnect,
    isConnected: client.isConnected(),
    getLatency: () => client.getLatency(),
  };
};

/**
 * Hook to subscribe to WebSocket events
 */
export const useWebSocketEvent = (eventName: string, handler: (data: unknown) => void) => {
  const client = getWebSocketClient();

  useEffect(() => {
    const unsubscribe = client.on(eventName, handler);

    return () => {
      unsubscribe();
    };
  }, [client, eventName, handler]);
};

/**
 * Hook to monitor connection status
 */
export const useConnectionStatus = () => {
  const client = getWebSocketClient();
  const [connectionState, setConnectionState] = useState<ConnectionState>(
    client.getConnectionState()
  );
  const [latency, setLatency] = useState<number>(0);

  useEffect(() => {
    // Subscribe to connection state changes
    const unsubscribe = client.onConnectionStateChange((state) => {
      setConnectionState(state);
    });

    // Update latency periodically
    const latencyInterval = setInterval(() => {
      setLatency(client.getLatency());
    }, 5000);

    return () => {
      unsubscribe();
      clearInterval(latencyInterval);
    };
  }, [client]);

  return {
    connectionState,
    latency,
    isConnected: connectionState === ConnectionState.CONNECTED,
    isConnecting: connectionState === ConnectionState.CONNECTING,
    isReconnecting: connectionState === ConnectionState.RECONNECTING,
    isDisconnected: connectionState === ConnectionState.DISCONNECTED,
    hasError: connectionState === ConnectionState.ERROR,
  };
};
