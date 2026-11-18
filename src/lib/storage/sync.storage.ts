import { createSetting } from './settings.storage';

/** Where the last pull of one cloud table stopped (`SyncCursor` in `src/lib/db/sync.database.ts`). */
export type StoredSyncCursor = { at: string; id: string };

/** A cloud row this phone couldn't store (`SyncSkip` in `src/lib/db/sync.database.ts`). */
export type StoredSyncSkip = {
  table: string;
  id: string;
  reason: string;
  details: { date: string | null; amount: number | null; name: string | null; note: string | null };
};

/** At most this many skipped rows are kept (and retried). */
export const MAX_STORED_SKIPS = 200;

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
  /** Cloud rows the last sync couldn't store; every sync tries them again. */
  skipped: StoredSyncSkip[];
};

export const EMPTY_SYNC_STATE: SyncState = { owner: null, cursors: {}, lastSyncedAt: null, skipped: [] };

const isCursor = (value: unknown): value is StoredSyncCursor =>
  !!value && typeof value === 'object' && typeof (value as StoredSyncCursor).at === 'string' && typeof (value as StoredSyncCursor).id === 'string';

const textOrNull = (value: unknown) => (typeof value === 'string' ? value : null);

function readSkip(value: unknown): StoredSyncSkip | null {
  if (!value || typeof value !== 'object') return null;
  const skip = value as Record<string, unknown>;
  if (typeof skip.table !== 'string' || typeof skip.id !== 'string') return null;
  const details = skip.details && typeof skip.details === 'object' ? (skip.details as Record<string, unknown>) : {};
  return {
    table: skip.table,
    id: skip.id,
    reason: typeof skip.reason === 'string' ? skip.reason : '',
    details: {
      date: textOrNull(details.date),
      amount: typeof details.amount === 'number' ? details.amount : null,
      name: textOrNull(details.name),
      note: textOrNull(details.note),
    },
  };
}

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
        skipped: Array.isArray(value.skipped)
          ? value.skipped.map(readSkip).filter((skip): skip is StoredSyncSkip => skip !== null).slice(0, MAX_STORED_SKIPS)
          : [],
      };
    } catch {
      return undefined;
    }
  },
  write: (storage, key, value) => storage.set(key, JSON.stringify(value)),
});
