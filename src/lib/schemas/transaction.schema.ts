import { z } from 'zod';

import { TRANSACTION_TYPES } from '@/lib/types';
import { isDateKey, parseTaka, todayKey } from '@/lib/utils';

export const transactionFormSchema = z
  .object({
    type: z.enum(TRANSACTION_TYPES),
    date: z.string().refine(isDateKey, 'Pick a valid date'),
    fromId: z.string().min(1, 'Choose where the money comes from'),
    toId: z.string().min(1, 'Choose where the money goes'),
    amount: z
      .string()
      .trim()
      .min(1, 'Enter an amount')
      .transform((value, ctx) => {
        const poisha = parseTaka(value);
        if (poisha === null || poisha <= 0) {
          ctx.addIssue({ code: 'custom', message: 'Enter an amount like 350 or 1250.50' });
          return z.NEVER;
        }
        return poisha;
      }),
    note: z.string().trim().max(200, 'Keep the note under 200 characters'),
    parentId: z.string().nullable(),
  })
  .refine((v) => v.type !== 'transfer' || v.fromId !== v.toId, {
    message: 'Pick two different accounts',
    path: ['toId'],
  });

export type TransactionFormInput = z.input<typeof transactionFormSchema>;
export type TransactionFormValues = z.output<typeof transactionFormSchema>;

export const transactionFormDefaults = (): TransactionFormInput => ({
  type: 'expense',
  date: todayKey(),
  fromId: '',
  toId: '',
  amount: '',
  note: '',
  parentId: null,
});
