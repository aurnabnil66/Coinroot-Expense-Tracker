import { useState } from 'react';

import { countTransactions, db, ledgerStore } from '@/lib/db';
import { DownloadIcon } from '@/lib/gluestack-ui/icon';
import { checkBackup } from '@/lib/schemas';
import { pickBackupFile, shareBackupFile } from '@/lib/storage';
import { useDialog } from '@/lib/ui';
import { formatFullDate } from '@/lib/utils';

const plural = (count: number, one: string, many = `${one}s`) => `${count.toLocaleString('en-US')} ${count === 1 ? one : many}`;

/**
 * Back up to a file (share sheet) and restore from one (pick → check → confirm → replace),
 * with the dialogs for each step. Used by Settings and the Welcome screen.
 */
export function useBackupActions() {
  const dialog = useDialog();
  const [busy, setBusy] = useState<'backup' | 'restore' | null>(null);

  const backUp = async () => {
    if (busy) return;
    setBusy('backup');
    try {
      await shareBackupFile(await ledgerStore.exportBackup());
    } catch {
      await dialog.alert({
        title: "Couldn't make a backup",
        message: 'Something went wrong while writing the file. Please try again.',
        tone: 'danger',
      });
    } finally {
      setBusy(null);
    }
  };

  const restore = async () => {
    if (busy) return;
    setBusy('restore');
    try {
      const file = await pickBackupFile();
      if (!file) return;
      const check = checkBackup(file.text);
      if (!check.ok) {
        await dialog.alert({ title: "Can't restore this file", message: check.errors.join('\n'), tone: 'danger' });
        return;
      }
      const { backup } = check;
      const current = countTransactions(db);
      const restored = await dialog.confirm({
        title: 'Restore this backup?',
        message:
          `${file.name}\nMade on ${formatFullDate(backup.exportedAt.slice(0, 10))}: ${plural(backup.accounts.length, 'account')}, ` +
          `${plural(backup.categories.length, 'category', 'categories')}, ${plural(backup.transactions.length, 'transaction')}.` +
          (current > 0 ? `\n\nIt replaces what's on this phone now (${plural(current, 'transaction')}).` : ''),
        tone: 'warning',
        icon: DownloadIcon,
        confirmLabel: 'Restore',
        onConfirm: () => ledgerStore.restoreBackup(backup),
        errorMessage: "Couldn't restore. Nothing was changed.",
      });
      if (restored) {
        await dialog.alert({
          title: 'Backup restored',
          message: `${plural(backup.transactions.length, 'transaction')} and ${plural(backup.accounts.length, 'account')} are back.`,
          tone: 'success',
        });
      }
    } catch {
      await dialog.alert({ title: "Couldn't open the file", message: 'Please try again, or pick another file.', tone: 'danger' });
    } finally {
      setBusy(null);
    }
  };

  return { backUp, restore, busy };
}
