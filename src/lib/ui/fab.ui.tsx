import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomTabInset } from '@/lib/constants';
import { Box } from '@/lib/gluestack-ui/box';
import { useGluestackColors } from '@/lib/gluestack-ui/gluestack-ui-provider';
import { AddIcon, Icon } from '@/lib/gluestack-ui/icon';
import { Pressable } from '@/lib/gluestack-ui/pressable';

type FabProps = {
  onPress: () => void;
  /** Read by screen readers, e.g. "Add transaction". */
  label: string;
  /** Sit above the tab bar. */
  tabBar?: boolean;
};

export const FAB_SIZE = 56;

/** Round "+" floating action button in the bottom-right corner. */
export function Fab({ onPress, label, tabBar = true }: FabProps) {
  const insets = useSafeAreaInsets();
  const colors = useGluestackColors();
  const bottom = insets.bottom + (tabBar ? BottomTabInset : 0) + 16;
  return (
    // Native elevation casts a round shadow from the rounded, filled outer view. (A CSS boxShadow
    // came out square on Android.) It also clips the ripple, which Android draws as a rectangle.
    <Box
      className="absolute right-5 overflow-hidden rounded-full bg-primary"
      style={{ bottom, width: FAB_SIZE, height: FAB_SIZE, elevation: 8, shadowColor: colors.heroEnd }}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
        android_ripple={{ color: '#ffffff33' }}
        className="h-full w-full items-center justify-center overflow-hidden rounded-full data-[active=true]:opacity-90"
        style={{
          experimental_backgroundImage: `linear-gradient(135deg, ${colors.heroEnd} 0%, ${colors.primary} 100%)`,
        }}>
        <Icon as={AddIcon} size="xl" className="text-white" />
      </Pressable>
    </Box>
  );
}
