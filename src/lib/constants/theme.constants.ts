import { Platform } from 'react-native';

/** Height of the native tab bar that screen content scrolls under. */

/**
 * App font, embedded by the expo-font plugin (app.json) with 400/500/600/700 faces.
 * Tailwind's font-sans / font-body / font-heading map to it; use this only for props
 * that can't take className (navigation header, native tab labels).
 */
export const FontFamily = 'Poppins';
export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 720;
