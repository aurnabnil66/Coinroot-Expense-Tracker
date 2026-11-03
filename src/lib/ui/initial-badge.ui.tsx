import { Box } from '@/lib/gluestack-ui/box';
import { Text } from '@/lib/gluestack-ui/text';

type InitialBadgeProps = {
  label: string;
  /** Hex colour; the background is a light tint of it. */
  color: string;
  size?: 'sm' | 'md';
};

/** Round badge with the first letter of a name, tinted with the item's colour. */
export function InitialBadge({ label, color, size = 'md' }: InitialBadgeProps) {
  const box = size === 'sm' ? 'h-7 w-7' : 'h-10 w-10';
  return (
    <Box className={`${box} items-center justify-center rounded-full`} style={{ backgroundColor: `${color}26` }}>
      <Text className={`${size === 'sm' ? 'text-xs' : 'text-base'} font-semibold`} style={{ color }}>
        {label.trim().charAt(0).toUpperCase() || '?'}
      </Text>
    </Box>
  );
}
