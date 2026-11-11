/**
 * Runs the SQL queries on a real SQLite database (better-sqlite3, same migration as the app)
 * and checks each one returns exactly what the tested JS function returns on the full list.
 */
import { beforeAll, describe, expect, it } from '@jest/globals';

import { sampleAccounts, sampleCategories, sampleTransactions } from '@/lib/mocks/sample-data.mock';
import type { Account, Transaction } from '@/lib/types';
import {
  accountBalances,
  addMonths,
  childrenOf,
  compareNewestFirst,
  dailySpending,
  daysInMonth,
  groupByDay,
  incomeByParty,
  linkableParents,
  monthlySpending,
  monthlySummary,
  partySuggestions,
  quickPresets,
  remainingOf,
  takeDays,
  todayKey,
  toMonthKey,
} from '@/lib/utils';

import { rowToAccount, rowToTransaction } from './mappers.database';
import {
  countChildren,
  countTransactions,
  getAccountBalances,
  getAccountTransactions,
  getChildren,
  getChildTotals,
  getLinkableParents,
  getMonthlySpending,
  getPartyNames,
  getRecentDays,
  getRecentTransactions,
  getTransaction,
  getTransactionsBetween,
  type LedgerDatabase,
  remainingFrom,
} from './queries.database';
import { accounts, categories, transactions } from './schema.database';
import { sampleRows } from './seed-rows.database';
import { createTestDatabase } from './testing.database';

let db: LedgerDatabase;
let liveAccounts: Account[];
let all: Transaction[];

/** Small deterministic random numbers, so the generated history is the same every run. */
function random(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
}

beforeAll(() => {
  db = createTestDatabase();

  let n = 0;
  const id = () => `id-${String(++n).padStart(6, '0')}`;
  const rows = sampleRows({ accounts: sampleAccounts, categories: sampleCategories, transactions: sampleTransactions }, [], id);
  db.insert(categories).values(rows.categories).run();
  db.insert(accounts).values(rows.accounts).run();
  for (let i = 0; i < rows.transactions.length; i += 100) db.insert(transactions).values(rows.transactions.slice(i, i + 100)).run();

  // A few hundred more days of mixed entries: links, names with odd spacing / case, rows
  // dated before an account opened, and deleted rows that every query must skip.
  const accountIds = rows.accounts.map((a) => a.id);
  const expenseIds = rows.categories.filter((c) => c.kind === 'expense').map((c) => c.id);
  const incomeIds = rows.categories.filter((c) => c.kind === 'income_source').map((c) => c.id);
  const rand = random(42);
  const pick = <T,>(list: readonly T[]) => list[Math.floor(rand() * list.length)];
  const parties = ['Client A', 'client a', '  Client B ', 'Client C', null, null];
  const today = todayKey();
  const extra: (typeof transactions.$inferInsert)[] = [];
  let parentId: string | null = null;
  for (let d = 1; d <= 400; d++) {
    const date = new Date(Date.parse(`${today}T00:00:00Z`) - d * 86_400_000).toISOString().slice(0, 10);
    for (let k = 0; k < 5; k++) {
      const r = rand();
      const createdAt = `${date}T${String(8 + k).padStart(2, '0')}:00:00.000Z`;
      const base = { id: id(), date, createdAt, updatedAt: createdAt, amount: 100 + Math.floor(rand() * 500_000), note: '' };
      if (r < 0.6) {
        const fromId = pick(accountIds);
        extra.push({ ...base, type: 'expense', fromId, toId: pick(expenseIds), parentId: rand() < 0.3 ? parentId : null });
      } else if (r < 0.8) {
        extra.push({ ...base, type: 'income', fromId: pick(incomeIds), toId: pick(accountIds), party: pick(parties) });
      } else {
        const [fromId, toId] = [pick(accountIds), pick(accountIds)];
        if (fromId === toId) continue;
        extra.push({ ...base, type: 'transfer', fromId, toId });
        parentId = base.id;
      }
      if (rand() < 0.05) extra[extra.length - 1].deletedAt = createdAt;
    }
  }
  for (let i = 0; i < extra.length; i += 100) db.insert(transactions).values(extra.slice(i, i + 100)).run();

  liveAccounts = db.select().from(accounts).all().map(rowToAccount);
  all = db
    .select()
    .from(transactions)
    .all()
    .filter((row) => row.deletedAt === null)
    .map(rowToTransaction);
});

