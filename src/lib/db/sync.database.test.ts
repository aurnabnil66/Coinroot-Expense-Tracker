import { describe, expect, it } from '@jest/globals';
import { and, eq, isNull } from 'drizzle-orm';

import { accountToRow, transactionToRow } from './mappers.database';
import type { LedgerDatabase } from './queries.database';
import { accounts, categories, transactions } from './schema.database';
import { defaultCategoryRows } from './seed-rows.database';
import {
  hasLedgerData,
  pendingCount,
  prepareForNewAccount,
  type RemoteRow,
  type SyncCursors,
  syncLedger,
  type SyncRemote,
  type SyncTable,
} from './sync.database';
import { createTestDatabase } from './testing.database';

const USER = 'user-a';
let counter = 0;
const uid = (prefix: string) => `${prefix}-${(counter += 1)}`;

/** Postgres-style timestamp text (microseconds, +00:00), as the Data API returns it. */
const pgTime = (iso: string) => iso.replace(/\.(\d{3})Z$/, '.$1000+00:00');

/**
 * Behaves like the cloud tables: rows per user keyed by id, `server_updated_at` set on every
 * write, uploads older than the stored row skipped, pulls ordered by (server_updated_at, id).
 */
class FakeServer {
  rows: Record<SyncTable, Map<string, RemoteRow>> = { accounts: new Map(), categories: new Map(), transactions: new Map() };
  private clock = Date.parse('2026-12-01T00:00:00.000Z');
  pushes = 0;

  remote(userId = USER, onPush?: (table: SyncTable) => void): SyncRemote {
    return {
      pull: async (table, after, limit) =>
        [...this.rows[table].values()]
          .filter((row) => row.user_id === userId)
          .sort((a, b) => Date.parse(String(a.server_updated_at)) - Date.parse(String(b.server_updated_at)) || String(a.id).localeCompare(String(b.id)))
          .filter((row) => {
            if (!after) return true;
            const time = Date.parse(String(row.server_updated_at));
            const from = Date.parse(after.at);
            return time > from || (time === from && String(row.id) > after.id);
          })
          .slice(0, limit)
          .map((row) => ({ ...row })),
      push: async (table, rows) => {
        this.pushes += 1;
        onPush?.(table);
        for (const row of rows) {
          const key = `${String(row.user_id)}/${String(row.id)}`;
          const stored = this.rows[table].get(key);
          if (stored && Date.parse(String(row.updated_at)) < Date.parse(String(stored.updated_at))) continue;
          this.clock += 1;
          const timestamps = Object.fromEntries(
            ['created_at', 'updated_at', 'deleted_at'].map((c) => [c, row[c] ? pgTime(String(row[c])) : null])
          );
          this.rows[table].set(key, { ...row, ...timestamps, server_updated_at: pgTime(new Date(this.clock).toISOString()) });
        }
      },
    };
  }

  live(table: SyncTable) {
    return [...this.rows[table].values()].filter((row) => !row.deleted_at);
  }
}

/** A phone: its database and where its last pull stopped. */
function phone(withDefaults = true) {
  const db = createTestDatabase();
  if (withDefaults) db.insert(categories).values(defaultCategoryRows(() => uid('cat'))).run();
  let cursors: SyncCursors = {};
  return {
    db,
    async sync(server: FakeServer, options: { pageSize?: number; pushSize?: number; onPush?: (table: SyncTable) => void } = {}) {
      const result = await syncLedger(db, server.remote(USER, options.onPush), { userId: USER, cursors, ...options });
      cursors = result.cursors;
      return result;
    },
  };
}

let tick = Date.parse('2026-11-01T08:00:00.000Z');
const stamp = () => new Date((tick += 1000)).toISOString();

function addAccount(db: LedgerDatabase, name: string, type: 'cash' | 'bank' = 'cash') {
  const id = uid('acc');
  const now = stamp();
  db.insert(accounts)
    .values({ ...accountToRow({ id, name, type, openingBalance: 100000, openingDate: '2026-11-01', archived: false, sortOrder: 0, savings: null }), createdAt: now, updatedAt: now })
    .run();
  return id;
}

function categoryId(db: LedgerDatabase, name: string) {
  return db.select().from(categories).where(and(eq(categories.name, name), isNull(categories.deletedAt))).get()!.id;
}

function addExpense(db: LedgerDatabase, accountId: string, categoryName: string, amount: number, note = '') {
  const id = uid('tx');
  const now = stamp();
  db.insert(transactions)
    .values(transactionToRow({ id, date: '2026-11-05', type: 'expense', fromId: accountId, toId: categoryId(db, categoryName), amount, note, parentId: null, receivedFrom: null, createdAt: now, updatedAt: now }))
    .run();
  return id;
}

