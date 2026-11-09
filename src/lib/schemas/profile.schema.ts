import { z } from 'zod';

import { normalizeBdPhone } from '@/lib/utils';

export const NICKNAME_MIN = 2;
export const NICKNAME_MAX = 15;

/** One word, starting with a letter (any script); letters, digits, ' and - allowed after that. */
const ONE_WORD = /^[\p{L}\p{M}][\p{L}\p{M}\p{N}'-]*$/u;

export const nicknameSchema = z
  .string()
  .trim()
  .min(1, 'Enter a nickname')
  .refine((value) => !/\s/.test(value), 'Use one word, without spaces')
  .refine((value) => value.length >= NICKNAME_MIN, `Use at least ${NICKNAME_MIN} letters`)
  .refine((value) => value.length <= NICKNAME_MAX, `Keep it to ${NICKNAME_MAX} letters or fewer`)
  .refine((value) => ONE_WORD.test(value), 'Start with a letter and use only letters or numbers');

export const emailSchema = z.string().trim().toLowerCase().min(1, 'Enter your email').pipe(z.email('Enter a valid email, like name@example.com'));

/** Empty stays empty (''), anything else must be a valid email. */
export const optionalEmailSchema = z.union([z.literal(''), emailSchema]);

/** Empty becomes `null`; otherwise a Bangladeshi mobile number, stored as `+8801XXXXXXXXX`. */
export const optionalPhoneSchema = z
  .string()
  .trim()
  .transform((value, ctx) => {
    if (!value) return null;
    const phone = normalizeBdPhone(value);
    if (!phone) {
      ctx.addIssue({ code: 'custom', message: 'Enter an 11-digit mobile number, like 01XXXXXXXXX' });
      return z.NEVER;
    }
    return phone;
  });

export const profileFormSchema = z.object({
  nickname: nicknameSchema,
  /** Picked image URI, or `null` for the initial. */
  photo: z.string().nullable(),
  email: optionalEmailSchema,
  phone: optionalPhoneSchema,
});

export type ProfileFormInput = z.input<typeof profileFormSchema>;
export type ProfileFormValues = z.output<typeof profileFormSchema>;

export const profileFormDefaults = (): ProfileFormInput => ({ nickname: '', photo: null, email: '', phone: '' });
