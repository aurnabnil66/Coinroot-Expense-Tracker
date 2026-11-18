/**
 * Two-way sync of the ledger with the cloud tables (Supabase `accounts`, `categories`,
 * `transactions`, see `supabase/migrations`). SQLite stays the source of truth; this only
 * copies changes both ways. It takes the database and a `SyncRemote` as parameters, so the
 * tests run it on an in-memory database against a fake server.
 *
 * - **Changes on the phone:** a row needs uploading while `synced_updated_at` (what the cloud
 *   last confirmed) differs from `updated_at`. Every write bumps `updated_at`, so nothing has
 *   to remember to flag a row.
 * - **Pull, then push.** Pull asks for rows whose `server_updated_at` is after the last one
 *   seen, starting `overlapMs` earlier because server writes can commit out of order (a row
 *   seen twice is harmless). Push upserts pending rows by `(user_id, id)`.
 * - **Last write wins** by `updated_at`: a pulled row replaces the local one only if it's
 *   newer; the server skips an upload older than what it has (the `sync_row_write` trigger).
 * - **Deletes** are rows with `deleted_at`, synced like any change. A row deleted before it
 *   ever reached the cloud isn't uploaded at all.
 * - **Default categories don't double:** a pulled category with the same kind and name as a
 *   local one that never synced (e.g. the defaults seeded on a second phone) takes its place,
 *   and local entries are moved over to it. Accounts are never merged by name.
 */
import { and, count, eq, getTableColumns, isNotNull, isNull, sql } from 'drizzle-orm';

import type { LedgerDatabase } from './queries.database';
import { accounts, categories, transactions } from './schema.database';

/** In this order: categories first, so a pulled category can replace a local default before its entries arrive. */
export const SYNC_TABLES = ['categories', 'accounts', 'transactions'] as const;
export type SyncTable = (typeof SYNC_TABLES)[number];

const TABLES = { accounts, categories, transactions };
type LedgerTable = (typeof TABLES)[SyncTable];

/** A row as the cloud stores it: snake_case columns plus `user_id` and `server_updated_at`. */
export type RemoteRow = Record<string, unknown>;

/** Where the last pull stopped: the last row's `server_updated_at` (as the server sent it) and id. */
export type SyncCursor = { at: string; id: string };
export type SyncCursors = Partial<Record<SyncTable, SyncCursor>>;

/** The cloud side. `pull` returns rows after `after`, ordered by (server_updated_at, id). */
export type SyncRemote = {
  pull(table: SyncTable, after: SyncCursor | null, limit: number): Promise<RemoteRow[]>;
  push(table: SyncTable, rows: RemoteRow[]): Promise<void>;
};

export type SyncOptions = {
  userId: string;
  cursors?: SyncCursors;
  /** Rows per pull request. */
  pageSize?: number;
  /** Rows per upload. */
  pushSize?: number;
  /** How far before the last cursor a pull starts again. */
  overlapMs?: number;
  now?: () => string;
};

export type SyncResult = {
  cursors: SyncCursors;
  /** Rows the pull added or changed on the phone. */
  pulled: number;
  /** Rows uploaded. */
  pushed: number;
};

const LOCAL_ONLY_FIELD = 'syncedUpdatedAt';
const TIMESTAMP_FIELDS = new Set(['createdAt', 'updatedAt', 'deletedAt']);

/** Field name ↔ column name of every column the cloud has too. */
function sharedColumns(table: LedgerTable): [string, string][] {
  return Object.entries(getTableColumns(table))
    .filter(([field]) => field !== LOCAL_ONLY_FIELD)
    .map(([field, column]) => [field, column.name]);
}

/** Server timestamps (`…123456+00:00`) as the phone writes them (`…123Z`). */
export function toIsoTimestamp(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const time = Date.parse(String(value));
  if (Number.isNaN(time)) throw new Error(`Invalid timestamp from the server: ${String(value)}`);
  return new Date(time).toISOString();
}

