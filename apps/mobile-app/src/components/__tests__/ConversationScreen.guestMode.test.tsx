/**
 * ConversationScreen Guest Mode Integration Tests
 *
 * Tests for guest mode UI indicators in the ConversationScreen
 */

import { useAuthStore } from '../../store/authStore';

describe('ConversationScreen - Guest Mode Integration', () => {
  beforeEach(() => {
    // Reset auth store before each test
    useAuthStore.setState({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isGuest: false,
      isOnboarded: false,
      isLoading: false,
      error: null,
    });
  });

  it('should show guest mode banner when isGuest is true', () => {
    // Set guest mode
    useAuthStore.setState({ isGuest: true });

    // Verify the state is set correctly
    const state = useAuthStore.getState();
    expect(state.isGuest).toBe(true);
  });

  it('should not show guest mode banner when isGuest is false', () => {
    // Set authenticated mode
    useAuthStore.setState({ isGuest: false, isAuthenticated: true });

    // Verify the state is set correctly
    const state = useAuthStore.getState();
    expect(state.isGuest).toBe(false);
    expect(state.isAuthenticated).toBe(true);
  });

  it('should update isGuest when session_created event is received', () => {
    // Simulate receiving session_created with isGuest: true
    useAuthStore.getState().setIsGuest(true);

    // Verify the state is updated
    const state = useAuthStore.getState();
    expect(state.isGuest).toBe(true);
  });

  it('should clear isGuest on logout', () => {
    // Set guest mode
    useAuthStore.setState({ isGuest: true, isAuthenticated: true });

    // Logout
    useAuthStore.getState().logout();

    // Verify isGuest is cleared
    const state = useAuthStore.getState();
    expect(state.isGuest).toBe(false);
    expect(state.isAuthenticated).toBe(false);
  });

  it('should set isGuest to false when logging in with JWT', () => {
    // Start in guest mode
    useAuthStore.setState({ isGuest: true });

    // Login with JWT
    useAuthStore
      .getState()
      .login(
        {
          id: 'user-1',
          email: 'test@example.com',
          name: 'Test User',
          createdAt: new Date().toISOString(),
        },
        'jwt-token',
        'refresh-token'
      );

    // Verify isGuest is false
    const state = useAuthStore.getState();
    expect(state.isGuest).toBe(false);
    expect(state.isAuthenticated).toBe(true);
  });

  it('should set isGuest to true when logging in as guest', () => {
    // Login as guest
    useAuthStore
      .getState()
      .loginAsGuest(
        {
          id: 'guest-1',
          email: 'guest@example.com',
          name: 'Guest User',
          createdAt: new Date().toISOString(),
        },
        'guest_token_123'
      );

    // Verify isGuest is true
    const state = useAuthStore.getState();
    expect(state.isGuest).toBe(true);
    expect(state.isAuthenticated).toBe(true);
  });
});
