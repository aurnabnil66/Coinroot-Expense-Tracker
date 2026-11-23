import { useColorScheme } from 'nativewind';
import type { ComponentProps } from 'react';

import { Box } from '@/lib/gluestack-ui/box';

type CardProps = ComponentProps<typeof Box>;

// Soft navy-tinted shadow in light mode; dark mode relies on the card colour and border.
const LIGHT_SHADOW = '0 1px 2px rgba(17, 24, 59, 0.04), 0 8px 24px rgba(17, 24, 59, 0.06)';

/** Rounded surface for grouping content. */
export function Card({ className = '', style, ...props }: CardProps) {
  const { colorScheme } = useColorScheme();
  return (
    <Box
      className={`overflow-hidden rounded-xl border border-border/70 bg-card ${className}`}
      style={[colorScheme === 'dark' ? null : { boxShadow: LIGHT_SHADOW }, style]}
      {...props}
    />
  );
}
