import { Platform } from 'react-native';

/** Height of the native tab bar that screen content scrolls under. */
export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 720;
