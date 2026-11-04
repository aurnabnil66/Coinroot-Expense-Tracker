import type { ReactNode } from 'react';

import { Text } from '@/lib/gluestack-ui/text';
import { VStack } from '@/lib/gluestack-ui/vstack';

type EmptyStateProps = {
  title: string;
  message?: string;
  action?: ReactNode;
};

export function EmptyState({ title, message, action }: EmptyStateProps) {
  return (
    <VStack className="items-center gap-2 px-6 py-16">
      <Text className="text-center text-lg font-semibold text-foreground">{title}</Text>
      {message ? <Text className="text-center text-sm text-muted-foreground">{message}</Text> : null}
      {action}
    </VStack>
  );
}
