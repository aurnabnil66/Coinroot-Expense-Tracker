import { z } from 'zod';

import { emailSchema, nicknameSchema, optionalPhoneSchema } from './profile.schema';

export const PASSWORD_MIN = 8;

export const newPasswordSchema = z
  .string()
  .min(PASSWORD_MIN, `Use at least ${PASSWORD_MIN} characters`)
  .max(72, 'Keep it under 72 characters')
  .refine((value) => /\p{L}/u.test(value) && /\d/.test(value), 'Use at least one letter and one number');

export const signUpFormSchema = z.object({
  nickname: nicknameSchema,
  photo: z.string().nullable(),
  email: emailSchema,
  password: newPasswordSchema,
  phone: optionalPhoneSchema,
});

export type SignUpFormInput = z.input<typeof signUpFormSchema>;
export type SignUpFormValues = z.output<typeof signUpFormSchema>;

export const signUpFormDefaults = (): SignUpFormInput => ({ nickname: '', photo: null, email: '', password: '', phone: '' });

export const logInFormSchema = z.object({
  email: emailSchema,
  // Only "not empty" here: the server decides whether the password is right.
  password: z.string().min(1, 'Enter your password'),
});

export type LogInFormInput = z.input<typeof logInFormSchema>;
export type LogInFormValues = z.output<typeof logInFormSchema>;

export const logInFormDefaults = (): LogInFormInput => ({ email: '', password: '' });
