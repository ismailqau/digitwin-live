/**
 * Theme Configuration Tests
 *
 * Tests to ensure theme configuration is properly structured
 * and compatible with React Navigation
 */

import { lightTheme, darkTheme, fontFamily } from '../theme';

describe('Theme Configuration', () => {
  describe('Font Family', () => {
    it('should have all required font families as strings', () => {
      expect(typeof fontFamily.regular).toBe('string');
      expect(typeof fontFamily.medium).toBe('string');
      expect(typeof fontFamily.bold).toBe('string');
    });

    it('should not have undefined font families', () => {
      expect(fontFamily.regular).toBeDefined();
      expect(fontFamily.medium).toBeDefined();
      expect(fontFamily.bold).toBeDefined();
    });

    it('should have non-empty font family strings', () => {
      expect(fontFamily.regular.length).toBeGreaterThan(0);
      expect(fontFamily.medium.length).toBeGreaterThan(0);
      expect(fontFamily.bold.length).toBeGreaterThan(0);
    });
  });

  describe('Light Theme', () => {
    it('should have all required properties', () => {
      expect(lightTheme).toHaveProperty('colors');
      expect(lightTheme).toHaveProperty('spacing');
      expect(lightTheme).toHaveProperty('fontFamily');
      expect(lightTheme).toHaveProperty('fontSize');
      expect(lightTheme).toHaveProperty('fontWeight');
    });

    it('should have valid color values', () => {
      expect(typeof lightTheme.colors.primary).toBe('string');
      expect(typeof lightTheme.colors.background).toBe('string');
      expect(typeof lightTheme.colors.text).toBe('string');
      expect(typeof lightTheme.colors.surface).toBe('string');
      expect(typeof lightTheme.colors.border).toBe('string');
      expect(typeof lightTheme.colors.accent).toBe('string');
    });

    it('should have string font families', () => {
      expect(typeof lightTheme.fontFamily.regular).toBe('string');
      expect(typeof lightTheme.fontFamily.medium).toBe('string');
      expect(typeof lightTheme.fontFamily.bold).toBe('string');
    });
  });

  describe('Dark Theme', () => {
    it('should have all required properties', () => {
      expect(darkTheme).toHaveProperty('colors');
      expect(darkTheme).toHaveProperty('spacing');
      expect(darkTheme).toHaveProperty('fontFamily');
      expect(darkTheme).toHaveProperty('fontSize');
      expect(darkTheme).toHaveProperty('fontWeight');
    });

    it('should have valid color values', () => {
      expect(typeof darkTheme.colors.primary).toBe('string');
      expect(typeof darkTheme.colors.background).toBe('string');
      expect(typeof darkTheme.colors.text).toBe('string');
      expect(typeof darkTheme.colors.surface).toBe('string');
      expect(typeof darkTheme.colors.border).toBe('string');
      expect(typeof darkTheme.colors.accent).toBe('string');
    });

    it('should have string font families', () => {
      expect(typeof darkTheme.fontFamily.regular).toBe('string');
      expect(typeof darkTheme.fontFamily.medium).toBe('string');
      expect(typeof darkTheme.fontFamily.bold).toBe('string');
    });
  });

  describe('Navigation Theme Compatibility', () => {
    it('should create valid navigation theme from light theme', () => {
      const navigationTheme = {
        dark: false,
        colors: {
          primary: lightTheme.colors.primary,
          background: lightTheme.colors.background,
          card: lightTheme.colors.surface,
          text: lightTheme.colors.text,
          border: lightTheme.colors.border,
          notification: lightTheme.colors.accent,
        },
        fonts: {
          regular: {
            fontFamily: lightTheme.fontFamily.regular,
            fontWeight: '400' as const,
          },
          medium: {
            fontFamily: lightTheme.fontFamily.medium,
            fontWeight: '500' as const,
          },
          bold: {
            fontFamily: lightTheme.fontFamily.bold,
            fontWeight: '700' as const,
          },
          heavy: {
            fontFamily: lightTheme.fontFamily.bold,
            fontWeight: '700' as const,
          },
        },
      };

      expect(typeof navigationTheme.dark).toBe('boolean');
      expect(navigationTheme.dark).toBe(false);
      expect(typeof navigationTheme.fonts.regular.fontFamily).toBe('string');
      expect(typeof navigationTheme.fonts.medium.fontFamily).toBe('string');
      expect(typeof navigationTheme.fonts.bold.fontFamily).toBe('string');
      expect(typeof navigationTheme.fonts.heavy.fontFamily).toBe('string');
    });

    it('should create valid navigation theme from dark theme', () => {
      const navigationTheme = {
        dark: true,
        colors: {
          primary: darkTheme.colors.primary,
          background: darkTheme.colors.background,
          card: darkTheme.colors.surface,
          text: darkTheme.colors.text,
          border: darkTheme.colors.border,
          notification: darkTheme.colors.accent,
        },
        fonts: {
          regular: {
            fontFamily: darkTheme.fontFamily.regular,
            fontWeight: '400' as const,
          },
          medium: {
            fontFamily: darkTheme.fontFamily.medium,
            fontWeight: '500' as const,
          },
          bold: {
            fontFamily: darkTheme.fontFamily.bold,
            fontWeight: '700' as const,
          },
          heavy: {
            fontFamily: darkTheme.fontFamily.bold,
            fontWeight: '700' as const,
          },
        },
      };

      expect(typeof navigationTheme.dark).toBe('boolean');
      expect(navigationTheme.dark).toBe(true);
      expect(typeof navigationTheme.fonts.regular.fontFamily).toBe('string');
      expect(typeof navigationTheme.fonts.medium.fontFamily).toBe('string');
      expect(typeof navigationTheme.fonts.bold.fontFamily).toBe('string');
      expect(typeof navigationTheme.fonts.heavy.fontFamily).toBe('string');
    });
  });
});
