import { z } from 'zod';

import { ACCOUNT_TYPES } from '@/lib/types';
import { parseTaka } from '@/lib/utils';

/** First-time setup: the accounts to create, each with what's in it today. */
export const setupFormSchema = z.object({
  accounts: z
    .array(
      z.object({
        type: z.enum(ACCOUNT_TYPES),
        name: z.string().trim().min(1, 'Enter a name').max(40, 'Keep the name under 40 characters'),
        openingBalance: z
          .string()
          .trim()
          .transform((value, ctx) => {
            if (!value) return 0;
            const poisha = parseTaka(value);
            if (poisha === null) {
              ctx.addIssue({ code: 'custom', message: 'Enter an amount like 5000 or 1250.50' });
              return z.NEVER;
            }
            return poisha;
          }),
      })
    )
    .min(1, 'Add at least one account'),
});

export type SetupFormInput = z.input<typeof setupFormSchema>;
export type SetupFormValues = z.output<typeof setupFormSchema>;
export type SetupAccountInput = SetupFormInput['accounts'][number];

export const setupFormDefaults = (): SetupFormInput => ({ accounts: [] });
