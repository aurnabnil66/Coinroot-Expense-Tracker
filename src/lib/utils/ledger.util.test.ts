import { describe, expect, it } from '@jest/globals';

import type { Account, Transaction } from '@/lib/types';

import {
  accountBalance,
  dailySpending,
  groupByDay,
  linkableParents,
  monthlySpending,
  monthlySummary,
  remainingOf,
  takeDays,
} from './ledger.util';

const account = (id: string, overrides: Partial<Account> = {}): Account => ({
  id,
  name: id,
  type: 'bank',
  openingBalance: 0,
  openingDate: '2026-11-01',
  archived: false,
  sortOrder: 0,
  savings: null,
  ...overrides,
});

let seq = 0;
const tx = (overrides: Partial<Transaction> & Pick<Transaction, 'type' | 'fromId' | 'toId' | 'amount'>): Transaction => {
  seq += 1;
  return {
    id: `t${seq}`,
    date: '2026-11-02',
    note: '',
    parentId: null,
    createdAt: `2026-11-02T00:00:${String(seq).padStart(2, '0')}Z`,
    updatedAt: '',
    ...overrides,
  };
};

const salaryAcc = account('salary-acc', { openingBalance: 500000 });
const mainBank = account('main-bank', { openingBalance: 1000000 });
const cash = account('cash', { type: 'cash' });
const dps = account('dps', { type: 'savings' });
const accounts = [salaryAcc, mainBank, cash, dps];

const salary = tx({ type: 'income', fromId: 'src-salary', toId: 'salary-acc', amount: 5000000 });
const moveToMain = tx({ type: 'transfer', fromId: 'salary-acc', toId: 'main-bank', amount: 4500000 });
const atm = tx({ type: 'transfer', fromId: 'main-bank', toId: 'cash', amount: 50000 });
const cng = tx({ type: 'expense', fromId: 'cash', toId: 'cat-transport', amount: 40000, parentId: atm.id });
const rickshaw = tx({ type: 'expense', fromId: 'cash', toId: 'cat-transport', amount: 5000, parentId: atm.id });
const groceries = tx({ type: 'expense', fromId: 'main-bank', toId: 'cat-groceries', amount: 57000 });
const installment = tx({ type: 'transfer', fromId: 'main-bank', toId: 'dps', amount: 500000 });
const oldExpense = tx({ type: 'expense', fromId: 'main-bank', toId: 'cat-food', amount: 99900, date: '2026-10-31' });
const all = [salary, moveToMain, atm, cng, rickshaw, groceries, installment, oldExpense];

describe('accountBalance', () => {
  it('adds money in and subtracts money out', () => {
    expect(accountBalance(salaryAcc, all)).toBe(500000 + 5000000 - 4500000);
    expect(accountBalance(mainBank, all)).toBe(1000000 + 4500000 - 50000 - 57000 - 500000);
    expect(accountBalance(cash, all)).toBe(50000 - 40000 - 5000);
    expect(accountBalance(dps, all)).toBe(500000);
  });

  it('ignores transactions before the opening date', () => {
    expect(accountBalance(mainBank, [oldExpense])).toBe(1000000);
  });
});

describe('remainingOf', () => {
  it('is the parent amount minus linked children', () => {
    expect(remainingOf(atm, all)).toBe(5000);
    expect(remainingOf(groceries, all)).toBe(57000);
  });
});

describe('linkableParents', () => {
  it('lists money that went into the account, newest first', () => {
    expect(linkableParents('cash', all).map((t) => t.id)).toEqual([atm.id]);
    expect(linkableParents('main-bank', all).map((t) => t.id)).toEqual([moveToMain.id]);
  });
});

describe('monthlySummary', () => {
  it('never counts transfers as income or expenses', () => {
    const summary = monthlySummary('2026-11', all, accounts);
    expect(summary.income).toBe(5000000);
    expect(summary.expenses).toBe(40000 + 5000 + 57000);
    expect(summary.saved).toBe(5000000 - 102000);
    expect(summary.movedToSavings).toBe(500000);
  });

  it('breaks expenses down by category, largest first', () => {
    const { byCategory } = monthlySummary('2026-11', all, accounts);
    expect(byCategory.map((c) => [c.categoryId, c.amount])).toEqual([
      ['cat-groceries', 57000],
      ['cat-transport', 45000],
    ]);
    expect(byCategory.reduce((total, c) => total + c.share, 0)).toBeCloseTo(1);
  });

  it('only includes the requested month', () => {
    const october = monthlySummary('2026-10', all, accounts);
    expect(october.expenses).toBe(99900);
    expect(october.income).toBe(0);
  });
});

describe('groupByDay', () => {
  it('groups newest day first with the day total spent', () => {
    const groups = groupByDay(all);
    expect(groups.map((g) => g.date)).toEqual(['2026-11-02', '2026-10-31']);
    expect(groups[0].spent).toBe(102000);
    expect(groups[0].data[0].id).toBe(installment.id);
  });
});

describe('dailySpending', () => {
  it('has one entry per day and counts only expenses', () => {
    const days = dailySpending('2026-11', all);
    expect(days).toHaveLength(30);
    expect(days[0]).toEqual({ key: '2026-11-01', amount: 0 });
    expect(days[1]).toEqual({ key: '2026-11-02', amount: 40000 + 5000 + 57000 });
  });
});

describe('monthlySpending', () => {
  it('returns months oldest first, ending with the given month', () => {
    const months = monthlySpending('2026-11', 3, all);
    expect(months.map((m) => m.key)).toEqual(['2026-09', '2026-10', '2026-11']);
    expect(months.map((m) => m.amount)).toEqual([0, 99900, 102000]);
  });
});

describe('takeDays', () => {
  const groups = groupByDay(all); // 2026-11-02 (7 entries), 2026-10-31 (1 entry)

  it('keeps whole days until the limit is reached', () => {
    expect(takeDays(groups, 3).map((g) => g.date)).toEqual(['2026-11-02']);
    expect(takeDays(groups, 8).map((g) => g.date)).toEqual(['2026-11-02', '2026-10-31']);
  });

  it('returns every day when the limit is larger than the list', () => {
    expect(takeDays(groups, 100)).toHaveLength(2);
  });
});
