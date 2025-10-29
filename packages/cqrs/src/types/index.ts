/**
 * Base Command interface
 * Commands represent write operations that change system state
 */
export interface Command {
  commandId: string;
  commandType: string;
  timestamp: Date;
  userId: string;
  metadata?: Record<string, any>;
}

/**
 * Base Query interface
 * Queries represent read operations that don't change system state
 */
export interface Query {
  queryId: string;
  queryType: string;
  timestamp: Date;
  userId: string;
  metadata?: Record<string, any>;
}

/**
 * Command result
 */
export interface CommandResult<T = any> {
  success: boolean;
  data?: T;
  error?: Error;
  events?: any[];
  timestamp: Date;
}

/**
 * Query result
 */
export interface QueryResult<T = any> {
  success: boolean;
  data?: T;
  error?: Error;
  timestamp: Date;
  fromCache?: boolean;
}

/**
 * Command handler interface
 */
export interface CommandHandler<TCommand extends Command, TResult = any> {
  handle(command: TCommand): Promise<CommandResult<TResult>>;
  validate(command: TCommand): Promise<void>;
}

/**
 * Query handler interface
 */
export interface QueryHandler<TQuery extends Query, TResult = any> {
  handle(query: TQuery): Promise<QueryResult<TResult>>;
}

/**
 * Command validation error
 */
export class CommandValidationError extends Error {
  constructor(
    message: string,
    public readonly violations: string[]
  ) {
    super(message);
    this.name = 'CommandValidationError';
  }
}

/**
 * Command authorization error
 */
export class CommandAuthorizationError extends Error {
  constructor(
    message: string,
    public readonly userId: string,
    public readonly resource: string
  ) {
    super(message);
    this.name = 'CommandAuthorizationError';
  }
}
