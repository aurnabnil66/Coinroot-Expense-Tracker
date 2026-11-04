import type { ReactNode } from 'react';

import { Box } from '@/lib/gluestack-ui/box';
import { HStack } from '@/lib/gluestack-ui/hstack';
import { ChevronRightIcon, Icon } from '@/lib/gluestack-ui/icon';
import { Pressable } from '@/lib/gluestack-ui/pressable';
import { Text } from '@/lib/gluestack-ui/text';
import { useRipple } from '@/lib/hooks';

type ListRowProps = {
  title: string;
  subtitle?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  onPress?: () => void;
  /** Show a chevron (defaults to true when the row is pressable). */
  chevron?: boolean;
  /** Draw a divider above the row (all rows except the first in a card). */
  divider?: boolean;
  muted?: boolean;
};

/** A tappable row inside a Card: leading badge, title + subtitle, trailing value. */
export function ListRow({ title, subtitle, leading, trailing, onPress, chevron, divider, muted }: ListRowProps) {
  const showChevron = chevron ?? Boolean(onPress);
  const ripple = useRipple();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      android_ripple={onPress ? ripple : undefined}
      className="data-[active=true]:bg-accent"
      accessibilityRole={onPress ? 'button' : undefined}>
      <HStack className={`min-h-14 items-center gap-3 px-4 py-3 ${divider ? 'border-t border-border/70' : ''}`}>
        {leading}
        <Box className="flex-1">
          <Text numberOfLines={1} className={`text-base font-medium ${muted ? 'text-muted-foreground' : 'text-foreground'}`}>
            {title}
          </Text>
          {subtitle ? (
            <Text numberOfLines={1} className="text-sm text-muted-foreground">
              {subtitle}
            </Text>
          ) : null}
        </Box>
        {typeof trailing === 'string' ? <Text className="text-sm text-muted-foreground">{trailing}</Text> : trailing}
        {showChevron ? <Icon as={ChevronRightIcon} size="sm" className="text-muted-foreground" /> : null}
      </HStack>
    </Pressable>
  );
}
