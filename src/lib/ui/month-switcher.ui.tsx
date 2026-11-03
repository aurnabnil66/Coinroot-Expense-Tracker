import { HStack } from '@/lib/gluestack-ui/hstack';
import { ChevronLeftIcon, ChevronRightIcon } from '@/lib/gluestack-ui/icon';
import { Text } from '@/lib/gluestack-ui/text';

import { IconButton } from './icon-button.ui';

type MonthSwitcherProps = {
  label: string;
  onPrevious: () => void;
  onNext: () => void;
};

export function MonthSwitcher({ label, onPrevious, onNext }: MonthSwitcherProps) {
  return (
    <HStack className="items-center justify-between rounded-full border border-border/70 bg-card p-1">
      <IconButton icon={ChevronLeftIcon} onPress={onPrevious} accessibilityLabel="Previous month" />
      <Text className="text-base font-semibold text-foreground">{label}</Text>
      <IconButton icon={ChevronRightIcon} onPress={onNext} accessibilityLabel="Next month" />
    </HStack>
  );
}
