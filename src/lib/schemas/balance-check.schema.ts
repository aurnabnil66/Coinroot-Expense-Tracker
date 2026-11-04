import { z } from 'zod';

import { parseTaka } from '@/lib/utils';

/** "Count cash" / "Check balance": what's actually in the account right now. */
export const balanceCheckFormSchema = z.object({
  actual: z
    .string()
    .trim()
    .min(1, 'Enter what you have now')
    .transform((value, ctx) => {
      const poisha = parseTaka(value);
      if (poisha === null) {
        ctx.addIssue({ code: 'custom', message: 'Enter an amount like 5000 or 1250.50' });
        return z.NEVER;
      }
      return poisha;
    }),
});

export type BalanceCheckFormInput = z.input<typeof balanceCheckFormSchema>;
export type BalanceCheckFormValues = z.output<typeof balanceCheckFormSchema>;

export const balanceCheckFormDefaults = (): BalanceCheckFormInput => ({ actual: '' });
