/**
 * GuestModeBanner Component Tests
 *
 * Tests for the guest mode banner component that displays
 * when user is in guest mode.
 */

import { GuestModeBanner } from '../GuestModeBanner';

describe('GuestModeBanner', () => {
  it('should export GuestModeBanner component', () => {
    expect(GuestModeBanner).toBeDefined();
    expect(typeof GuestModeBanner).toBe('function');
  });

  it('should be a React component', () => {
    // Verify it's a function component
    expect(GuestModeBanner.length).toBe(1); // Takes 1 argument (props)
  });

  it('should accept onSignInPress prop', () => {
    const mockOnSignInPress = jest.fn();
    const props = { onSignInPress: mockOnSignInPress };

    // Verify the component accepts the required prop
    expect(() => GuestModeBanner(props)).not.toThrow();
  });

  it('should render without crashing when given valid props', () => {
    const mockOnSignInPress = jest.fn();
    const result = GuestModeBanner({ onSignInPress: mockOnSignInPress });

    // Verify it returns a valid React element
    expect(result).toBeTruthy();
    expect(result.type).toBeDefined();
  });

  it('should have the correct component structure', () => {
    const mockOnSignInPress = jest.fn();
    const result = GuestModeBanner({ onSignInPress: mockOnSignInPress });

    // Verify the component returns a View as the root element
    expect(result.type).toBe('View');
  });
});
