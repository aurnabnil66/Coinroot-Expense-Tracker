/**
 * Made-up sample data so the screens can be designed before the database exists.
 * Generic names and invented amounts only — never real personal data.
 * Dates are relative to today so the list always shows "Today" / "Yesterday".
 * Earlier months get a generated history (before the accounts' opening date, so balances are
 * unaffected) to fill the 6-month chart and the paged transaction list.
 */
import type { Account, Category, Transaction } from '@/lib/types';
import { addDays, addMonths, daysInMonth, todayKey, toMonthKey } from '@/lib/utils';

const today = todayKey();
const monthStart = `${toMonthKey(today)}-01`;
const daysAgo = (days: number) => {
  const day = addDays(today, -days);
  // Keep the sample inside the current month so the summary tab has data.
  return day < monthStart ? monthStart : day;
};

export const sampleAccounts: Account[] = [
  { id: 'acc-salary', name: 'Salary Account', type: 'bank', openingBalance: 2000000, openingDate: monthStart, archived: false, sortOrder: 0, savings: null },
  { id: 'acc-main', name: 'Main Bank', type: 'bank', openingBalance: 6000000, openingDate: monthStart, archived: false, sortOrder: 1, savings: null },
  { id: 'acc-cash', name: 'Cash', type: 'cash', openingBalance: 150000, openingDate: monthStart, archived: false, sortOrder: 2, savings: null },
  { id: 'acc-wallet', name: 'Mobile Wallet', type: 'mobile_wallet', openingBalance: 30000, openingDate: monthStart, archived: false, sortOrder: 3, savings: null },
  {
    id: 'acc-dps',
    name: 'Savings (DPS)',
    type: 'savings',
    openingBalance: 0,
    openingDate: monthStart,
    archived: false,
    sortOrder: 4,
    savings: { installmentAmount: 500000, startDate: monthStart, maturityDate: null, interestRate: null },
  },
];

const expenseNames = [
  'Food', 'Groceries', 'Transport', 'Rent', 'Bills', 'Mobile & Internet', 'Shopping', 'Fitness',
  'Bank Charges', 'Health', 'Education', 'Family', 'Entertainment', 'Gifts', 'Other',
];
const incomeNames = ['Salary', 'Bonus', 'Office Payment', 'Interest/Profit', 'Freelance', 'Gift Received', 'Other Income'];
const swatches = ['orange', 'lime', 'sky', 'violet', 'amber', 'cyan', 'pink', 'emerald', 'slate', 'red', 'indigo', 'rose', 'fuchsia', 'teal', 'zinc'];

const slug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

export const sampleCategories: Category[] = [
  ...expenseNames.map((name, i): Category => ({
    id: `cat-${slug(name)}`, name, kind: 'expense', icon: null, color: swatches[i % swatches.length], archived: false,
  })),
  ...incomeNames.map((name): Category => ({
    id: `src-${slug(name)}`, name, kind: 'income_source', icon: null, color: 'emerald', archived: false,
  })),
];

let seq = 0;
const entry = (
  days: number,
  fields: Pick<Transaction, 'type' | 'fromId' | 'toId' | 'amount'> & Partial<Transaction>
): Transaction => {
  seq += 1;
  const createdAt = new Date(Date.now() - days * 86_400_000 + seq * 1000).toISOString();
  return { id: `tx-${seq}`, date: daysAgo(days), note: '', parentId: null, createdAt, updatedAt: createdAt, ...fields };
};

