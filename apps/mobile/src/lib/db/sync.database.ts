/**
 * Two-way sync of the ledger with the cloud tables (Supabase `accounts`, `categories`,
 * `transactions`, see `packages/supabase/migrations`). SQLite stays the source of truth; this only
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
 *   newer; the server skips an upload older than what it has (the `sync_row_write` trigger)
 *   and pulls an `updated_at` more than a minute in its future back to its own clock, so a
 *   phone whose clock runs ahead can't win every conflict. Uploads report what was stored
 *   (adopted on the phone) and what lost (`overwritten`). A phone whose clock runs slow
 *   still loses ties: the remaining trade-off of using device clocks.
 * - **Deletes** are rows with `deleted_at`, synced like any change. A row deleted before it
 *   ever reached the cloud isn't uploaded at all.
 * - **Default categories don't double:** a pulled category with the same kind and name as
 *   local ones that never synced (e.g. the defaults seeded on a second phone) takes their
 *   place, and local entries are moved over to it. Accounts are never merged by name.
 * - **A bad pulled row doesn't stop sync:** each row is applied in its own savepoint; one the
 *   phone can't store (a broken value, a CHECK the cloud didn't enforce) is rolled back alone,
 *   reported in `skipped` (with a readable reason and what the row is), and the pull moves on.
 *   The caller keeps that list and passes it back as `retry`: every sync fetches those rows by
 *   id and tries again, so a skipped row isn't lost behind the cursor. Entries linked to a
 *   skipped one keep their `parent_id`, so the link returns when it arrives.
 */
import { and, asc, count, eq, getTableColumns, gt, isNotNull, isNull, sql } from 'drizzle-orm';

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

/**
 * The cloud side. `pull` returns rows after `after`, ordered by (server_updated_at, id);
 * `fetch` returns the rows with these ids (those that exist); `push` upserts and returns
 * `{ id, updated_at }` of the rows the server actually stored (a stale one is left out).
 */
export type SyncRemote = {
  pull(table: SyncTable, after: SyncCursor | null, limit: number): Promise<RemoteRow[]>;
  push(table: SyncTable, rows: RemoteRow[]): Promise<RemoteRow[]>;
  fetch(table: SyncTable, ids: string[]): Promise<RemoteRow[]>;
};

export type SyncOptions = {
  userId: string;
  cursors?: SyncCursors;
  /** Rows the last sync skipped (its `skipped`): fetched by id and tried again first. */
  retry?: readonly SyncSkip[];
  /** Rows per pull request. */
  pageSize?: number;
  /** Rows per upload. */
  pushSize?: number;
  /** How far before the last cursor a pull starts again. */
  overlapMs?: number;
  now?: () => string;
};

/** What a skipped row is, so the user can recognise it (whatever the cloud row had). */
export type SyncSkipDetails = { date: string | null; amount: number | null; name: string | null; note: string | null };

/** A pulled row the phone couldn't store, and why (a readable reason). */
export type SyncSkip = { table: SyncTable; id: string; reason: string; details: SyncSkipDetails };

/** Plain-language reasons for the database errors a pulled row can hit. */
const CHECK_REASONS: Record<string, string> = {
  transactions_amount_check: 'amount must be more than 0',
  transactions_from_to_check: 'a transfer to the same account',
  transactions_type_check: 'unknown entry type',
  accounts_type_check: 'unknown account type',
  categories_kind_check: 'unknown category kind',
};

/** A readable reason for why a pulled row couldn't be stored. Pure and tested. */
export function skipReason(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const check = /CHECK constraint failed: (\w+)/i.exec(message);
  if (check) return CHECK_REASONS[check[1]] ?? `breaks the rule ${check[1]}`;
  const missing = /NOT NULL constraint failed: \w+\.(\w+)/i.exec(message);
  if (missing) return `${missing[1].replace(/_/g, ' ')} is missing`;
  if (/Invalid timestamp/i.test(message)) return 'a date or time is invalid';
  if (/missing id/i.test(message)) return 'it has no id';
  return message;
}

function skipOf(table: SyncTable, row: RemoteRow, error: unknown): SyncSkip {
  const text = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : null);
  return {
    table,
    id: typeof row.id === 'string' && row.id ? row.id : '(no id)',
    reason: skipReason(error),
    details: {
      date: text(row.date),
      amount: typeof row.amount === 'number' ? row.amount : null,
      name: text(row.name),
      note: text(row.note),
    },
  };
}

