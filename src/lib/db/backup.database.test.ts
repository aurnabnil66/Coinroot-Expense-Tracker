import { beforeEach, describe, expect, it } from '@jest/globals';
import { isNull } from 'drizzle-orm';

import { sampleAccounts, sampleCategories, sampleTransactions } from '@/lib/mocks/sample-data.mock';
import { type Backup, checkBackup } from '@/lib/schemas';

import { readBackup, restoreBackup } from './backup.database';
import type { LedgerDatabase } from './queries.database';
import { accounts, categories, transactions } from './schema.database';
import { sampleRows } from './seed-rows.database';
import { createTestDatabase } from './testing.database';

let n = 0;
const id = () => `id-${++n}`;

function seed(database: LedgerDatabase) {
  const rows = sampleRows({ accounts: sampleAccounts, categories: sampleCategories, transactions: sampleTransactions }, [], id);
  database.insert(categories).values(rows.categories).run();
  database.insert(accounts).values(rows.accounts).run();
  database.insert(transactions).values(rows.transactions).run();
}

/** Live rows without sync timestamps, which a restore refreshes. */
const content = (backup: Backup) => ({
  accounts: backup.accounts.map(({ updatedAt: _u, ...row }) => row),
  categories: backup.categories.map(({ updatedAt: _u, ...row }) => row),
  transactions: backup.transactions.map(({ updatedAt: _u, ...row }) => row),
});

let db: LedgerDatabase;
beforeEach(() => {
  db = createTestDatabase();
  seed(db);
});

describe('backup and restore', () => {
  it('writes a file that passes its own check', () => {
    const backup = readBackup(db, '2026-11-10T10:00:00.000Z');
    expect(backup.transactions).toHaveLength(sampleTransactions.length);
    const check = checkBackup(JSON.stringify(backup));
    expect(check).toEqual({ ok: true, backup });
  });

  it('restoring your own backup undoes later changes', () => {
    const before = readBackup(db);
    const [first, second] = before.transactions;
    // Later: one entry deleted, one edited, one added.
    db.update(transactions).set({ deletedAt: 'x' }).where(isNull(transactions.parentId)).run();
    db.insert(transactions)
      .values({ ...second, id: 'new-one', note: 'added later', createdAt: 'z', updatedAt: 'z' })
      .run();

    expect(restoreBackup(db, before, '2026-11-11T00:00:00.000Z')).toEqual({
      accounts: before.accounts.length,
      categories: before.categories.length,
      transactions: before.transactions.length,
    });
    const after = readBackup(db);
    expect(content(after)).toEqual(content(before));
    expect(after.transactions.map((t) => t.id)).toContain(first.id);
    expect(after.transactions.map((t) => t.id)).not.toContain('new-one');
    expect(after.transactions.every((t) => t.updatedAt === '2026-11-11T00:00:00.000Z')).toBe(true);
  });

  it('restoring onto a different ledger replaces it and keeps the old rows as deleted', () => {
    const backup = readBackup(db);
    const other = createTestDatabase();
    seed(other); // different ids
    const oldIds = other.select({ id: transactions.id }).from(transactions).all().map((r) => r.id);

    restoreBackup(other, backup);
    expect(content(readBackup(other))).toEqual(content(backup));
    const deleted = other.select().from(transactions).all().filter((r) => r.deletedAt !== null);
    expect(deleted.map((r) => r.id).sort()).toEqual(oldIds.sort());
  });

  it('restores large backups (more rows than one insert can take)', () => {
    const backup = readBackup(db);
    const big: Backup = {
      ...backup,
      transactions: Array.from({ length: 1234 }, (_, i) => ({ ...backup.transactions[0], id: `bulk-${i}`, parentId: null })),
    };
    restoreBackup(db, big);
    expect(readBackup(db).transactions).toHaveLength(1234);
  });
});

describe('checkBackup', () => {
  const valid = () => readBackup(db, '2026-11-10T10:00:00.000Z');
  const errorsOf = (value: unknown) => {
    const check = checkBackup(typeof value === 'string' ? value : JSON.stringify(value));
    return check.ok ? [] : check.errors;
  };

  it('refuses files that are not Coinroot backups', () => {
    expect(errorsOf('not json')).toEqual(["This isn't a Coinroot backup file (it isn't valid JSON)."]);
    expect(errorsOf({ app: 'other', format: 1 })).toEqual(["This isn't a Coinroot backup file."]);
    expect(errorsOf({ ...valid(), format: 99 })[0]).toContain('newer version of Coinroot');
  });

  it('names the row and field that is wrong', () => {
    const backup = valid();
    backup.transactions[13] = { ...backup.transactions[13], amount: 0 };
    backup.accounts[0] = { ...backup.accounts[0], openingDate: '2026-02-30' };
    expect(errorsOf(backup)).toEqual(expect.arrayContaining(['Transaction 14: amount is invalid', 'Account 1: openingDate is invalid']));
  });

  it('checks that from / to / "Linked to" point at the right kind of row', () => {
    const backup = valid();
    const expense = backup.transactions.findIndex((t) => t.type === 'expense');
    const transfer = backup.transactions.findIndex((t) => t.type === 'transfer');
    const income = backup.transactions.findIndex((t) => t.type === 'income');
    backup.transactions[expense] = { ...backup.transactions[expense], toId: backup.accounts[0].id, parentId: 'gone' };
    backup.transactions[transfer] = { ...backup.transactions[transfer], toId: backup.transactions[transfer].fromId };
    backup.transactions[income] = { ...backup.transactions[income], fromId: backup.accounts[0].id };
    expect(errorsOf(backup)).toEqual([
      ...[
        [income, 'unknown income source'],
        [transfer, 'transfer to the same account'],
        [expense, 'unknown expense category'],
        [expense, 'linked to a missing transaction'],
      ]
        .sort((a, b) => (a[0] as number) - (b[0] as number))
        .map(([i, message]) => `Transaction ${(i as number) + 1}: ${message}`),
    ]);
  });

  it('finds repeated ids and sums up long lists of problems', () => {
    const backup = valid();
    backup.accounts.push({ ...backup.accounts[0] });
    expect(errorsOf(backup)).toContain(`Account ${backup.accounts.length}: the same id appears twice`);

    const broken = valid();
    broken.transactions = broken.transactions.map((t) => ({ ...t, amount: -1 }));
    const errors = errorsOf(broken);
    expect(errors).toHaveLength(9);
    expect(errors[8]).toBe(`…and ${broken.transactions.length - 8} more problems.`);
  });
});
