import type { ComponentProps } from 'react';

import { Icon } from '@/lib/gluestack-ui/icon';
import { Pressable } from '@/lib/gluestack-ui/pressable';

type IconButtonProps = {
  icon: ComponentProps<typeof Icon>['as'];
  onPress: () => void;
  accessibilityLabel: string;
  variant?: 'ghost' | 'filled';
};

export function IconButton({ icon, onPress, accessibilityLabel, variant = 'filled' }: IconButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={8}
      className={`h-10 w-10 items-center justify-center rounded-full data-[active=true]:opacity-60 ${
        variant === 'filled' ? 'bg-secondary' : ''
      }`}>
      <Icon as={icon} size="lg" className="text-foreground" />
    </Pressable>
  );
}