const timeOf = (iso: string) => Date.parse(iso);

export function localToRemote(table: LedgerTable, row: Record<string, unknown>, userId: string): RemoteRow {
  const remote: RemoteRow = { user_id: userId };
  for (const [field, column] of sharedColumns(table)) remote[column] = row[field] ?? null;
  return remote;
}

export function remoteToLocal(table: LedgerTable, remote: RemoteRow): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  for (const [field, column] of sharedColumns(table)) {
    const value = remote[column];
    row[field] = TIMESTAMP_FIELDS.has(field) ? toIsoTimestamp(value) : (value ?? null);
  }
  return row;
}

/** Rows that need uploading (changed since the cloud last confirmed them). */
const pending = (table: LedgerTable) => sql`${table.syncedUpdatedAt} is not ${table.updatedAt}`;

type Tx = Parameters<Parameters<LedgerDatabase['transaction']>[0]>[0];

/**
 * A pulled category matching a never-synced local one (same kind and name): moves local
 * entries to the pulled id and removes the local copy (it never left the phone).
 */
function adoptMatchingCategory(tx: Tx, incoming: Record<string, unknown>, now: string) {
  const name = String(incoming.name).trim().toLowerCase();
  const twin = tx
    .select({ id: categories.id })
    .from(categories)
    .where(
      and(
        eq(categories.kind, incoming.kind as 'expense' | 'income_source'),
        sql`lower(trim(${categories.name})) = ${name}`,
        isNull(categories.syncedUpdatedAt),
        isNull(categories.deletedAt)
      )
    )
    .get();
  if (!twin) return;
  const id = String(incoming.id);
  tx.update(transactions).set({ fromId: id, updatedAt: now }).where(eq(transactions.fromId, twin.id)).run();
  tx.update(transactions).set({ toId: id, updatedAt: now }).where(eq(transactions.toId, twin.id)).run();
  tx.delete(categories).where(eq(categories.id, twin.id)).run();
}

/** Applies one pulled row; returns whether the phone's data changed. */
function applyRow(tx: Tx, name: SyncTable, remote: RemoteRow, now: string): boolean {
  const table = TABLES[name];
  const incoming = remoteToLocal(table, remote);
  const id = String(incoming.id);
  const updatedAt = String(incoming.updatedAt);
  const local = tx.select().from(table).where(eq(table.id, id)).get();

  if (!local) {
    if (name === 'categories' && !incoming.deletedAt) adoptMatchingCategory(tx, incoming, now);
    tx.insert(table)
      .values({ ...incoming, syncedUpdatedAt: updatedAt } as never)
      .run();
    return true;
  }
  if (timeOf(updatedAt) > timeOf(local.updatedAt)) {
    const { id: _id, ...fields } = incoming;
    tx.update(table)
      .set({ ...fields, syncedUpdatedAt: updatedAt } as never)
      .where(eq(table.id, id))
      .run();
    return true;
  }
  if (timeOf(updatedAt) === timeOf(local.updatedAt) && local.syncedUpdatedAt !== local.updatedAt) {
    // Our own upload coming back (or the same edit): now confirmed.
    tx.update(table).set({ syncedUpdatedAt: local.updatedAt }).where(eq(table.id, id)).run();
  }
  // Otherwise the phone's row is newer: the push sends it.
  return false;
}

async function pullTable(database: LedgerDatabase, remote: SyncRemote, name: SyncTable, options: Required<Omit<SyncOptions, 'cursors' | 'userId'>>, cursor: SyncCursor | undefined) {
  let after: SyncCursor | null = cursor ? { at: new Date(timeOf(cursor.at) - options.overlapMs).toISOString(), id: '' } : null;
  let last = cursor ?? null;
  let changed = 0;
  for (;;) {
    const page = await remote.pull(name, after, options.pageSize);
    if (page.length === 0) break;
    const now = options.now();
    database.transaction((tx) => {
      for (const row of page) if (applyRow(tx, name, row, now)) changed += 1;
    });
    const tail = page[page.length - 1];
    after = { at: String(tail.server_updated_at), id: String(tail.id) };
    if (!last || timeOf(after.at) > timeOf(last.at) || (timeOf(after.at) === timeOf(last.at) && after.id > last.id)) last = after;
    if (page.length < options.pageSize) break;
  }
  return { cursor: last, changed };
}