const salary = entry(4, { type: 'income', fromId: 'src-salary', toId: 'acc-salary', amount: 5000000, note: 'Monthly salary' });
const toMain = entry(4, { type: 'transfer', fromId: 'acc-salary', toId: 'acc-main', amount: 4000000, note: 'Salary transfer' });
const dps = entry(3, { type: 'transfer', fromId: 'acc-main', toId: 'acc-dps', amount: 500000, note: 'DPS installment' });
const fee = entry(3, { type: 'expense', fromId: 'acc-main', toId: 'cat-bank-charges', amount: 2300, note: 'SMS charge' });
const atm = entry(1, { type: 'transfer', fromId: 'acc-main', toId: 'acc-cash', amount: 100000, note: 'ATM withdrawal' });
const ride = entry(1, { type: 'expense', fromId: 'acc-cash', toId: 'cat-transport', amount: 35000, note: 'CNG to office', parentId: atm.id });
const tea = entry(1, { type: 'expense', fromId: 'acc-cash', toId: 'cat-food', amount: 6000, note: 'Tea and snacks', parentId: atm.id });
const topUp = entry(1, { type: 'transfer', fromId: 'acc-main', toId: 'acc-wallet', amount: 50000, note: 'Wallet top-up' });
const recharge = entry(0, { type: 'expense', fromId: 'acc-wallet', toId: 'cat-mobile-internet', amount: 49900, note: 'Data pack', parentId: topUp.id });
const groceries = entry(0, { type: 'expense', fromId: 'acc-main', toId: 'cat-groceries', amount: 87550, note: 'Card payment, supermarket' });
const lunch = entry(0, { type: 'expense', fromId: 'acc-cash', toId: 'cat-food', amount: 22000, note: 'Lunch', parentId: atm.id });

const HISTORY_MONTHS = 5;

/** A typical month: salary in, moved to the main bank, DPS, cash, wallet and everyday spending. */
const historyMonth = (monthsAgo: number): Transaction[] => {
  const month = addMonths(toMonthKey(today), -monthsAgo);
  const lastDay = daysInMonth(month);
  // Vary amounts a little from month to month so the chart has some shape.
  const vary = (amount: number, i: number) => Math.round((amount * (85 + ((monthsAgo * 7 + i * 13) % 35))) / 100);
  const on = (day: number, fields: Pick<Transaction, 'type' | 'fromId' | 'toId' | 'amount'> & Partial<Transaction>) => {
    seq += 1;
    const date = `${month}-${String(Math.min(day, lastDay)).padStart(2, '0')}`;
    const createdAt = `${date}T09:00:${String(seq % 60).padStart(2, '0')}.000Z`;
    return { id: `tx-${seq}`, date, note: '', parentId: null, createdAt, updatedAt: createdAt, ...fields };
  };

  const atm = on(5, { type: 'transfer', fromId: 'acc-main', toId: 'acc-cash', amount: 300000, note: 'ATM withdrawal' });
  const spends: [number, string, number, string][] = [
    [2, 'cat-rent', 1800000, 'Monthly rent'],
    [3, 'cat-bills', 250000, 'Electricity and gas'],
    [4, 'cat-mobile-internet', 99900, 'Internet bill'],
    [7, 'cat-groceries', 420000, 'Monthly groceries'],
    [9, 'cat-food', 65000, 'Dinner out'],
    [12, 'cat-transport', 120000, 'Rides this week'],
    [15, 'cat-shopping', 230000, 'Clothes'],
    [18, 'cat-health', 80000, 'Pharmacy'],
    [21, 'cat-groceries', 180000, 'Groceries top-up'],
    [24, 'cat-entertainment', 50000, 'Movie'],
    [27, 'cat-food', 45000, 'Lunch with friends'],
    [28, 'cat-bank-charges', 2300, 'SMS charge'],
  ];
  return [
    on(1, { type: 'income', fromId: 'src-salary', toId: 'acc-salary', amount: 5000000, note: 'Monthly salary' }),
    on(1, { type: 'transfer', fromId: 'acc-salary', toId: 'acc-main', amount: 4000000, note: 'Salary transfer' }),
    on(3, { type: 'transfer', fromId: 'acc-main', toId: 'acc-dps', amount: 500000, note: 'DPS installment' }),
    atm,
    ...spends.map(([day, toId, amount, note], i) =>
      on(day, {
        type: 'expense',
        fromId: toId === 'cat-transport' || toId === 'cat-food' ? 'acc-cash' : 'acc-main',
        toId,
        amount: vary(amount, i),
        note,
        parentId: toId === 'cat-transport' || toId === 'cat-food' ? atm.id : null,
      })
    ),
  ];
};

const history = Array.from({ length: HISTORY_MONTHS }, (_, i) => historyMonth(i + 1)).flat();

export const sampleTransactions: Transaction[] = [
  ...history,
  salary,
  toMain,
  dps,
  fee,
  atm,
  ride,
  tea,
  topUp,
  recharge,
  groceries,
  lunch,
];
