import type { ReactNode } from 'react';
import { Switch } from 'react-native';

import { useGluestackColors } from '@/lib/gluestack-ui/gluestack-ui-provider';
import { Box } from '@/lib/gluestack-ui/box';
import { HStack } from '@/lib/gluestack-ui/hstack';
import { Pressable } from '@/lib/gluestack-ui/pressable';
import { Text } from '@/lib/gluestack-ui/text';
import { useRipple } from '@/lib/hooks';

type SwitchRowProps = {
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  /** A badge before the label (settings rows). */
  leading?: ReactNode;
  /** A row inside a `Card` (no own border; `divider` draws one above) instead of a boxed field. */
  inCard?: boolean;
  divider?: boolean;
};

/** A label with a switch; tapping anywhere on the row flips it. */
export function SwitchRow({ label, description, value, onValueChange, leading, inCard, divider }: SwitchRowProps) {
  const colors = useGluestackColors();
  const ripple = useRipple();
  const shape = inCard
    ? `min-h-14 px-4 py-3 ${divider ? 'border-t border-border/70' : ''}`
    : 'rounded-2xl border border-border bg-card px-4 py-3.5';
  return (
    <Pressable
      onPress={() => onValueChange(!value)}
      android_ripple={inCard ? ripple : undefined}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      className={inCard ? 'data-[active=true]:bg-accent' : undefined}>
      <HStack className={`items-center gap-3 ${shape}`}>
        {leading}
        <Box className="flex-1">
          <Text className="text-base font-medium text-foreground">{label}</Text>
          {description ? <Text className="text-sm text-muted-foreground">{description}</Text> : null}
        </Box>
        <Switch value={value} onValueChange={onValueChange} trackColor={{ true: colors.primary }} />
      </HStack>
    </Pressable>
  );
}