const getTx = (db: LedgerDatabase, id: string) => db.select().from(transactions).where(eq(transactions.id, id)).get();
const editTx = (db: LedgerDatabase, id: string, fields: Partial<typeof transactions.$inferInsert>) =>
  db.update(transactions).set({ ...fields, updatedAt: stamp() }).where(eq(transactions.id, id)).run();

describe('syncLedger', () => {
  it('uploads everything on the first sync, then nothing until something changes', async () => {
    const server = new FakeServer();
    const a = phone();
    const cash = addAccount(a.db, 'Cash');
    addExpense(a.db, cash, 'Food', 12550, 'Lunch');
    addExpense(a.db, cash, 'Transport', 3500);

    const first = await a.sync(server);
    expect(first.pushed).toBe(a.db.select().from(categories).all().length + 1 + 2);
    expect(server.live('transactions')).toHaveLength(2);
    expect(server.live('transactions')[0]).toMatchObject({ user_id: USER, amount: 12550, note: 'Lunch', type: 'expense' });
    expect(pendingCount(a.db)).toBe(0);

    const second = await a.sync(server);
    expect(second).toMatchObject({ pushed: 0, pulled: 0 });
  });

  it("brings one phone's entries to another and doesn't double the default categories", async () => {
    const server = new FakeServer();
    const a = phone();
    const office = addAccount(a.db, 'Office Bank', 'bank');
    const lunch = addExpense(a.db, office, 'Food', 50000);
    await a.sync(server);

    // A second phone with its own default categories and an entry filed under its own "Food".
    const b = phone();
    const bCash = addAccount(b.db, 'Cash');
    const snack = addExpense(b.db, bCash, 'Food', 2000, 'Snack');
    await b.sync(server);

    const names = b.db.select().from(categories).where(isNull(categories.deletedAt)).all().map((c) => `${c.kind}:${c.name}`);
    expect(new Set(names).size).toBe(names.length);
    expect(names).toHaveLength(a.db.select().from(categories).all().length);
    expect(getTx(b.db, lunch)).toMatchObject({ amount: 50000, toId: categoryId(a.db, 'Food') });
    expect(getTx(b.db, snack)?.toId).toBe(categoryId(a.db, 'Food'));

    await a.sync(server);
    expect(getTx(a.db, snack)).toMatchObject({ amount: 2000, note: 'Snack', toId: categoryId(a.db, 'Food') });
    expect(a.db.select().from(accounts).all().map((x) => x.name).sort()).toEqual(['Cash', 'Office Bank']);
    expect(server.live('categories')).toHaveLength(names.length);
  });

  it('keeps the newest edit on every phone', async () => {
    const server = new FakeServer();
    const a = phone();
    const cash = addAccount(a.db, 'Cash');
    const id = addExpense(a.db, cash, 'Food', 1000);
    await a.sync(server);
    const b = phone();
    await b.sync(server);

    editTx(a.db, id, { amount: 2000 }); // earlier edit
    editTx(b.db, id, { amount: 3000 }); // later edit
    await b.sync(server);
    await a.sync(server); // A's older edit: the pull brings B's newer one first
    await b.sync(server);

    expect(getTx(a.db, id)?.amount).toBe(3000);
    expect(getTx(b.db, id)?.amount).toBe(3000);
    expect(server.live('transactions')[0].amount).toBe(3000);
    expect(pendingCount(a.db) + pendingCount(b.db)).toBe(0);
  });

  it("doesn't let a late upload of an older edit overwrite a newer one", async () => {
    const server = new FakeServer();
    const a = phone();
    const cash = addAccount(a.db, 'Cash');
    const id = addExpense(a.db, cash, 'Food', 1000);
    await a.sync(server);
    const b = phone();
    await b.sync(server);

    editTx(b.db, id, { amount: 2000 }); // older edit, still on B
    editTx(a.db, id, { amount: 5000 }); // newer edit
    await a.sync(server);
    // B uploads without pulling first (e.g. the server got A's edit while B's request was on its way).
    await server.remote().push('transactions', [{ ...server.live('transactions')[0], amount: 2000, updated_at: getTx(b.db, id)!.updatedAt }]);
    expect(server.live('transactions')[0].amount).toBe(5000);
  });

  it('syncs deletes, and never uploads a row deleted before it reached the cloud', async () => {
    const server = new FakeServer();
    const a = phone();
    const cash = addAccount(a.db, 'Cash');
    const kept = addExpense(a.db, cash, 'Food', 1000);
    await a.sync(server);
    const b = phone();
    await b.sync(server);

    const deletedAt = stamp();
    a.db.update(transactions).set({ deletedAt, updatedAt: deletedAt }).where(eq(transactions.id, kept)).run();
    const shortLived = addExpense(a.db, cash, 'Food', 777);
    const gone = stamp();
    a.db.update(transactions).set({ deletedAt: gone, updatedAt: gone }).where(eq(transactions.id, shortLived)).run();
    expect(pendingCount(a.db)).toBe(1);

    await a.sync(server);
    expect([...server.rows.transactions.values()].map((r) => r.id)).toEqual([kept]);
    expect(pendingCount(a.db)).toBe(0);

    await b.sync(server);
    expect(getTx(b.db, kept)?.deletedAt).toBe(deletedAt);
  });

  it('leaves an entry edited during the upload pending for the next sync', async () => {
    const server = new FakeServer();
    const a = phone();
    const cash = addAccount(a.db, 'Cash');
    const id = addExpense(a.db, cash, 'Food', 1000);
    let edited = false;
    await a.sync(server, {
      onPush: (table) => {
        if (table === 'transactions' && !edited) {
          edited = true;
          editTx(a.db, id, { amount: 4200 });
        }
      },
    });
    expect(pendingCount(a.db)).toBeGreaterThan(0);
    await a.sync(server);
    expect(pendingCount(a.db)).toBe(0);
    expect(server.live('transactions')[0].amount).toBe(4200);
  });

  it('pages through large uploads and downloads', async () => {
    const server = new FakeServer();
    const a = phone();
    const cash = addAccount(a.db, 'Cash');
    for (let i = 0; i < 1200; i += 1) addExpense(a.db, cash, i % 2 ? 'Food' : 'Transport', 100 + i);
    await a.sync(server, { pushSize: 100 });
    expect(server.live('transactions')).toHaveLength(1200);

    const b = phone(false);
    const result = await b.sync(server, { pageSize: 250 });
    expect(b.db.select().from(transactions).all()).toHaveLength(1200);
    expect(result.pushed).toBe(0);
    expect(pendingCount(b.db)).toBe(0);
  });

  it('handles a pull that re-reads rows it already has (cursor overlap)', async () => {
    const server = new FakeServer();
    const a = phone();
    const cash = addAccount(a.db, 'Cash');
    addExpense(a.db, cash, 'Food', 1000);
    await a.sync(server);
    const b = phone(false);
    await b.sync(server);
    const again = await b.sync(server); // starts two minutes early: re-reads everything
    expect(again).toMatchObject({ pulled: 0, pushed: 0 });
    expect(b.db.select().from(transactions).all()).toHaveLength(1);
  });

  it('stores pulled timestamps the way the phone writes them', async () => {
    const server = new FakeServer();
    const a = phone();
    const cash = addAccount(a.db, 'Cash');
    const id = addExpense(a.db, cash, 'Food', 1000);
    const original = getTx(a.db, id)!.updatedAt;
    await a.sync(server);
    const b = phone(false);
    await b.sync(server);
    expect(getTx(b.db, id)?.updatedAt).toBe(original);
    expect(server.live('transactions')[0].updated_at).toBe(pgTime(original));
  });
});

