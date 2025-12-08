/**
 * Message Protocol for native WebSocket communication
 *
 * Implements Requirements:
 * - 3.1: Message envelope with type, sessionId, data, and timestamp
 * - 3.2: JSON parsing and routing to event handlers
 * - 3.3: Error handling for invalid messages
 */

/**
 * Message envelope structure for all WebSocket messages
 */
export interface MessageEnvelope {
  type: string;
  sessionId?: string;
  data?: unknown;
  timestamp: number;
}

/**
 * Result of message deserialization
 */
export interface DeserializeResult {
  success: boolean;
  message?: MessageEnvelope;
  error?: string;
}

/**
 * Validates a message envelope object
 */
function validateMessageEnvelope(obj: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (typeof obj !== 'object' || obj === null) {
    return { valid: false, errors: ['Message must be an object'] };
  }

  const message = obj as Record<string, unknown>;

  // Validate type (required, non-empty string)
  if (typeof message.type !== 'string' || message.type.length === 0) {
    errors.push('type must be a non-empty string');
  }

  // Validate sessionId (optional string)
  if (message.sessionId !== undefined && typeof message.sessionId !== 'string') {
    errors.push('sessionId must be a string if provided');
  }

  // Validate timestamp (required, positive integer)
  if (
    typeof message.timestamp !== 'number' ||
    !Number.isInteger(message.timestamp) ||
    message.timestamp <= 0
  ) {
    errors.push('timestamp must be a positive integer');
  }

  // data can be anything, no validation needed

  return { valid: errors.length === 0, errors };
}

/**
 * Message protocol handler for serialization/deserialization
 */
export class MessageProtocol {
  /**
   * Serializes a message envelope to JSON string
   */
  static serialize(message: MessageEnvelope): string {
    return JSON.stringify(message);
  }

  /**
   * Deserializes a JSON string to a message envelope
   * Returns a result object instead of throwing
   */
  static deserialize(data: string): DeserializeResult {
    try {
      const parsed = JSON.parse(data);
      const validation = validateMessageEnvelope(parsed);

      if (!validation.valid) {
        return {
          success: false,
          error: `Invalid message format: ${validation.errors.join(', ')}`,
        };
      }

      return {
        success: true,
        message: parsed as MessageEnvelope,
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? `JSON parse error: ${error.message}` : 'Unknown parse error',
      };
    }
  }

  /**
   * Validates if an object is a valid message envelope
   */
  static validate(message: unknown): message is MessageEnvelope {
    const validation = validateMessageEnvelope(message);
    return validation.valid;
  }

  /**
   * Creates a message envelope with current timestamp
   */
  static createEnvelope(type: string, data?: unknown, sessionId?: string): MessageEnvelope {
    return {
      type,
      sessionId,
      data,
      timestamp: Date.now(),
    };
  }

  /**
   * Creates an error response envelope
   */
  static createErrorEnvelope(code: string, message: string, sessionId?: string): MessageEnvelope {
    return this.createEnvelope('error', { code, message }, sessionId);
  }
}
