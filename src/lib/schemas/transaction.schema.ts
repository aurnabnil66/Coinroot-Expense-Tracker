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
    /** Income only: who paid. Empty becomes null. */
    party: z
      .string()
      .trim()
      .max(60, 'Keep the name under 60 characters')
      .transform((value) => value || null),
    /** New transfers only: a charge paid on top (e.g. a cash-out fee), saved as its own expense. */
    fee: z
      .string()
      .trim()
      .transform((value, ctx) => {
        if (!value) return null;
        const poisha = parseTaka(value);
        if (poisha === null || poisha <= 0) {
          ctx.addIssue({ code: 'custom', message: 'Enter a charge like 18.50, or leave it empty' });
          return z.NEVER;
        }
        return poisha;
      }),
    feeCategoryId: z.string().nullable(),
  })
  .refine((v) => v.type !== 'transfer' || v.fromId !== v.toId, {
    message: 'Pick two different accounts',
    path: ['toId'],
  })
  .refine((v) => v.type !== 'transfer' || v.fee === null || v.feeCategoryId !== null, {
    message: 'Choose a category for the charge',
    path: ['feeCategoryId'],
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
  party: '',
  fee: '',
  feeCategoryId: null,
});
