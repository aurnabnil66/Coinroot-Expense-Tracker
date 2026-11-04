import { useColorScheme } from 'nativewind';

import { Box } from '@/lib/gluestack-ui/box';
import { Text } from '@/lib/gluestack-ui/text';

type InitialBadgeProps = {
  label: string;
  /** Hex colour (from `useCategoryColors()`); the background is a tint of it. */
  color: string;
  size?: 'sm' | 'md';
};

/** Round badge with the first letter of a name, tinted with the item's colour. */
export function InitialBadge({ label, color, size = 'md' }: InitialBadgeProps) {
  const { colorScheme } = useColorScheme();
  const box = size === 'sm' ? 'h-8 w-8 rounded-xl' : 'h-11 w-11 rounded-2xl';
  // A stronger tint in dark mode, where a light one disappears into the navy.
  const tint = colorScheme === 'dark' ? '40' : '33';
  return (
    <Box className={`${box} items-center justify-center`} style={{ backgroundColor: `${color}${tint}` }}>
      <Text className={`${size === 'sm' ? 'text-xs' : 'text-base'} font-semibold`} style={{ color }}>
        {label.trim().charAt(0).toUpperCase() || '?'}
      </Text>
    </Box>
  );
}
