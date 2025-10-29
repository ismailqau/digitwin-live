import { Command, CommandHandler, CommandResult, CommandValidationError, CommandAuthorizationError } from '../types';

/**
 * Base Command Handler
 * Provides common functionality for command handlers
 */
export abstract class BaseCommandHandler<TCommand extends Command, TResult = any>
  implements CommandHandler<TCommand, TResult>
{
  /**
   * Handle the command
   */
  abstract handle(command: TCommand): Promise<CommandResult<TResult>>;

  /**
   * Validate the command
   */
  async validate(command: TCommand): Promise<void> {
    const violations: string[] = [];

    // Basic validation
    if (!command.commandId) {
      violations.push('commandId is required');
    }
    if (!command.commandType) {
      violations.push('commandType is required');
    }
    if (!command.userId) {
      violations.push('userId is required');
    }
    if (!command.timestamp) {
      violations.push('timestamp is required');
    }

    // Custom validation
    const customViolations = await this.validateCommand(command);
    violations.push(...customViolations);

    if (violations.length > 0) {
      throw new CommandValidationError('Command validation failed', violations);
    }
  }

  /**
   * Custom validation logic (override in subclasses)
   */
  protected async validateCommand(_command: TCommand): Promise<string[]> {
    return [];
  }

  /**
   * Authorize the command
   */
  protected async authorize(command: TCommand, resource: string): Promise<void> {
    const authorized = await this.checkAuthorization(command, resource);
    if (!authorized) {
      throw new CommandAuthorizationError(
        `User ${command.userId} is not authorized to access ${resource}`,
        command.userId,
        resource
      );
    }
  }

  /**
   * Check authorization (override in subclasses)
   */
  protected async checkAuthorization(_command: TCommand, _resource: string): Promise<boolean> {
    // Default: allow all (override in subclasses for actual authorization)
    return true;
  }

  /**
   * Create success result
   */
  protected success<T>(data: T, events: any[] = []): CommandResult<T> {
    return {
      success: true,
      data,
      events,
      timestamp: new Date(),
    };
  }

  /**
   * Create error result
   */
  protected error(error: Error): CommandResult {
    return {
      success: false,
      error,
      timestamp: new Date(),
    };
  }
}