async function pushTable(database: LedgerDatabase, remote: SyncRemote, name: SyncTable, userId: string, pushSize: number) {
  const table = TABLES[name];
  let pushed = 0;
  for (;;) {
    const rows = database.select().from(table).where(pending(table)).limit(pushSize).all() as Record<string, unknown>[];
    if (rows.length === 0) break;
    // Deleted before it ever reached the cloud: nothing to send.
    const send = rows.filter((row) => !(row.deletedAt && row.syncedUpdatedAt === null));
    if (send.length > 0) await remote.push(name, send.map((row) => localToRemote(table, row, userId)));
    pushed += send.length;
    database.transaction((tx) => {
      for (const row of rows) {
        // Only if it wasn't edited meanwhile; an edited row stays pending for the next round.
        tx.update(table)
          .set({ syncedUpdatedAt: String(row.updatedAt) })
          .where(and(eq(table.id, String(row.id)), eq(table.updatedAt, String(row.updatedAt))))
          .run();
      }
    });
    if (rows.length < pushSize) break;
  }
  return pushed;
}

/** One full sync: pull every table, then push everything pending. Throws if the remote fails. */
export async function syncLedger(database: LedgerDatabase, remote: SyncRemote, options: SyncOptions): Promise<SyncResult> {
  const settings = {
    pageSize: options.pageSize ?? 1000,
    pushSize: options.pushSize ?? 500,
    overlapMs: options.overlapMs ?? 120_000,
    now: options.now ?? (() => new Date().toISOString()),
  };
  const cursors: SyncCursors = { ...options.cursors };
  let pulled = 0;
  let pushed = 0;
  for (const name of SYNC_TABLES) {
    const { cursor, changed } = await pullTable(database, remote, name, settings, cursors[name]);
    if (cursor) cursors[name] = cursor;
    pulled += changed;
  }
  for (const name of SYNC_TABLES) pushed += await pushTable(database, remote, name, options.userId, settings.pushSize);
  return { cursors, pulled, pushed };
}

/** Whether the phone holds money records (live accounts or transactions); categories don't count. */
export function hasLedgerData(database: LedgerDatabase): boolean {
  const live = (table: typeof accounts | typeof transactions) =>
    database.select({ n: count() }).from(table).where(isNull(table.deletedAt)).get()?.n ?? 0;
  return live(accounts) + live(transactions) > 0;
}

/** How many rows wait for upload (not counting deletions of rows that never reached the cloud). */
export function pendingCount(database: LedgerDatabase): number {
  let total = 0;
  for (const name of SYNC_TABLES) {
    const table = TABLES[name];
    total +=
      database
        .select({ n: count() })
        .from(table)
        .where(and(pending(table), sql`not (${table.deletedAt} is not null and ${table.syncedUpdatedAt} is null)`))
        .get()?.n ?? 0;
  }
  return total;
}

/**
 * Before another account syncs on this phone (only allowed once it holds no money records):
 * drops the previous account's deleted rows for good and marks what's left (its categories)
 * as never synced, so they're matched by name or uploaded to the new account.
 */
export function prepareForNewAccount(database: LedgerDatabase): void {
  database.transaction((tx) => {
    for (const name of SYNC_TABLES) {
      const table = TABLES[name];
      tx.delete(table).where(isNotNull(table.deletedAt)).run();
      tx.update(table).set({ syncedUpdatedAt: null }).run();
    }
  });
}
