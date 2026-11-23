import type { Profile } from '@/lib/storage';

/**
 * The profile details kept on the account (Supabase `user_metadata`), so logging in on any
 * phone brings the nickname and phone back. The photo itself lives in Supabase Storage
 * (`profile-photo.supabase.ts`); `user_metadata.photo_version` says the account has one
 * (and when it was uploaded). Pure and tested.
 */
export type AccountProfile = {
  nickname: string;
  phone: string | null;
};

/** A blank profile: what's left on the phone after logging out. */
export const EMPTY_PROFILE: Profile = { nickname: '', photo: null, email: '', phone: null };

/** Reads the account's profile from `user_metadata`, ignoring anything malformed. */
export function readAccountProfile(metadata: unknown): AccountProfile {
  const value = metadata && typeof metadata === 'object' ? (metadata as Record<string, unknown>) : {};
  const nickname = typeof value.nickname === 'string' ? value.nickname.trim() : '';
  const phone = typeof value.phone === 'string' && value.phone.trim() ? value.phone.trim() : null;
  return { nickname, phone };
}

/** When the account's photo was uploaded (`user_metadata.photo_version`), or `null` if it has none. */
export function readAccountPhoto(metadata: unknown): string | null {
  const value = metadata && typeof metadata === 'object' ? (metadata as Record<string, unknown>).photo_version : null;
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

/**
 * What to do with the photo at log-in. When this phone has a photo change the account never
 * received (`pending`: an upload or removal that failed, e.g. offline), the phone wins: `upload`
 * the photo it kept, or `remove` the account's. Otherwise `download` the account's photo when it
 * has one, `upload` the one this phone kept for the same account when it has none (e.g. picked
 * at sign-up before the email was confirmed), or `none`.
 */
export function photoOnLogIn(
  accountPhoto: string | null,
  keptPhoto: string | null,
  pending: boolean
): 'download' | 'upload' | 'remove' | 'none' {
  if (pending) return keptPhoto ? 'upload' : accountPhoto ? 'remove' : 'none';
  if (accountPhoto) return 'download';
  return keptPhoto ? 'upload' : 'none';
}

/**
 * The profile after logging in: the account's nickname, sign-in email and phone, each blank
 * when the account doesn't have it. Nothing from the profile on the phone carries over,
 * except the photo when that profile already belonged to this account (same email); the
 * account's own photo, if any, then replaces it (`photoOnLogIn`).
 */
export function profileFromAccount(local: Profile, account: AccountProfile, email: string): Profile {
  const sameAccount = local.email.trim().toLowerCase() === email.trim().toLowerCase();
  return { nickname: account.nickname, photo: sameAccount ? local.photo : null, email, phone: account.phone };
}
