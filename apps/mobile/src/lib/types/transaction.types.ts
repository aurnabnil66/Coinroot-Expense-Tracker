export const TRANSACTION_TYPES = ['expense', 'income', 'transfer'] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

/**
 * - income:   from = income source (category), to = account
 * - expense:  from = account, to = expense category
 * - transfer: from = account, to = another account
 */
export type Transaction = {
  id: string;
  /** "YYYY-MM-DD" */
  date: string;
  type: TransactionType;
  fromId: string;
  toId: string;
  /** Poisha, always positive. */
  amount: number;
  note: string;
  /** The transaction this money came from (e.g. an expense paid from an ATM withdrawal). */
  parentId: string | null;
  /** Income only: who paid, e.g. a client's name ("Received from"). */
  receivedFrom: string | null;
  createdAt: string;
  updatedAt: string;
};
