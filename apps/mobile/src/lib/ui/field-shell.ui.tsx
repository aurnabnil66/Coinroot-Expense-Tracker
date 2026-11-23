import type { PropsWithChildren } from 'react';

import { Text } from '@/lib/gluestack-ui/text';
import { VStack } from '@/lib/gluestack-ui/vstack';

type FieldShellProps = PropsWithChildren<{
  label: string;
  error?: string;
  hint?: string;
}>;

/** Label above, error (or hint) below — shared by every form field. */
export function FieldShell({ label, error, hint, children }: FieldShellProps) {
  return (
    <VStack className="gap-1.5">
      <Text className="text-sm font-medium text-muted-foreground">{label}</Text>
      {children}
      {error ? (
        <Text className="text-xs text-destructive">{error}</Text>
      ) : hint ? (
        <Text className="text-xs text-muted-foreground">{hint}</Text>
      ) : null}
    </VStack>
  );
}
