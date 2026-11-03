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
  /** Semibold for large headline amounts, where Poppins Bold looks too heavy. */
  weight?: 'semibold' | 'bold';
};

export function AmountText({
  amount,
  tone = 'default',
  signed,
  outflow,
  weight = 'bold',
  className = '',
  ...props
}: AmountTextProps) {
  const value = outflow ? -Math.abs(amount) : amount;
  return (
    <Text
      className={`${weight === 'semibold' ? 'font-semibold' : 'font-bold'} tabular-nums ${toneClass[tone]} ${className}`}
      {...props}>
      {formatTaka(value, { signed })}
    </Text>
  );
}
