import type { ReactNode } from 'react';

import { HStack } from '@/lib/gluestack-ui/hstack';
import { Text } from '@/lib/gluestack-ui/text';

type SectionHeaderProps = {
  title: string;
  right?: ReactNode;
  className?: string;
};

export function SectionHeader({ title, right, className = '' }: SectionHeaderProps) {
  return (
    <HStack className={`items-center justify-between pb-2 pt-6 ${className}`}>
      <Text className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</Text>
      {typeof right === 'string' ? <Text className="text-xs font-medium text-muted-foreground">{right}</Text> : right}
    </HStack>
  );
}
