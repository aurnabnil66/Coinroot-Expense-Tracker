import type { ComponentProps } from 'react';

import { Box } from '@/lib/gluestack-ui/box';
import { Icon } from '@/lib/gluestack-ui/icon';
import { Pressable } from '@/lib/gluestack-ui/pressable';
import { useRipple } from '@/lib/hooks';

type IconButtonProps = {
  icon: ComponentProps<typeof Icon>['as'];
  onPress: () => void;
  accessibilityLabel: string;
  variant?: 'ghost' | 'filled' | 'primary';
};

const variantClass = {
  ghost: '',
  filled: 'bg-secondary',
  primary: 'bg-primary',
};

export function IconButton({ icon, onPress, accessibilityLabel, variant = 'filled' }: IconButtonProps) {
  const ripple = useRipple();
  return (
    // Android draws the ripple over the whole rectangle, so a round parent clips it.
    <Box className="overflow-hidden rounded-full">
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        hitSlop={8}
        android_ripple={ripple}
        className={`h-10 w-10 items-center justify-center overflow-hidden rounded-full data-[active=true]:opacity-70 ${variantClass[variant]}`}>
        <Icon
          as={icon}
          size="lg"
          className={variant === 'primary' ? 'text-primary-foreground' : variant === 'filled' ? 'text-secondary-foreground' : 'text-foreground'}
        />
      </Pressable>
    </Box>
  );
}
