import { getDocumentAsync } from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import { shareAsync } from 'expo-sharing';

import type { Backup } from '@/lib/schemas';

import { createSetting } from './settings.storage';

/** When the last backup file was shared (ISO time), or `null` if never. */
export const lastBackupSetting = createSetting<string | null>({
  key: 'last-backup-at',
  fallback: null,
  read: (storage, key) => storage.getString(key),
  write: (storage, key, value) => {
    if (value) storage.set(key, value);
    else storage.remove(key);
  },
});

/**
 * Writes the backup as `coinroot-backup-YYYY-MM-DD.json` in the cache and opens the share sheet,
 * so the user can save it to Drive, Files, email, etc. Resolves when the sheet closes.
 */
export async function shareBackupFile(backup: Backup): Promise<void> {
  const file = new File(Paths.cache, `coinroot-backup-${backup.exportedAt.slice(0, 10)}.json`);
  if (file.exists) file.delete();
  file.create();
  await file.write(JSON.stringify(backup));
  await shareAsync(file.uri, { mimeType: 'application/json', UTI: 'public.json', dialogTitle: 'Save your Coinroot backup' });
  lastBackupSetting.set(backup.exportedAt);
}

/** Lets the user pick a backup file and returns its name and text, or `null` if they cancel. */
export async function pickBackupFile(): Promise<{ name: string; text: string } | null> {
  // Any type: file managers and cloud apps label .json files inconsistently; the content is checked anyway.
  const result = await getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
  if (result.canceled) return null;
  const [asset] = result.assets;
  const picked = new File(asset.uri);
  const text = await picked.text();
  return { name: asset.name, text };
}
