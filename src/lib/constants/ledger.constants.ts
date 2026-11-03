import type { AccountType, CategoryKind, TransactionType } from '@/lib/types';

export const TRANSACTION_TYPE_LABELS: Record<TransactionType, string> = {
  expense: 'Expense',
  income: 'Income',
  transfer: 'Transfer',
};

/** Field labels for the From / To pickers, which mean different things per type. */
export const TRANSACTION_FIELD_LABELS: Record<TransactionType, { from: string; to: string }> = {
  expense: { from: 'Paid from', to: 'Category' },
  income: { from: 'Source', to: 'Received in' },
  transfer: { from: 'From account', to: 'To account' },
};

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  bank: 'Bank',
  cash: 'Cash',
  mobile_wallet: 'Mobile wallet',
  savings: 'Savings / DPS',
};

/** Badge colour per account type (keys of `CATEGORY_COLORS`). */
export const ACCOUNT_TYPE_COLORS: Record<AccountType, string> = {
  bank: 'indigo',
  cash: 'emerald',
  mobile_wallet: 'pink',
  savings: 'amber',
};

/** Section titles on the Accounts tab, in display order. */
export const ACCOUNT_TYPE_SECTIONS: { type: AccountType; title: string }[] = [
  { type: 'bank', title: 'Bank accounts' },
  { type: 'cash', title: 'Cash' },
  { type: 'mobile_wallet', title: 'Mobile wallets' },
  { type: 'savings', title: 'Savings' },
];

export const CATEGORY_KIND_LABELS: Record<CategoryKind, { singular: string; plural: string }> = {
  expense: { singular: 'Category', plural: 'Expense categories' },
  income_source: { singular: 'Income source', plural: 'Income sources' },
};

/**
 * Swatches for category dots. Stored on the category as the key, so the palette
 * can change without touching data. Mid-tone values read well in light and dark mode.
 */
export const CATEGORY_COLORS: Record<string, string> = {
  emerald: '#10b981',
  teal: '#14b8a6',
  cyan: '#06b6d4',
  sky: '#0ea5e9',
  indigo: '#6366f1',
  violet: '#8b5cf6',
  fuchsia: '#d946ef',
  pink: '#ec4899',
  rose: '#f43f5e',
  red: '#ef4444',
  orange: '#f97316',
  amber: '#f59e0b',
  lime: '#84cc16',
  slate: '#64748b',
  zinc: '#71717a',
};

export const DEFAULT_CATEGORY_COLOR = 'zinc';
