import type { PressableAndroidRippleConfig } from 'react-native';

import { useGluestackColors } from '@/lib/gluestack-ui/gluestack-ui-provider';

/** Material ripple for `android_ripple`, tinted with the theme's primary colour. */
export function useRipple(options: { borderless?: boolean } = {}): PressableAndroidRippleConfig {
  const colors = useGluestackColors();
  return { color: `${colors.primary}29`, borderless: options.borderless ?? false };
}
