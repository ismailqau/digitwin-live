import { ConversationState } from '@clone/shared-types';

import { ConversationStateMachine } from '../domain/models/ConversationStateMachine';

describe('ConversationStateMachine', () => {
  describe('canTransition', () => {
    it('should allow idle → listening transition', () => {
      expect(
        ConversationStateMachine.canTransition(ConversationState.IDLE, ConversationState.LISTENING)
      ).toBe(true);
    });

    it('should allow listening → processing transition', () => {
      expect(
        ConversationStateMachine.canTransition(
          ConversationState.LISTENING,
          ConversationState.PROCESSING
        )
      ).toBe(true);
    });

    it('should allow processing → speaking transition', () => {
      expect(
        ConversationStateMachine.canTransition(
          ConversationState.PROCESSING,
          ConversationState.SPEAKING
        )
      ).toBe(true);
    });

    it('should allow speaking → idle transition', () => {
      expect(
        ConversationStateMachine.canTransition(ConversationState.SPEAKING, ConversationState.IDLE)
      ).toBe(true);
    });

    it('should allow any state → interrupted transition', () => {
      expect(
        ConversationStateMachine.canTransition(
          ConversationState.LISTENING,
          ConversationState.INTERRUPTED
        )
      ).toBe(true);
      expect(
        ConversationStateMachine.canTransition(
          ConversationState.PROCESSING,
          ConversationState.INTERRUPTED
        )
      ).toBe(true);
      expect(
        ConversationStateMachine.canTransition(
          ConversationState.SPEAKING,
          ConversationState.INTERRUPTED
        )
      ).toBe(true);
    });

    it('should allow interrupted → listening transition', () => {
      expect(
        ConversationStateMachine.canTransition(
          ConversationState.INTERRUPTED,
          ConversationState.LISTENING
        )
      ).toBe(true);
    });

    it('should allow any state → error transition', () => {
      expect(
        ConversationStateMachine.canTransition(ConversationState.IDLE, ConversationState.ERROR)
      ).toBe(true);
      expect(
        ConversationStateMachine.canTransition(ConversationState.LISTENING, ConversationState.ERROR)
      ).toBe(true);
      expect(
        ConversationStateMachine.canTransition(
          ConversationState.PROCESSING,
          ConversationState.ERROR
        )
      ).toBe(true);
      expect(
        ConversationStateMachine.canTransition(ConversationState.SPEAKING, ConversationState.ERROR)
      ).toBe(true);
    });

    it('should not allow idle → processing transition', () => {
      expect(
        ConversationStateMachine.canTransition(ConversationState.IDLE, ConversationState.PROCESSING)
      ).toBe(false);
    });

    it('should not allow idle → speaking transition', () => {
      expect(
        ConversationStateMachine.canTransition(ConversationState.IDLE, ConversationState.SPEAKING)
      ).toBe(false);
    });

    it('should not allow listening → speaking transition', () => {
      expect(
        ConversationStateMachine.canTransition(
          ConversationState.LISTENING,
          ConversationState.SPEAKING
        )
      ).toBe(false);
    });
  });

  describe('transition', () => {
    it('should return new state for valid transition', () => {
      const newState = ConversationStateMachine.transition(
        ConversationState.IDLE,
        ConversationState.LISTENING
      );
      expect(newState).toBe(ConversationState.LISTENING);
    });

    it('should throw error for invalid transition', () => {
      expect(() => {
        ConversationStateMachine.transition(ConversationState.IDLE, ConversationState.PROCESSING);
      }).toThrow('Invalid state transition');
    });
  });

  describe('getValidNextStates', () => {
    it('should return valid next states for idle', () => {
      const validStates = ConversationStateMachine.getValidNextStates(ConversationState.IDLE);
      expect(validStates).toContain(ConversationState.LISTENING);
      expect(validStates).toContain(ConversationState.ERROR);
      expect(validStates).toHaveLength(2);
    });

    it('should return valid next states for listening', () => {
      const validStates = ConversationStateMachine.getValidNextStates(ConversationState.LISTENING);
      expect(validStates).toContain(ConversationState.PROCESSING);
      expect(validStates).toContain(ConversationState.IDLE);
      expect(validStates).toContain(ConversationState.INTERRUPTED);
      expect(validStates).toContain(ConversationState.ERROR);
      expect(validStates).toHaveLength(4);
    });

    it('should return valid next states for processing', () => {
      const validStates = ConversationStateMachine.getValidNextStates(ConversationState.PROCESSING);
      expect(validStates).toContain(ConversationState.SPEAKING);
      expect(validStates).toContain(ConversationState.IDLE);
      expect(validStates).toContain(ConversationState.INTERRUPTED);
      expect(validStates).toContain(ConversationState.ERROR);
      expect(validStates).toHaveLength(4);
    });

    it('should return valid next states for speaking', () => {
      const validStates = ConversationStateMachine.getValidNextStates(ConversationState.SPEAKING);
      expect(validStates).toContain(ConversationState.IDLE);
      expect(validStates).toContain(ConversationState.INTERRUPTED);
      expect(validStates).toContain(ConversationState.ERROR);
      expect(validStates).toHaveLength(3);
    });

    it('should return valid next states for interrupted', () => {
      const validStates = ConversationStateMachine.getValidNextStates(
        ConversationState.INTERRUPTED
      );
      expect(validStates).toContain(ConversationState.LISTENING);
      expect(validStates).toContain(ConversationState.IDLE);
      expect(validStates).toContain(ConversationState.ERROR);
      expect(validStates).toHaveLength(3);
    });
  });

  describe('getStateDescription', () => {
    it('should return description for idle state', () => {
      const description = ConversationStateMachine.getStateDescription(ConversationState.IDLE);
      expect(description).toBe('Waiting for user to start speaking');
    });

    it('should return description for listening state', () => {
      const description = ConversationStateMachine.getStateDescription(ConversationState.LISTENING);
      expect(description).toBe('Listening to user speech');
    });

    it('should return description for processing state', () => {
      const description = ConversationStateMachine.getStateDescription(
        ConversationState.PROCESSING
      );
      expect(description).toBe('Processing user query and generating response');
    });

    it('should return description for speaking state', () => {
      const description = ConversationStateMachine.getStateDescription(ConversationState.SPEAKING);
      expect(description).toBe('Playing clone response');
    });

    it('should return description for interrupted state', () => {
      const description = ConversationStateMachine.getStateDescription(
        ConversationState.INTERRUPTED
      );
      expect(description).toBe('User interrupted the response');
    });

    it('should return description for error state', () => {
      const description = ConversationStateMachine.getStateDescription(ConversationState.ERROR);
      expect(description).toBe('Error occurred during conversation');
    });
  });
});
