/**
 * Color Palette
 *
 * Defines the color scheme for light and dark themes
 */

export const lightColors = {
  // Primary
  primary: '#007AFF',
  primaryLight: '#4DA3FF',
  primaryDark: '#0055B3',

  // Secondary
  secondary: '#5856D6',
  secondaryLight: '#8583E6',
  secondaryDark: '#3D3BB3',

  // Accent
  accent: '#FF9500',
  accentLight: '#FFB84D',
  accentDark: '#CC7700',

  // Background
  background: '#F5F5F5',
  backgroundSecondary: '#FFFFFF',
  backgroundTertiary: '#E5E5EA',

  // Surface
  surface: '#FFFFFF',
  surfaceSecondary: '#F2F2F7',

  // Text
  text: '#000000',
  textSecondary: '#3C3C43',
  textTertiary: '#8E8E93',
  textInverse: '#FFFFFF',

  // Border
  border: '#E5E5EA',
  borderSecondary: '#C6C6C8',

  // Status
  success: '#34C759',
  warning: '#FF9500',
  error: '#FF3B30',
  info: '#007AFF',

  // Conversation states
  idle: '#8E8E93',
  listening: '#34C759',
  processing: '#FF9500',
  speaking: '#007AFF',
  interrupted: '#FF3B30',

  // Overlay
  overlay: 'rgba(0, 0, 0, 0.4)',
  overlayLight: 'rgba(0, 0, 0, 0.2)',
};

export const darkColors = {
  // Primary
  primary: '#0A84FF',
  primaryLight: '#4DA3FF',
  primaryDark: '#0055B3',

  // Secondary
  secondary: '#5E5CE6',
  secondaryLight: '#8583E6',
  secondaryDark: '#3D3BB3',

  // Accent
  accent: '#FF9F0A',
  accentLight: '#FFB84D',
  accentDark: '#CC7700',

  // Background
  background: '#000000',
  backgroundSecondary: '#1C1C1E',
  backgroundTertiary: '#2C2C2E',

  // Surface
  surface: '#1C1C1E',
  surfaceSecondary: '#2C2C2E',

  // Text
  text: '#FFFFFF',
  textSecondary: '#EBEBF5',
  textTertiary: '#8E8E93',
  textInverse: '#000000',

  // Border
  border: '#38383A',
  borderSecondary: '#48484A',

  // Status
  success: '#30D158',
  warning: '#FF9F0A',
  error: '#FF453A',
  info: '#0A84FF',

  // Conversation states
  idle: '#8E8E93',
  listening: '#30D158',
  processing: '#FF9F0A',
  speaking: '#0A84FF',
  interrupted: '#FF453A',

  // Overlay
  overlay: 'rgba(0, 0, 0, 0.6)',
  overlayLight: 'rgba(0, 0, 0, 0.4)',
};

export type ColorScheme = typeof lightColors;
