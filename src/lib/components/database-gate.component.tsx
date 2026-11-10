import { type PropsWithChildren, useState } from 'react';
import { View } from 'react-native';

import { useDatabaseSetup } from '@/lib/db';
import { ErrorState, LoadingState } from '@/lib/ui';

/**
 * Shows the app only once the database is ready: tables created or updated (migrations).
 * Meanwhile a spinner; on failure an error with "Try again", which runs them again.
 */
export function DatabaseGate({ children }: PropsWithChildren) {
  const [attempt, setAttempt] = useState(0);
  return (
    <Migrations key={attempt} onRetry={() => setAttempt((n) => n + 1)}>
      {children}
    </Migrations>
  );
}

function Migrations({ children, onRetry }: PropsWithChildren<{ onRetry: () => void }>) {
  const { status, error } = useDatabaseSetup();
  if (status === 'ready') return children;
  return (
    <View className="flex-1 justify-center bg-background">
      {status === 'error' ? (
        <ErrorState
          title="Couldn't open your data"
          message={`Coinroot couldn't prepare its database on this phone. ${error.message}`}
          onRetry={onRetry}
        />
      ) : (
        <LoadingState label="Opening your data…" />
      )}
    </View>
  );
}
