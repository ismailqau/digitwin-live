/**
 * Typography System
 *
 * Font sizes, weights, and text styles
 */

import { Platform, TextStyle } from 'react-native';

// Font families
export const fontFamily = {
  regular: (Platform.select({
    ios: 'System',
    android: 'Roboto',
    default: 'System',
  }) ?? 'System') as string,
  medium: (Platform.select({
    ios: 'System',
    android: 'Roboto-Medium',
    default: 'System',
  }) ?? 'System') as string,
  bold: (Platform.select({
    ios: 'System',
    android: 'Roboto-Bold',
    default: 'System',
  }) ?? 'System') as string,
};

// Font sizes
export const fontSize = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 20,
  xxl: 24,
  xxxl: 34,
};

// Line heights
export const lineHeight = {
  xs: 14,
  sm: 18,
  md: 20,
  lg: 22,
  xl: 26,
  xxl: 30,
  xxxl: 42,
};

// Font weights
export const fontWeight = {
  regular: '400' as TextStyle['fontWeight'],
  medium: '500' as TextStyle['fontWeight'],
  semibold: '600' as TextStyle['fontWeight'],
  bold: '700' as TextStyle['fontWeight'],
};

// Pre-defined text styles
export const textStyles = {
  // Headings
  h1: {
    fontSize: fontSize.xxxl,
    lineHeight: lineHeight.xxxl,
    fontWeight: fontWeight.bold,
  } as TextStyle,

  h2: {
    fontSize: fontSize.xxl,
    lineHeight: lineHeight.xxl,
    fontWeight: fontWeight.bold,
  } as TextStyle,

  h3: {
    fontSize: fontSize.xl,
    lineHeight: lineHeight.xl,
    fontWeight: fontWeight.semibold,
  } as TextStyle,

  // Body text
  body: {
    fontSize: fontSize.md,
    lineHeight: lineHeight.md,
    fontWeight: fontWeight.regular,
  } as TextStyle,

  bodyLarge: {
    fontSize: fontSize.lg,
    lineHeight: lineHeight.lg,
    fontWeight: fontWeight.regular,
  } as TextStyle,

  bodySmall: {
    fontSize: fontSize.sm,
    lineHeight: lineHeight.sm,
    fontWeight: fontWeight.regular,
  } as TextStyle,

  // Labels
  label: {
    fontSize: fontSize.sm,
    lineHeight: lineHeight.sm,
    fontWeight: fontWeight.medium,
  } as TextStyle,

  labelLarge: {
    fontSize: fontSize.md,
    lineHeight: lineHeight.md,
    fontWeight: fontWeight.medium,
  } as TextStyle,

  // Caption
  caption: {
    fontSize: fontSize.xs,
    lineHeight: lineHeight.xs,
    fontWeight: fontWeight.regular,
  } as TextStyle,

  // Button
  button: {
    fontSize: fontSize.md,
    lineHeight: lineHeight.md,
    fontWeight: fontWeight.semibold,
  } as TextStyle,

  buttonSmall: {
    fontSize: fontSize.sm,
    lineHeight: lineHeight.sm,
    fontWeight: fontWeight.semibold,
  } as TextStyle,
};