export type SyncResult = {
  cursors: SyncCursors;
  /** Rows the pull added or changed on the phone. */
  pulled: number;
  /** Rows uploaded and stored by the server. */
  pushed: number;
  /** Uploads the server skipped because a newer edit from another phone was already there. */
  overwritten: number;
  /** Pulled rows left out because the phone couldn't store them. */
  skipped: SyncSkip[];
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
 * A pulled category matching never-synced local ones (same kind and name): moves their
 * entries to the pulled id and removes the local copies (they never left the phone, so they
 * aren't tombstoned). Returns the colour and icon the local copies had, so a customised one
 * isn't lost where the pulled row has none.
 */
function adoptMatchingCategories(tx: Tx, incoming: Record<string, unknown>, now: string) {
  const name = String(incoming.name).trim().toLowerCase();
  const twins = tx
    .select({ id: categories.id, color: categories.color, icon: categories.icon })
    .from(categories)
    .where(
      and(
        eq(categories.kind, incoming.kind as 'expense' | 'income_source'),
        sql`lower(trim(${categories.name})) = ${name}`,
        isNull(categories.syncedUpdatedAt),
        isNull(categories.deletedAt)
      )
    )
    .all();
  const id = String(incoming.id);
  for (const twin of twins) {
    tx.update(transactions).set({ fromId: id, updatedAt: now }).where(eq(transactions.fromId, twin.id)).run();
    tx.update(transactions).set({ toId: id, updatedAt: now }).where(eq(transactions.toId, twin.id)).run();
    tx.delete(categories).where(eq(categories.id, twin.id)).run();
  }
  return {
    color: twins.find((twin) => twin.color)?.color ?? null,
    icon: twins.find((twin) => twin.icon)?.icon ?? null,
  };
}

/** Applies one pulled row; returns whether the phone's data changed. */
function applyRow(tx: Tx, name: SyncTable, remote: RemoteRow, now: string): boolean {
  const table = TABLES[name];
  if (typeof remote.id !== 'string' || remote.id === '') throw new Error('missing id');
  const incoming = remoteToLocal(table, remote);
  const id = remote.id;
  const updatedAt = String(incoming.updatedAt);
  const local = tx.select().from(table).where(eq(table.id, id)).get();

  if (!local) {
    if (name === 'categories' && !incoming.deletedAt) {
      const kept = adoptMatchingCategories(tx, incoming, now);
      const color = incoming.color ?? kept.color;
      const icon = incoming.icon ?? kept.icon;
      if (color !== incoming.color || icon !== incoming.icon) {
        // The phone's colour / icon fill what the cloud row lacks; a fresh `updated_at` uploads them.
        tx.insert(categories)
          .values({ ...incoming, color, icon, updatedAt: now, syncedUpdatedAt: updatedAt } as never)
          .run();
        return true;
      }
    }
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

async function pullTable(database: LedgerDatabase, remote: SyncRemote, name: SyncTable, options: Required<Omit<SyncOptions, 'cursors' | 'userId' | 'retry'>>, cursor: SyncCursor | undefined) {
  let after: SyncCursor | null = cursor ? { at: new Date(timeOf(cursor.at) - options.overlapMs).toISOString(), id: '' } : null;
  let last = cursor ?? null;
  let changed = 0;
  const skipped: SyncSkip[] = [];
  /** Ids stored without an error, so an earlier skip of the same row is cleared. */
  const stored = new Set<string>();
  for (;;) {
    const page = await remote.pull(name, after, options.pageSize);
    if (page.length === 0) break;
    const now = options.now();
    database.transaction((tx) => {
      for (const row of page) {
        try {
          // A savepoint per row: a row that fails is undone alone, the rest of the page stays.
          if (tx.transaction((rowTx) => applyRow(rowTx, name, row, now))) changed += 1;
          stored.add(String(row.id));
        } catch (e) {
          skipped.push(skipOf(name, row, e));
        }
      }
    });
    const tail = page[page.length - 1];
    after = { at: String(tail.server_updated_at), id: String(tail.id) };
    if (!last || timeOf(after.at) > timeOf(last.at) || (timeOf(after.at) === timeOf(last.at) && after.id > last.id)) last = after;
    if (page.length < options.pageSize) break;
  }
  return { cursor: last, changed, skipped, stored };
}

/**
 * Uploads pending rows, each once per sync (paged by id). The server answers with the rows it
 * stored and their `updated_at`, which the phone adopts (the server may have pulled a
 * future-dated time back to its own clock). A row it didn't store lost to a newer edit
 * elsewhere: it stays pending, and the next pull brings the winning version.
 */
async function pushTable(database: LedgerDatabase, remote: SyncRemote, name: SyncTable, userId: string, pushSize: number) {
  const table = TABLES[name];
  let pushed = 0;
  let overwritten = 0;
  let afterId = '';
  for (;;) {
    const rows = database
      .select()
      .from(table)
      .where(and(pending(table), gt(table.id, afterId)))
      .orderBy(asc(table.id))
      .limit(pushSize)
      .all() as Record<string, unknown>[];
    if (rows.length === 0) break;
    afterId = String(rows[rows.length - 1].id);
    // Deleted before it ever reached the cloud: nothing to send.
    const unsent = rows.filter((row) => row.deletedAt && row.syncedUpdatedAt === null);
    const send = rows.filter((row) => !unsent.includes(row));
    const stored = new Map<string, string>();
    if (send.length > 0) {
      for (const row of await remote.push(name, send.map((row) => localToRemote(table, row, userId)))) {
        const at = toIsoTimestamp(row.updated_at);
        if (at) stored.set(String(row.id), at);
      }
    }
    pushed += stored.size;
    overwritten += send.length - stored.size;
    database.transaction((tx) => {
      // Only rows not edited meanwhile; an edited one stays pending for the next sync.
      const unchanged = (row: Record<string, unknown>) => and(eq(table.id, String(row.id)), eq(table.updatedAt, String(row.updatedAt)));
      for (const row of unsent) {
        tx.update(table).set({ syncedUpdatedAt: String(row.updatedAt) }).where(unchanged(row)).run();
      }
      for (const row of send) {
        const at = stored.get(String(row.id));
        if (at === undefined) continue; // lost to a newer edit elsewhere: the next pull brings it
        const local = String(row.updatedAt);
        const same = timeOf(at) === timeOf(local);
        tx.update(table)
          .set(same ? { syncedUpdatedAt: local } : { updatedAt: at, syncedUpdatedAt: at })
          .where(unchanged(row))
          .run();
      }
    });
    if (rows.length < pushSize) break;
  }
  return { pushed, overwritten };
}

/**
 * Tries the rows a previous sync skipped again, fetched by id (they may be older than the
 * cursor). Ones that now fit are stored; ones gone from the cloud are dropped.
 */
async function retrySkipped(database: LedgerDatabase, remote: SyncRemote, retry: readonly SyncSkip[], now: string) {
  let changed = 0;
  const skipped: SyncSkip[] = [];
  for (const name of SYNC_TABLES) {
    const ids = retry.filter((skip) => skip.table === name && skip.id !== '(no id)').map((skip) => skip.id);
    for (let i = 0; i < ids.length; i += 100) {
      const rows = await remote.fetch(name, ids.slice(i, i + 100));
      database.transaction((tx) => {
        for (const row of rows) {
          try {
            if (tx.transaction((rowTx) => applyRow(rowTx, name, row, now))) changed += 1;
          } catch (e) {
            skipped.push(skipOf(name, row, e));
          }
        }
      });
    }
  }
  return { changed, skipped };
}

/** One full sync: retry earlier skips, pull every table, then push everything pending. Throws if the remote fails. */
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
  const skipped: SyncSkip[] = [];
  if (options.retry && options.retry.length > 0) {
    const again = await retrySkipped(database, remote, options.retry, settings.now());
    pulled += again.changed;
    skipped.push(...again.skipped);
  }
  const stored = new Set<string>();
  for (const name of SYNC_TABLES) {
    const result = await pullTable(database, remote, name, settings, cursors[name]);
    if (result.cursor) cursors[name] = result.cursor;
    pulled += result.changed;
    skipped.push(...result.skipped);
    for (const id of result.stored) stored.add(`${name}/${id}`);
  }
  let overwritten = 0;
  for (const name of SYNC_TABLES) {
    const result = await pushTable(database, remote, name, options.userId, settings.pushSize);
    pushed += result.pushed;
    overwritten += result.overwritten;
  }
  // One entry per row (a row can be retried and pulled again in the same sync): the latest wins.
  const unique = new Map(skipped.map((skip) => [`${skip.table}/${skip.id}`, skip]));
  for (const key of stored) unique.delete(key);
  return { cursors, pulled, pushed, overwritten, skipped: [...unique.values()] };
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
 * as never synced, so they're matched by name or uploaded to the new account. Refuses (throws)
 * while live accounts or transactions remain, whoever calls it.
 */
export function prepareForNewAccount(database: LedgerDatabase): void {
  if (hasLedgerData(database)) {
    throw new Error("This phone still has another account's records; remove them (Set up accounts again) first.");
  }
  database.transaction((tx) => {
    for (const name of SYNC_TABLES) {
      const table = TABLES[name];
      tx.delete(table).where(isNotNull(table.deletedAt)).run();
      tx.update(table).set({ syncedUpdatedAt: null }).run();
    }
  });
}
