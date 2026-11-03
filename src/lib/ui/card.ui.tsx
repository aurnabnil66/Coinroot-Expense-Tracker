import type { ComponentProps } from 'react';

import { Box } from '@/lib/gluestack-ui/box';

type CardProps = ComponentProps<typeof Box>;

/** Rounded surface for grouping content. */
export function Card({ className = '', ...props }: CardProps) {
  return <Box className={`overflow-hidden rounded-2xl border border-border bg-card ${className}`} {...props} />;
}
