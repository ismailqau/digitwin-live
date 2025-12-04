/**
 * Theme Module
 *
 * Exports theme configuration including colors, spacing, and typography
 */

import { lightColors, darkColors, ColorScheme } from './colors';
import { spacing, borderRadius, iconSize } from './spacing';
import { fontFamily, fontSize, lineHeight, fontWeight, textStyles } from './typography';

export interface Theme {
  colors: ColorScheme;
  spacing: typeof spacing;
  borderRadius: typeof borderRadius;
  iconSize: typeof iconSize;
  fontFamily: typeof fontFamily;
  fontSize: typeof fontSize;
  lineHeight: typeof lineHeight;
  fontWeight: typeof fontWeight;
  textStyles: typeof textStyles;
}

export const lightTheme: Theme = {
  colors: lightColors,
  spacing,
  borderRadius,
  iconSize,
  fontFamily,
  fontSize,
  lineHeight,
  fontWeight,
  textStyles,
};

export const darkTheme: Theme = {
  colors: darkColors,
  spacing,
  borderRadius,
  iconSize,
  fontFamily,
  fontSize,
  lineHeight,
  fontWeight,
  textStyles,
};

// Re-export individual modules
export { lightColors, darkColors } from './colors';
export type { ColorScheme } from './colors';
export { spacing, borderRadius, iconSize } from './spacing';
export { fontFamily, fontSize, lineHeight, fontWeight, textStyles } from './typography';
