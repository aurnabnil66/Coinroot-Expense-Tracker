import { getDocumentAsync } from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import { shareAsync } from 'expo-sharing';

import { todayKey } from '@/lib/utils';

/**
 * Lets the user pick a spreadsheet file (CSV) and returns its name and text, or `null` if they
 * cancel. Any type is allowed, so an Excel / Word file can get a helpful message instead of
 * being greyed out; a file that can't be read as text comes back with empty text.
 */
export async function pickSpreadsheetFile(): Promise<{ name: string; text: string } | null> {
  const result = await getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
  if (result.canceled) return null;
  const [asset] = result.assets;
  try {
    return { name: asset.name, text: await new File(asset.uri).text() };
  } catch {
    return { name: asset.name, text: '' };
  }
}

/** Writes `coinroot-transactions-YYYY-MM-DD.csv` in the cache and opens the share sheet. */
export async function shareSpreadsheetFile(csv: string): Promise<void> {
  const file = new File(Paths.cache, `coinroot-transactions-${todayKey()}.csv`);
  if (file.exists) file.delete();
  file.create();
  // A byte-order mark so Excel opens Bengali text and the ৳ sign correctly.
  await file.write(`﻿${csv}`);
  await shareAsync(file.uri, {
    mimeType: 'text/csv',
    UTI: 'public.comma-separated-values-text',
    dialogTitle: 'Save your transactions',
  });
}
