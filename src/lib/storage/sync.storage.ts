import { createSetting } from './settings.storage';

/** Where the last pull of one cloud table stopped (`SyncCursor` in `src/lib/db/sync.database.ts`). */
export type StoredSyncCursor = { at: string; id: string };

export type SyncState = {
  /**
   * The account whose records this phone syncs with, set on its first sync and kept after
   * logging out (the records stay on the phone). Another account may sync here only after
   * "Set up accounts again" removed them.
   */
  owner: string | null;
  /** Per cloud table. */
  cursors: Partial<Record<string, StoredSyncCursor>>;
  /** ISO time of the last successful sync. */
  lastSyncedAt: string | null;
};

export const EMPTY_SYNC_STATE: SyncState = { owner: null, cursors: {}, lastSyncedAt: null };

const isCursor = (value: unknown): value is StoredSyncCursor =>
  !!value && typeof value === 'object' && typeof (value as StoredSyncCursor).at === 'string' && typeof (value as StoredSyncCursor).id === 'string';

/** Cloud sync bookkeeping, on this device only. */
export const syncStateSetting = createSetting<SyncState>({
  key: 'sync-state',
  fallback: EMPTY_SYNC_STATE,
  read: (storage, key) => {
    const raw = storage.getString(key);
    if (!raw) return undefined;
    try {
      const value = JSON.parse(raw) as Record<string, unknown>;
      const cursors = value.cursors && typeof value.cursors === 'object' ? (value.cursors as Record<string, unknown>) : {};
      return {
        owner: typeof value.owner === 'string' ? value.owner : null,
        cursors: Object.fromEntries(Object.entries(cursors).filter(([, cursor]) => isCursor(cursor))) as SyncState['cursors'],
        lastSyncedAt: typeof value.lastSyncedAt === 'string' ? value.lastSyncedAt : null,
      };
    } catch {
      return undefined;
    }
  },
  write: (storage, key, value) => storage.set(key, JSON.stringify(value)),
});
