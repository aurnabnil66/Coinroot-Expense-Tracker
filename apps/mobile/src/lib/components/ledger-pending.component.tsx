import type { ReactNode } from 'react';

import { ledgerStore, type LedgerStatus } from '@/lib/db';
import { ErrorState, LoadingState } from '@/lib/ui';

type LedgerPendingProps = {
  status: LedgerStatus;
  error: string | null;
  /** What to show while loading (a skeleton of the screen); defaults to a spinner. */
  loading?: ReactNode;
};

/** Stands in for a screen's content until the ledger is ready: a loader, or the error with a retry. */
export function LedgerPending({ status, error, loading }: LedgerPendingProps) {
  if (status === 'error') {
    return (
      <ErrorState title="Couldn't load your data" message={error} onRetry={() => void ledgerStore.load()} />
    );
  }
  return loading ?? <LoadingState />;
}
