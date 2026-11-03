import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomTabInset } from '@/lib/constants';
import { AddIcon, Icon } from '@/lib/gluestack-ui/icon';
import { Pressable } from '@/lib/gluestack-ui/pressable';

type FabProps = {
  onPress: () => void;
  accessibilityLabel: string;
  /** Sit above the tab bar. */
  tabBar?: boolean;
};

export const FAB_SIZE = 56;

/** Floating round "+" button in the bottom-right corner. */
export function Fab({ onPress, accessibilityLabel, tabBar = true }: FabProps) {
  const insets = useSafeAreaInsets();
  const bottom = insets.bottom + (tabBar ? BottomTabInset : 0) + 16;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      className="absolute right-5 items-center justify-center rounded-full bg-primary shadow-lg data-[active=true]:opacity-80"
      style={{ bottom, width: FAB_SIZE, height: FAB_SIZE }}>
      <Icon as={AddIcon} size="xl" className="text-primary-foreground" />
    </Pressable>
  );
}
