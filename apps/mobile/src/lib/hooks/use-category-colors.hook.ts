import { useColorScheme } from 'nativewind';

import { CATEGORY_COLORS, CATEGORY_COLORS_DARK } from '@/lib/constants';

/** Category / account swatches for the current theme: deep tones in light mode, bright in dark. */
export function useCategoryColors(): Record<string, string> {
  const { colorScheme } = useColorScheme();
  return colorScheme === 'dark' ? CATEGORY_COLORS_DARK : CATEGORY_COLORS;
}