describe('ledger queries match the JS calculations on the full list', () => {
  it('has a realistic amount of data, including deleted rows', () => {
    expect(all.length).toBeGreaterThan(1500);
    expect(countTransactions(db)).toBe(all.length);
    expect(db.select().from(transactions).all().length).toBeGreaterThan(all.length);
  });

  it('account balances', () => {
    expect(getAccountBalances(db)).toEqual(accountBalances(liveAccounts, all));
  });

  it.each([1, 10, 30, 90, 100_000])('list pages of whole days (at least %i entries)', (minCount) => {
    const groups = groupByDay(all);
    const expected = takeDays(groups, minCount);
    const page = getRecentDays(db, minCount);
    expect(page.days).toEqual(expected);
    expect(page.hasMore).toBe(expected.length < groups.length);
  });

  it('month summary, daily spending and income by client from one month of rows', () => {
    for (const month of [toMonthKey(todayKey()), addMonths(toMonthKey(todayKey()), -3)]) {
      const rows = getTransactionsBetween(db, `${month}-01`, `${month}-${daysInMonth(month)}`);
      expect(monthlySummary(month, rows, liveAccounts)).toEqual(monthlySummary(month, all, liveAccounts));
      expect(dailySpending(month, rows)).toEqual(dailySpending(month, all));
      // Screens pass rows newest first; the client's spelling comes from the first one seen.
      expect(incomeByParty(month, rows)).toEqual(incomeByParty(month, [...all].sort(compareNewestFirst)));
    }
  });

  it('six months of spending from six months of rows', () => {
    const end = toMonthKey(todayKey());
    const start = addMonths(end, -5);
    const rows = getTransactionsBetween(db, `${start}-01`, `${end}-${daysInMonth(end)}`);
    expect(monthlySpending(end, 6, rows)).toEqual(monthlySpending(end, 6, all));
    expect(getMonthlySpending(db, end, 6)).toEqual(monthlySpending(end, 6, all));
    expect(getMonthlySpending(db, addMonths(end, -7), 12)).toEqual(monthlySpending(addMonths(end, -7), 12, all));
  });

  it('one account in a date range', () => {
    const [account] = liveAccounts;
    const rows = getTransactionsBetween(db, '2000-01-01', '2999-12-31', account.id);
    expect(rows).toEqual(all.filter((tx) => tx.fromId === account.id || tx.toId === account.id).sort(compareNewestFirst));
  });

  it('Quick add from the newest 100 entries', () => {
    expect(quickPresets(getRecentTransactions(db, 100), 8)).toEqual(quickPresets(all, 8));
  });

  it('"Received from" suggestions', () => {
    expect(getPartyNames(db)).toEqual(partySuggestions(all));
  });

  it('linked entries, what is left of each parent, and the delete count', () => {
    const parents = all.filter((tx) => all.some((child) => child.parentId === tx.id));
    expect(parents.length).toBeGreaterThan(10);
    const totals = getChildTotals(db, all.map((tx) => tx.id));
    for (const parent of parents) {
      expect(getChildren(db, parent.id)).toEqual(childrenOf(parent.id, all).sort(compareNewestFirst));
      expect(remainingFrom(parent, totals)).toBe(remainingOf(parent, all));
      expect(countChildren(db, parent.id)).toBe(childrenOf(parent.id, all).length);
    }
    expect(remainingFrom(all[0], new Map())).toBe(all[0].amount);
  });

  it('"Linked to" choices: newest first, capped, keeping the current link', () => {
    for (const account of liveAccounts) {
      const expected = linkableParents(account.id, all);
      expect(getLinkableParents(db, account.id, { limit: 100_000 })).toEqual(expected);
      expect(getLinkableParents(db, account.id, { limit: 5 })).toEqual(expected.slice(0, 5));
      const old = expected[expected.length - 1];
      if (old && expected.length > 5) {
        expect(getLinkableParents(db, account.id, { limit: 5, keepId: old.id }).map((tx) => tx.id)).toContain(old.id);
      }
      if (expected[0]) {
        expect(getLinkableParents(db, account.id, { excludeId: expected[0].id }).map((tx) => tx.id)).not.toContain(expected[0].id);
      }
    }
  });

  it('account history pages', () => {
    const [account] = liveAccounts;
    const history = all.filter((tx) => tx.fromId === account.id || tx.toId === account.id).sort(compareNewestFirst);
    const page = getAccountTransactions(db, account.id, 50);
    expect(page.transactions).toEqual(history.slice(0, 50));
    expect(page.hasMore).toBe(history.length > 50);
  });

  it('single transactions, skipping deleted ones', () => {
    expect(getTransaction(db, all[0].id)).toEqual(all[0]);
    const deleted = db.select().from(transactions).all().find((row) => row.deletedAt !== null);
    expect(deleted).toBeDefined();
    expect(getTransaction(db, deleted!.id)).toBeNull();
  });
});
