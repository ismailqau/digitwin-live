import { Command, CommandHandler, CommandResult, CommandValidationError } from '../types';
import { AllCommands, CommandType } from '../commands';
import { EventPublisher } from '@clone/event-bus';

export interface CommandBusConfig {
  eventPublisher?: EventPublisher;
  enableValidation?: boolean;
  enableAuthorization?: boolean;
}

/**
 * Command Bus
 * Routes commands to their respective handlers
 */
export class CommandBus {
  private handlers: Map<string, CommandHandler<any, any>>;
  private config: CommandBusConfig;

  constructor(config: CommandBusConfig = {}) {
    this.handlers = new Map();
    this.config = {
      enableValidation: true,
      enableAuthorization: true,
      ...config,
    };
  }

  /**
   * Register a command handler
   */
  register<TCommand extends Command>(
    commandType: CommandType,
    handler: CommandHandler<TCommand, any>
  ): void {
    if (this.handlers.has(commandType)) {
      throw new Error(`Handler already registered for command type: ${commandType}`);
    }
    this.handlers.set(commandType, handler);
  }

  /**
   * Execute a command
   */
  async execute<TCommand extends AllCommands>(
    command: TCommand
  ): Promise<CommandResult> {
    const handler = this.handlers.get(command.commandType);
    if (!handler) {
      throw new Error(`No handler registered for command type: ${command.commandType}`);
    }

    try {
      // Validate command if enabled
      if (this.config.enableValidation) {
        await handler.validate(command);
      }

      // Execute command
      const result = await handler.handle(command);

      // Publish events if available
      if (result.success && result.events && this.config.eventPublisher) {
        for (const event of result.events) {
          await this.config.eventPublisher.publish(event);
        }
      }

      return result;
    } catch (error) {
      if (error instanceof CommandValidationError) {
        return {
          success: false,
          error: error,
          timestamp: new Date(),
        };
      }
      throw error;
    }
  }

  /**
   * Execute multiple commands in sequence
   */
  async executeMany<TCommand extends AllCommands>(
    commands: TCommand[]
  ): Promise<CommandResult[]> {
    const results: CommandResult[] = [];
    for (const command of commands) {
      const result = await this.execute(command);
      results.push(result);
      // Stop on first failure
      if (!result.success) {
        break;
      }
    }
    return results;
  }

  /**
   * Get registered handler for a command type
   */
  getHandler(commandType: CommandType): CommandHandler<any, any> | undefined {
    return this.handlers.get(commandType);
  }

  /**
   * Check if a handler is registered
   */
  hasHandler(commandType: CommandType): boolean {
    return this.handlers.has(commandType);
  }
}
