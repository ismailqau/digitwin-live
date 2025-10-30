import { BaseCommandHandler } from '../handlers/BaseCommandHandler';
import { CreateUserCommand } from '../commands';
import { CommandResult } from '../types';
import { UserCreatedEvent } from '@clone/event-bus';
import { v4 as uuidv4 } from 'uuid';

/**
 * Example: Create User Command Handler
 * Demonstrates how to implement a command handler with validation and event emission
 */
export class CreateUserCommandHandler extends BaseCommandHandler<
  CreateUserCommand,
  { userId: string }
> {
  /**
   * Validate the command
   */
  protected async validateCommand(command: CreateUserCommand): Promise<string[]> {
    const violations: string[] = [];

    // Validate email
    if (!command.payload.email) {
      violations.push('email is required');
    } else if (!this.isValidEmail(command.payload.email)) {
      violations.push('email is invalid');
    }

    // Validate name
    if (!command.payload.name || command.payload.name.trim().length === 0) {
      violations.push('name is required');
    }

    // Validate password
    if (!command.payload.password || command.payload.password.length < 8) {
      violations.push('password must be at least 8 characters');
    }

    // Validate subscription tier
    const validTiers = ['free', 'pro', 'enterprise'];
    if (!validTiers.includes(command.payload.subscriptionTier)) {
      violations.push('subscriptionTier must be one of: free, pro, enterprise');
    }

    return violations;
  }

  /**
   * Handle the command
   */
  async handle(command: CreateUserCommand): Promise<CommandResult<{ userId: string }>> {
    try {
      // In a real implementation, this would interact with the database
      // For this example, we'll simulate the operation
      const userId = uuidv4();

      // Create the user (simulated)
      // await this.userRepository.create({
      //   id: userId,
      //   email: command.payload.email,
      //   name: command.payload.name,
      //   password: await this.hashPassword(command.payload.password),
      //   subscriptionTier: command.payload.subscriptionTier,
      // });

      // Create domain event
      const event: UserCreatedEvent = {
        eventId: uuidv4(),
        eventType: 'user.created',
        timestamp: new Date(),
        aggregateId: userId,
        aggregateType: 'user',
        version: 1,
        payload: {
          userId,
          email: command.payload.email,
          name: command.payload.name,
          subscriptionTier: command.payload.subscriptionTier,
        },
      };

      return this.success({ userId }, [event]);
    } catch (error) {
      return this.error(error as Error);
    }
  }

  /**
   * Validate email format
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}
