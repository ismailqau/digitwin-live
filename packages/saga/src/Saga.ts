/**
 * Saga Pattern Implementation for Distributed Transactions
 * 
 * Provides orchestration for multi-service transactions with compensation logic
 * to maintain consistency across microservices.
 */

export interface SagaStep<T = any, R = any> {
  name: string;
  action: (context: T) => Promise<R>;
  compensation: (context: T, result?: R) => Promise<void>;
}

export interface SagaContext {
  [key: string]: any;
}

export interface SagaResult<T = any> {
  success: boolean;
  context: T;
  error?: Error;
  completedSteps: string[];
  failedStep?: string;
}

export enum SagaState {
  PENDING = 'PENDING',
  EXECUTING = 'EXECUTING',
  COMPENSATING = 'COMPENSATING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  COMPENSATED = 'COMPENSATED',
}

export class Saga<T extends SagaContext = SagaContext> {
  private steps: SagaStep<T>[] = [];
  private state: SagaState = SagaState.PENDING;
  private completedSteps: Array<{ step: SagaStep<T>; result: any }> = [];

  constructor(private initialContext: T) {}

  /**
   * Add a step to the saga
   */
  addStep(step: SagaStep<T>): this {
    if (this.state !== SagaState.PENDING) {
      throw new Error('Cannot add steps to a saga that has already started');
    }
    this.steps.push(step);
    return this;
  }

  /**
   * Execute the saga
   */
  async execute(): Promise<SagaResult<T>> {
    if (this.state !== SagaState.PENDING) {
      throw new Error('Saga has already been executed');
    }

    this.state = SagaState.EXECUTING;
    const context = { ...this.initialContext } as T;
    const completedStepNames: string[] = [];

    try {
      // Execute each step in sequence
      for (const step of this.steps) {
        try {
          const result = await step.action(context);
          this.completedSteps.push({ step, result });
          completedStepNames.push(step.name);
          
          // Store result in context for next steps
          (context as any)[`${step.name}_result`] = result;
        } catch (error) {
          // Step failed, start compensation
          this.state = SagaState.COMPENSATING;
          await this.compensate(context);
          
          return {
            success: false,
            context,
            error: error as Error,
            completedSteps: completedStepNames,
            failedStep: step.name,
          };
        }
      }

      // All steps completed successfully
      this.state = SagaState.COMPLETED;
      return {
        success: true,
        context,
        completedSteps: completedStepNames,
      };
    } catch (error) {
      // Unexpected error during execution
      this.state = SagaState.FAILED;
      return {
        success: false,
        context,
        error: error as Error,
        completedSteps: completedStepNames,
      };
    }
  }

  /**
   * Compensate completed steps in reverse order
   */
  private async compensate(context: T): Promise<void> {
    // Compensate in reverse order
    const stepsToCompensate = [...this.completedSteps].reverse();

    for (const { step, result } of stepsToCompensate) {
      try {
        await step.compensation(context, result);
      } catch (error) {
        // Log compensation failure but continue with other compensations
        // In production, use a proper logger instead of console
        if (typeof process !== 'undefined' && process.stderr) {
          process.stderr.write(`Compensation failed for step ${step.name}: ${error}\n`);
        }
      }
    }

    this.state = SagaState.COMPENSATED;
  }

  /**
   * Get current saga state
   */
  getState(): SagaState {
    return this.state;
  }

  /**
   * Get completed steps
   */
  getCompletedSteps(): string[] {
    return this.completedSteps.map(({ step }) => step.name);
  }
}

/**
 * Saga Builder for fluent API
 */
export class SagaBuilder<T extends SagaContext = SagaContext> {
  private saga: Saga<T>;

  constructor(initialContext: T) {
    this.saga = new Saga(initialContext);
  }

  /**
   * Add a step with action and compensation
   */
  step(
    name: string,
    action: (context: T) => Promise<any>,
    compensation: (context: T, result?: any) => Promise<void>
  ): this {
    this.saga.addStep({ name, action, compensation });
    return this;
  }

  /**
   * Build and return the saga
   */
  build(): Saga<T> {
    return this.saga;
  }

  /**
   * Build and execute the saga
   */
  async execute(): Promise<SagaResult<T>> {
    return this.saga.execute();
  }
}

/**
 * Create a new saga builder
 */
export function createSaga<T extends SagaContext = SagaContext>(
  initialContext: T
): SagaBuilder<T> {
  return new SagaBuilder(initialContext);
}
