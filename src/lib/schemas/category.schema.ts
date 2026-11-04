import { z } from 'zod';

import { CATEGORY_KINDS } from '@/lib/types';

export const categoryFormSchema = z.object({
  name: z.string().trim().min(1, 'Give it a name').max(40, 'Keep the name under 40 characters'),
  kind: z.enum(CATEGORY_KINDS),
  color: z.string().nullable(),
  archived: z.boolean(),
});

export type CategoryFormInput = z.input<typeof categoryFormSchema>;
export type CategoryFormValues = z.output<typeof categoryFormSchema>;

export const categoryFormDefaults = (): CategoryFormInput => ({
  name: '',
  kind: 'expense',
  color: null,
  archived: false,
});
