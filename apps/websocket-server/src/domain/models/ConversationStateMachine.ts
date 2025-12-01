import { ConversationState } from '@clone/shared-types';

/**
 * Conversation State Machine
 *
 * State Transitions:
 * - idle → listening: User starts speaking (VAD detects speech)
 * - listening → processing: User stops speaking (VAD silence detected)
 * - processing → speaking: First audio chunk ready from TTS
 * - speaking → idle: Response playback complete
 * - any state → interrupted: User speaks during clone response
 * - interrupted → listening: Interruption acknowledged, ready for new input
 */
export class ConversationStateMachine {
  private static readonly VALID_TRANSITIONS: Map<ConversationState, ConversationState[]> = new Map([
    [ConversationState.IDLE, [ConversationState.LISTENING, ConversationState.ERROR]],
    [
      ConversationState.LISTENING,
      [
        ConversationState.PROCESSING,
        ConversationState.IDLE,
        ConversationState.INTERRUPTED,
        ConversationState.ERROR,
      ],
    ],
    [
      ConversationState.PROCESSING,
      [
        ConversationState.SPEAKING,
        ConversationState.IDLE,
        ConversationState.INTERRUPTED,
        ConversationState.ERROR,
      ],
    ],
    [
      ConversationState.SPEAKING,
      [ConversationState.IDLE, ConversationState.INTERRUPTED, ConversationState.ERROR],
    ],
    [
      ConversationState.INTERRUPTED,
      [ConversationState.LISTENING, ConversationState.IDLE, ConversationState.ERROR],
    ],
    [ConversationState.ERROR, [ConversationState.IDLE]],
  ]);

  /**
   * Validates if a state transition is allowed
   */
  static canTransition(from: ConversationState, to: ConversationState): boolean {
    const allowedTransitions = this.VALID_TRANSITIONS.get(from);
    if (!allowedTransitions) {
      return false;
    }
    return allowedTransitions.includes(to);
  }

  /**
   * Validates and returns the next state, or throws an error if invalid
   */
  static transition(from: ConversationState, to: ConversationState): ConversationState {
    if (!this.canTransition(from, to)) {
      throw new Error(
        `Invalid state transition: ${from} → ${to}. Allowed transitions from ${from}: ${this.VALID_TRANSITIONS.get(from)?.join(', ') || 'none'}`
      );
    }
    return to;
  }

  /**
   * Gets all valid next states from the current state
   */
  static getValidNextStates(from: ConversationState): ConversationState[] {
    return this.VALID_TRANSITIONS.get(from) || [];
  }

  /**
   * Checks if the state is a terminal state (no outgoing transitions except error)
   */
  static isTerminalState(state: ConversationState): boolean {
    const transitions = this.VALID_TRANSITIONS.get(state);
    return !transitions || transitions.length === 0;
  }

  /**
   * Gets a human-readable description of the state
   */
  static getStateDescription(state: ConversationState): string {
    const descriptions: Record<ConversationState, string> = {
      [ConversationState.IDLE]: 'Waiting for user to start speaking',
      [ConversationState.LISTENING]: 'Listening to user speech',
      [ConversationState.PROCESSING]: 'Processing user query and generating response',
      [ConversationState.SPEAKING]: 'Playing clone response',
      [ConversationState.INTERRUPTED]: 'User interrupted the response',
      [ConversationState.ERROR]: 'Error occurred during conversation',
    };
    return descriptions[state] || 'Unknown state';
  }
}