describe('account change on a phone', () => {
  it('knows whether the phone holds money records', () => {
    const a = phone();
    expect(hasLedgerData(a.db)).toBe(false);
    const cash = addAccount(a.db, 'Cash');
    expect(hasLedgerData(a.db)).toBe(true);
    const at = stamp();
    a.db.update(accounts).set({ deletedAt: at, updatedAt: at }).where(eq(accounts.id, cash)).run();
    expect(hasLedgerData(a.db)).toBe(false);
  });

  it("drops the previous account's deleted rows and re-uploads the categories for the new one", async () => {
    const server = new FakeServer();
    const a = phone();
    const cash = addAccount(a.db, 'Cash');
    addExpense(a.db, cash, 'Food', 1000);
    await a.sync(server);
    const at = stamp();
    a.db.update(transactions).set({ deletedAt: at, updatedAt: at }).run();
    a.db.update(accounts).set({ deletedAt: at, updatedAt: at }).run();

    prepareForNewAccount(a.db);
    expect(a.db.select().from(transactions).all()).toHaveLength(0);
    expect(a.db.select().from(accounts).all()).toHaveLength(0);
    expect(pendingCount(a.db)).toBe(a.db.select().from(categories).all().length);

    const other = new FakeServer();
    const result = await syncLedger(a.db, other.remote('user-b'), { userId: 'user-b' });
    expect(result.pushed).toBe(a.db.select().from(categories).all().length);
    expect(other.live('categories').every((row) => row.user_id === 'user-b')).toBe(true);
  });
});
