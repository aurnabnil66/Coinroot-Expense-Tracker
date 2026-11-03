import { z } from 'zod';

import { ACCOUNT_TYPES } from '@/lib/types';
import { isDateKey, parseTaka, todayKey } from '@/lib/utils';

export const accountFormSchema = z.object({
  name: z.string().trim().min(1, 'Give the account a name').max(40, 'Keep the name under 40 characters'),
  type: z.enum(ACCOUNT_TYPES),
  openingBalance: z
    .string()
    .trim()
    .transform((value, ctx) => {
      const poisha = value === '' ? 0 : parseTaka(value);
      if (poisha === null) {
        ctx.addIssue({ code: 'custom', message: 'Enter an amount like 5000 or 1250.50' });
        return z.NEVER;
      }
      return poisha;
    }),
  openingDate: z.string().refine(isDateKey, 'Pick a valid date'),
  archived: z.boolean(),
});

export type AccountFormInput = z.input<typeof accountFormSchema>;
export type AccountFormValues = z.output<typeof accountFormSchema>;

export const accountFormDefaults = (): AccountFormInput => ({
  name: '',
  type: 'bank',
  openingBalance: '',
  openingDate: todayKey(),
  archived: false,
});
