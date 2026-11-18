import { describe, expect, it } from '@jest/globals';

import type { Account, Transaction } from '@/lib/types';

import {
  accountBalance,
  balanceAdjustment,
  dailySpending,
  deleteTransactionMessage,
  findCategoryByName,
  flattenMoneyTree,
  groupByDay,
  incomeByPayer,
  linkableParents,
  monthlySpending,
  monthlySummary,
  MONEY_TREE_MAX_NODES,
  moneyTree,
  receivedFromSuggestions,
  quickPresets,
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
    receivedFrom: null,
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

describe('deleteTransactionMessage', () => {
  it('mentions linked entries only when there are some', () => {
    expect(deleteTransactionMessage(0)).toBe("This can't be undone.");
    expect(deleteTransactionMessage(1)).toBe("The 1 linked entry stays but loses its link. This can't be undone.");
    expect(deleteTransactionMessage(3)).toBe("The 3 linked entries stay but lose their link. This can't be undone.");
  });
});

describe('findCategoryByName', () => {
  it('matches by kind and name, ignoring case', () => {
    const categories = [
      { id: 'c1', name: 'Bank Charges', kind: 'expense' as const, icon: null, color: null, archived: false },
      { id: 'c2', name: 'Bank charges', kind: 'income_source' as const, icon: null, color: null, archived: false },
    ];
    expect(findCategoryByName(categories, 'expense', 'bank charges')?.id).toBe('c1');
    expect(findCategoryByName(categories, 'expense', 'Rent')).toBeUndefined();
  });
});

describe('incomeByPayer and receivedFromSuggestions', () => {
  const fromA = tx({ type: 'income', fromId: 'src-client', toId: 'cash', amount: 100000, receivedFrom: 'Client A', date: '2026-11-03' });
  const fromB = tx({ type: 'income', fromId: 'src-client', toId: 'cash', amount: 50000, receivedFrom: 'Client B', date: '2026-11-04' });
  const fromA2 = tx({ type: 'income', fromId: 'src-client', toId: 'cash', amount: 30000, receivedFrom: 'client a ', date: '2026-11-05' });
  const list = [...all, fromA, fromB, fromA2];

  it('totals income per name for the month, largest first', () => {
    expect(incomeByPayer('2026-11', list)).toEqual([
      { receivedFrom: 'Client A', amount: 130000 },
      { receivedFrom: 'Client B', amount: 50000 },
    ]);
  });

  it('suggests names used before, newest first, once each', () => {
    expect(receivedFromSuggestions(list)).toEqual(['client a', 'Client B']);
  });
});

describe('quickPresets', () => {
  it('ranks type + from + to combinations by use', () => {
    const presets = quickPresets(all, 2);
    expect(presets[0]).toEqual({ type: 'expense', fromId: 'cash', toId: 'cat-transport', count: 2 });
    expect(presets).toHaveLength(2);
  });
});

describe('balanceAdjustment', () => {
  it('records missing money as an expense and extra money as income', () => {
    expect(balanceAdjustment(50000, 50000)).toBeNull();
    expect(balanceAdjustment(50000, 38000)).toEqual({ type: 'expense', amount: 12000 });
    expect(balanceAdjustment(50000, 52000)).toEqual({ type: 'income', amount: 2000 });
  });
});

describe('moneyTree', () => {
  // Salary → office → primary → ATM → cash spending, plus a DPS installment and an unlinked expense.
  const salary = tx({ id: 'salary', type: 'income', fromId: 'src-salary', toId: 'office', amount: 8_500_000, date: '2026-11-01' });
  const toPrimary = tx({ id: 'to-primary', type: 'transfer', fromId: 'office', toId: 'primary', amount: 7_000_000, date: '2026-11-02', parentId: 'salary' });
  const atm = tx({ id: 'atm', type: 'transfer', fromId: 'primary', toId: 'cash', amount: 1_000_000, date: '2026-11-03', parentId: 'to-primary' });
  const dps = tx({ id: 'dps', type: 'transfer', fromId: 'primary', toId: 'dps-acc', amount: 500_000, date: '2026-11-10', parentId: 'to-primary' });
  const lunch = tx({ id: 'lunch', type: 'expense', fromId: 'cash', toId: 'food', amount: 120_050, date: '2026-11-04', parentId: 'atm' });
  const cng = tx({ id: 'cng', type: 'expense', fromId: 'cash', toId: 'transport', amount: 35_000, date: '2026-11-03', parentId: 'atm' });
  const unlinked = tx({ id: 'unlinked', type: 'expense', fromId: 'cash', toId: 'food', amount: 999 });
  const all = [salary, toPrimary, atm, dps, lunch, cng, unlinked];

  it('walks up to the root and down through everything paid from it, oldest first', () => {
    const tree = moneyTree('lunch', all)!;
    expect(tree.path.map((t) => t.id)).toEqual(['salary', 'to-primary', 'atm', 'lunch']);
    expect(flattenMoneyTree(tree.root).map((n) => `${'  '.repeat(n.depth)}${n.tx.id}`)).toEqual([
      'salary',
      '  to-primary',
      '    atm',
      '      cng',
      '      lunch',
      '    dps',
    ]);
    expect(tree.size).toBe(6);
    expect(tree.truncated).toBe(false);
  });

  it("says what's left at each step, what was spent, and they add up to the root", () => {
    const tree = moneyTree('salary', all)!;
    const leftOf = new Map(flattenMoneyTree(tree.root).map((n) => [n.tx.id, n.left]));
    expect(leftOf.get('salary')).toBe(1_500_000); // still in the office account
    expect(leftOf.get('to-primary')).toBe(5_500_000); // after the ATM and the DPS installment
    expect(leftOf.get('atm')).toBe(844_950); // cash left after CNG and lunch
    expect(leftOf.get('dps')).toBe(500_000);
    expect(leftOf.get('lunch')).toBe(0);
    expect(tree.spent).toBe(155_050);
    expect(tree.spent + tree.left).toBe(salary.amount);
  });

  it('is just the entry when nothing is linked', () => {
    const tree = moneyTree('unlinked', all)!;
    expect(tree).toMatchObject({ path: [unlinked], size: 1, spent: 999, left: 0 });
    expect(tree.root.children).toEqual([]);
  });

  it('stops at a link to a missing entry, and returns null for an unknown id', () => {
    const orphan = tx({ id: 'orphan', type: 'expense', fromId: 'cash', toId: 'food', amount: 10, parentId: 'deleted-atm' });
    expect(moneyTree('orphan', [orphan])!.path.map((t) => t.id)).toEqual(['orphan']);
    expect(moneyTree('nope', all)).toBeNull();
  });

  it('survives a link loop', () => {
    const a = tx({ id: 'loop-a', type: 'transfer', fromId: 'x', toId: 'y', amount: 100, parentId: 'loop-b' });
    const b = tx({ id: 'loop-b', type: 'transfer', fromId: 'y', toId: 'x', amount: 100, parentId: 'loop-a' });
    const tree = moneyTree('loop-a', [a, b])!;
    expect(tree.path.map((t) => t.id)).toEqual(['loop-b', 'loop-a']);
    expect(flattenMoneyTree(tree.root).map((n) => n.tx.id)).toEqual(['loop-b', 'loop-a']);
  });

  it('cuts off very large trees, keeping the levels nearest the root, with honest totals', () => {
    const big = tx({ id: 'big', type: 'income', fromId: 'src', toId: 'cash', amount: 10_000_000 });
    const spends = Array.from({ length: MONEY_TREE_MAX_NODES + 20 }, (_, i) =>
      tx({ id: `s${String(i).padStart(4, '0')}`, type: 'expense', fromId: 'cash', toId: 'food', amount: 100, parentId: 'big' })
    );
    const tree = moneyTree('big', [big, ...spends])!;
    expect(tree.truncated).toBe(true);
    expect(tree.size).toBe(MONEY_TREE_MAX_NODES);
    expect(tree.root.left).toBe(10_000_000 - spends.length * 100);
    expect(tree.spent).toBe(spends.length * 100);
    expect(tree.spent + tree.left).toBe(big.amount);
  });

  it('hides the children of collapsed nodes when flattened', () => {
    const tree = moneyTree('salary', all)!;
    expect(flattenMoneyTree(tree.root, new Set(['to-primary'])).map((n) => n.tx.id)).toEqual(['salary', 'to-primary']);
  });
});
