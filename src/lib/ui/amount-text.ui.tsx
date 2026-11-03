import type { ComponentProps } from 'react';

import { Text } from '@/lib/gluestack-ui/text';
import { formatTaka } from '@/lib/utils';

export type AmountTone = 'default' | 'income' | 'expense' | 'muted' | 'onHero';

const toneClass: Record<AmountTone, string> = {
  default: 'text-foreground',
  income: 'text-income',
  expense: 'text-expense',
  muted: 'text-muted-foreground',
  /** White, for amounts on a GradientCard. */
  onHero: 'text-white',
};

type AmountTextProps = Omit<ComponentProps<typeof Text>, 'children'> & {
  /** Poisha. */
  amount: number;
  tone?: AmountTone;
  /** "+" for positive amounts. Negative amounts always show "-". */
  signed?: boolean;
  /** Show as money going out ("-৳350") even though the amount is positive. */
  outflow?: boolean;
};

export function AmountText({ amount, tone = 'default', signed, outflow, className = '', ...props }: AmountTextProps) {
  const value = outflow ? -Math.abs(amount) : amount;
  return (
    <Text className={`font-bold tabular-nums ${toneClass[tone]} ${className}`} {...props}>
      {formatTaka(value, { signed })}
    </Text>
  );
}
