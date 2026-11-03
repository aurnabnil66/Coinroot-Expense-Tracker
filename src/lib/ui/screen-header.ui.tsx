import type { ReactNode } from 'react';

import { Box } from '@/lib/gluestack-ui/box';
import { HStack } from '@/lib/gluestack-ui/hstack';
import { Text } from '@/lib/gluestack-ui/text';

type ScreenHeaderProps = {
  title: string;
  subtitle?: string;
  right?: ReactNode;
};

/** Large title at the top of a tab screen. */
export function ScreenHeader({ title, subtitle, right }: ScreenHeaderProps) {
  return (
    <HStack className="items-end justify-between gap-3 pb-4 pt-2">
      <Box className="flex-1">
        {subtitle ? <Text className="text-sm font-medium text-muted-foreground">{subtitle}</Text> : null}
        <Text className="text-3xl font-bold tracking-tight text-foreground">{title}</Text>
      </Box>
      {right}
    </HStack>
  );
}
