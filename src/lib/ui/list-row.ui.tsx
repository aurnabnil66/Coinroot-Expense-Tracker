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
  /** Show a chevron (defaults to true when the row opens something; never on `danger` rows). */
  chevron?: boolean;
  /** Draw a divider above the row (all rows except the first in a card). */
  divider?: boolean;
  muted?: boolean;
  /** `danger`: a red title, for actions that remove data or sign out. */
  tone?: 'default' | 'danger';
};

/**
 * A row inside a Card: leading badge, title + subtitle, trailing value. Without `onPress` it's
 * information only (shown at full strength, not dimmed like a disabled button).
 */
export function ListRow({ title, subtitle, leading, trailing, onPress, chevron, divider, muted, tone = 'default' }: ListRowProps) {
  const danger = tone === 'danger';
  const showChevron = chevron ?? (Boolean(onPress) && !danger);
  const ripple = useRipple();
  const titleColor = danger ? 'text-destructive' : muted ? 'text-muted-foreground' : 'text-foreground';
  const content = (
    <HStack className={`min-h-14 items-center gap-3 px-4 py-3 ${divider ? 'border-t border-border/70' : ''}`}>
      {leading}
      <Box className="flex-1">
        <Text numberOfLines={1} className={`text-base font-medium ${titleColor}`}>
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
  );
  if (!onPress) return content;
  return (
    <Pressable onPress={onPress} android_ripple={ripple} className="data-[active=true]:bg-accent" accessibilityRole="button">
      {content}
    </Pressable>
  );
}
