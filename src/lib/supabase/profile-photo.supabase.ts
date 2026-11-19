import { File, Paths } from 'expo-file-system';

import { savedPhotoProblem } from '@/lib/utils';

import type { CoinrootSupabase } from './client.supabase';

/**
 * The profile photo in Supabase Storage: one small JPEG per account at `<user id>/avatar.jpg`
 * in the private `avatars` bucket (see its migration: JPEG only, at most 1 MB, each user only
 * their own file). The photo is already shrunk on the phone (`shrinkPhoto`) before it gets here.
 */
const BUCKET = 'avatars';
const pathOf = (userId: string) => `${userId}/avatar.jpg`;
/** A download link only needs to live long enough to fetch one small file. */
const LINK_SECONDS = 60;

/** Uploads (or replaces) the account's photo. Returns its new version (the upload time). Throws on failure. */
export async function uploadAccountPhoto(supabase: CoinrootSupabase, userId: string, uri: string): Promise<string> {
  const file = new File(uri);
  const problem = savedPhotoProblem(file.exists ? file.size : 0);
  if (problem) throw new Error(problem);
  const bytes = await file.bytes();
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(pathOf(userId), bytes.buffer as ArrayBuffer, { contentType: 'image/jpeg', upsert: true });
  if (error) throw error;
  return new Date().toISOString();
}

/** Removes the account's photo (nothing happens if it has none). Throws on failure. */
export async function removeAccountPhoto(supabase: CoinrootSupabase, userId: string): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET).remove([pathOf(userId)]);
  if (error) throw error;
}

/** Downloads the account's photo into the cache and returns its `file://` URI (`saveProfile` keeps it). Throws on failure. */
export async function downloadAccountPhoto(supabase: CoinrootSupabase, userId: string): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(pathOf(userId), LINK_SECONDS);
  if (error || !data) throw error ?? new Error('No download link');
  const target = new File(Paths.cache, `account-photo-${Date.now()}.jpg`);
  const file = await File.downloadFileAsync(data.signedUrl, target);
  const problem = savedPhotoProblem(file.size);
  if (problem) {
    if (file.exists) file.delete();
    throw new Error(problem);
  }
  return file.uri;
}
