import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomTabInset } from '@/lib/constants';
import { useGluestackColors } from '@/lib/gluestack-ui/gluestack-ui-provider';
import { AddIcon, Icon } from '@/lib/gluestack-ui/icon';
import { Pressable } from '@/lib/gluestack-ui/pressable';
import { Text } from '@/lib/gluestack-ui/text';

type FabProps = {
  onPress: () => void;
  label: string;
  /** Sit above the tab bar. */
  tabBar?: boolean;
};

export const FAB_SIZE = 56;

/** Material 3 style extended floating action button ("+ Add") in the bottom-right corner. */
export function Fab({ onPress, label, tabBar = true }: FabProps) {
  const insets = useSafeAreaInsets();
  const colors = useGluestackColors();
  const bottom = insets.bottom + (tabBar ? BottomTabInset : 0) + 16;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      android_ripple={{ color: '#ffffff33' }}
      className="absolute right-5 flex-row items-center gap-2 overflow-hidden rounded-2xl px-5 data-[active=true]:opacity-90"
      style={{
        bottom,
        height: FAB_SIZE,
        experimental_backgroundImage: `linear-gradient(135deg, ${colors.heroEnd} 0%, ${colors.primary} 100%)`,
        boxShadow: `0 8px 20px ${colors.heroEnd}55`,
      }}>
      <Icon as={AddIcon} size="lg" className="text-white" />
      <Text className="text-base font-semibold text-white">{label}</Text>
    </Pressable>
  );
}
