import { AppState } from 'react-native';

import { db, hasLedgerData, ledgerCounts, ledgerStore, pendingCount, prepareForNewAccount, syncLedger, whenDatabaseReady } from '@/lib/db';
import { setupStateSetting, syncStateSetting } from '@/lib/storage';

import { AUTH_MESSAGES } from './auth-messages.supabase';
import { authStore } from './auth-store.supabase';
import { getSupabase } from './client.supabase';
import { supabaseSyncRemote } from './sync-remote.supabase';

/**
 * Runs cloud sync (`syncLedger` in `src/lib/db/sync.database.ts`) for the signed-in account:
 * on app start, after logging in, a few seconds after each change, when the app comes back
 * to the foreground, and from Settings → Sync now. One sync at a time; a request while one
 * runs starts another right after.
 *
 * Rules:
 * - Signed out, sample data, or no Supabase settings: sync is off.
 * - The first account to sync on a phone merges the phone's records with its cloud records.
 * - Another account can't sync while the phone holds the first one's records ("blocked")
 *   until Settings → Set up accounts again removes them.
 * - Records arriving on a phone still in first-time setup finish the setup (a new phone).
 */
export type SyncStatus = 'off' | 'idle' | 'syncing' | 'error' | 'blocked';
export type SyncOffReason = 'not-configured' | 'signed-out' | 'sample';

export type SyncSnapshot = {
  status: SyncStatus;
  /** Why sync is off (status `off`). */
  offReason: SyncOffReason | null;
  /** What went wrong (status `error`). */
  error: string | null;
  /** ISO time of the last successful sync. */
  lastSyncedAt: string | null;
  /** Changes on the phone waiting for upload, as of the last check. */
  pending: number;
  /** Rows the last sync couldn't store on this phone (left out; see `SyncSkip`). */
  skipped: number;
};

/** Waits this long after a change, so a burst of edits uploads together. */
const CHANGE_DELAY_MS = 3000;
/** Coming back to the foreground syncs only if the last attempt is older than this. */
const FOREGROUND_GAP_MS = 60_000;

let snapshot: SyncSnapshot = {
  status: 'off',
  offReason: null,
  error: null,
  lastSyncedAt: syncStateSetting.get().lastSyncedAt,
  pending: 0,
  skipped: 0,
};
const listeners = new Set<() => void>();

function commit(next: Partial<SyncSnapshot>) {
  snapshot = { ...snapshot, ...next };
  listeners.forEach((listener) => listener());
}

function messageOf(error: unknown): string {
  const text = error instanceof Error || (error && typeof error === 'object' && 'message' in error) ? String((error as { message: unknown }).message) : String(error);
  if (/network request failed|failed to fetch|fetch failed|network/i.test(text)) return AUTH_MESSAGES.offline;
  return text || 'Something went wrong.';
}

let running: Promise<void> | null = null;
let again = false;
let lastAttempt = 0;
/** The last ledger version seen; a new one means the user changed something. */
let seenVersion = -1;
/** True while sync itself refreshes the ledger, so its own changes don't schedule another sync. */
let refreshing = false;
let changeTimer: ReturnType<typeof setTimeout> | null = null;

async function runOnce(): Promise<void> {
  lastAttempt = Date.now();
  const supabase = getSupabase();
  const session = authStore.getSession();
  if (!supabase) return commit({ status: 'off', offReason: 'not-configured', error: null });
  if (!session) return commit({ status: 'off', offReason: 'signed-out', error: null });
  if (setupStateSetting.get() === 'sample') return commit({ status: 'off', offReason: 'sample', error: null });

  await whenDatabaseReady();
  const state = syncStateSetting.get();
  if (state.owner !== session.userId) {
    if (state.owner !== null && hasLedgerData(db)) {
      return commit({ status: 'blocked', offReason: null, error: null, pending: pendingCount(db) });
    }
    // A new phone, records made before signing in (merged), or a phone emptied by "Set up accounts again".
    if (state.owner !== null) prepareForNewAccount(db);
    syncStateSetting.set({ owner: session.userId, cursors: {}, lastSyncedAt: null });
  }

  commit({ status: 'syncing', offReason: null, error: null, pending: pendingCount(db) });
  try {
    const result = await syncLedger(db, supabaseSyncRemote(supabase), {
      userId: session.userId,
      cursors: syncStateSetting.get().cursors,
    });
    const lastSyncedAt = new Date().toISOString();
    syncStateSetting.set({ owner: session.userId, cursors: result.cursors, lastSyncedAt });
    if (result.pulled > 0) {
      // Logged in during first-time setup on a phone without records: the account's records finish it.
      if (setupStateSetting.get() === 'none' && ledgerCounts(db).accounts > 0) setupStateSetting.set('own');
      refreshing = true;
      try {
        seenVersion = ledgerStore.refreshAfterSync();
      } finally {
        refreshing = false;
      }
    }
    if (result.skipped.length > 0 && __DEV__) {
      console.warn(`Cloud sync left out ${result.skipped.length} row(s) this phone can't store:`, result.skipped);
    }
    commit({ status: 'idle', error: null, lastSyncedAt, pending: pendingCount(db), skipped: result.skipped.length });
  } catch (e) {
    commit({ status: 'error', error: messageOf(e), pending: pendingCount(db) });
  }
}

/** Syncs now (or right after the sync already running). Never throws; the result is in the snapshot. */
function syncNow(): Promise<void> {
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    do {
      again = false;
      try {
        await runOnce();
      } catch (e) {
        commit({ status: 'error', error: messageOf(e) });
      }
    } while (again);
  })().finally(() => {
    running = null;
  });
  return running;
}

function scheduleAfterChange() {
  if (changeTimer) clearTimeout(changeTimer);
  changeTimer = setTimeout(() => {
    changeTimer = null;
    void syncNow();
  }, CHANGE_DELAY_MS);
}

let started = false;

/** Starts following log-ins, ledger changes and the app's foreground state (once). */
function start() {
  if (started) return;
  started = true;
  authStore.subscribe(() => {
    if (authStore.getSession()) void syncNow();
    else commit({ status: 'off', offReason: 'signed-out', error: null });
  });
  ledgerStore.subscribe(() => {
    const { version, status } = ledgerStore.getSnapshot();
    if (status !== 'ready' || version === seenVersion) return;
    if (refreshing) {
      seenVersion = version;
      return;
    }
    const first = seenVersion === -1;
    seenVersion = version;
    if (!first) scheduleAfterChange();
  });
  AppState.addEventListener('change', (state) => {
    if (state === 'active' && Date.now() - lastAttempt > FOREGROUND_GAP_MS) void syncNow();
  });
  void syncNow();
}

export const syncStore = {
  start,
  syncNow,

  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  getSnapshot: (): SyncSnapshot => snapshot,

  /**
   * Syncs, but waits at most `ms` (the sync carries on in the background). For log-out (a
   * last upload) and logging in during setup (the account's records). Never throws.
   */
  async syncWithin(ms: number): Promise<void> {
    if (!authStore.getSession()) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    await Promise.race([syncNow(), new Promise<void>((resolve) => (timer = setTimeout(resolve, ms)))]);
    clearTimeout(timer);
  },
};
