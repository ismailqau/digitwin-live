/**
 * WebSocket Monitor Service
 *
 * Handles detailed logging and monitoring of WebSocket connections and messages.
 * Adds correlation IDs and timestamps to events for better debugging.
 */

export interface LogEntry {
  timestamp: number;
  level: 'info' | 'warn' | 'error' | 'debug';
  type: 'connection' | 'message' | 'error' | 'lifecycle';
  message: string;
  data?: unknown;
  correlationId?: string;
}

class WebSocketMonitor {
  private static instance: WebSocketMonitor;
  private logs: LogEntry[] = [];
  private readonly MAX_LOGS = 1000;

  private constructor() {}

  static getInstance(): WebSocketMonitor {
    if (!WebSocketMonitor.instance) {
      WebSocketMonitor.instance = new WebSocketMonitor();
    }
    return WebSocketMonitor.instance;
  }

  /**
   * info
   * Log an info message
   */
  info(type: LogEntry['type'], message: string, data?: unknown, correlationId?: string) {
    this.addLog('info', type, message, data, correlationId);
    console.log(`[WS-Monitor] ℹ️ [${type}] ${message}`, data || '');
  }

  /**
   * warn
   * Log a warning message
   */
  warn(type: LogEntry['type'], message: string, data?: unknown, correlationId?: string) {
    this.addLog('warn', type, message, data, correlationId);
    console.warn(`[WS-Monitor] ⚠️ [${type}] ${message}`, data || '');
  }

  /**
   * error
   * Log an error message
   */
  error(type: LogEntry['type'], message: string, data?: unknown, correlationId?: string) {
    this.addLog('error', type, message, data, correlationId);
    console.error(`[WS-Monitor] ❌ [${type}] ${message}`, data || '');
  }

  /**
   * debug
   * Log a debug message
   */
  debug(type: LogEntry['type'], message: string, data?: unknown, correlationId?: string) {
    if (__DEV__) {
      this.addLog('debug', type, message, data, correlationId);
      console.log(`[WS-Monitor] 🔍 [${type}] ${message}`, data || '');
    }
  }

  private addLog(
    level: LogEntry['level'],
    type: LogEntry['type'],
    message: string,
    data?: unknown,
    correlationId?: string
  ) {
    const entry: LogEntry = {
      timestamp: Date.now(),
      level,
      type,
      message,
      data,
      correlationId,
    };

    this.logs.unshift(entry);

    if (this.logs.length > this.MAX_LOGS) {
      this.logs.pop();
    }
  }

  getLogs(): LogEntry[] {
    return this.logs;
  }

  clearLogs() {
    this.logs = [];
  }
}

export default WebSocketMonitor.getInstance();
