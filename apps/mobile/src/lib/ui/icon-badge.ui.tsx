import type { ComponentProps } from 'react';

import { Box } from '@/lib/gluestack-ui/box';
import { Icon } from '@/lib/gluestack-ui/icon';

export type IconBadgeTone = 'primary' | 'sky' | 'income' | 'expense' | 'transfer' | 'warning' | 'danger' | 'muted';

// Whole class names, so Tailwind sees them.
const TONES: Record<IconBadgeTone, { box: string; icon: string }> = {
  primary: { box: 'bg-primary/15 dark:bg-primary/25', icon: 'text-primary' },
  sky: { box: 'bg-sky/15 dark:bg-sky/25', icon: 'text-sky' },
  income: { box: 'bg-income/15 dark:bg-income/25', icon: 'text-income' },
  expense: { box: 'bg-expense/15 dark:bg-expense/25', icon: 'text-expense' },
  transfer: { box: 'bg-transfer/15 dark:bg-transfer/25', icon: 'text-transfer' },
  warning: { box: 'bg-warning/15 dark:bg-warning/25', icon: 'text-warning' },
  danger: { box: 'bg-destructive/15 dark:bg-destructive/25', icon: 'text-destructive' },
  muted: { box: 'bg-muted', icon: 'text-muted-foreground' },
};

type IconBadgeProps = {
  icon: ComponentProps<typeof Icon>['as'];
  tone?: IconBadgeTone;
};

/** A small tinted rounded square with an icon: the leading badge of a settings row. */
export function IconBadge({ icon, tone = 'primary' }: IconBadgeProps) {
  const { box, icon: iconClass } = TONES[tone];
  return (
    <Box className={`h-9 w-9 items-center justify-center rounded-xl ${box}`}>
      <Icon as={icon} size="md" className={iconClass} />
    </Box>
  );
}
