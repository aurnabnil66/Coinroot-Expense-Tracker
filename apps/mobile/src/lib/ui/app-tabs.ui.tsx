import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { TabList, type TabListProps, TabSlot, TabTrigger, type TabTriggerSlotProps, Tabs } from 'expo-router/ui';
import { useColorScheme } from 'nativewind';
import { type PressableProps, View } from 'react-native';
import Animated, { LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useGluestackColors } from '@/lib/gluestack-ui/gluestack-ui-provider';
import { HStack } from '@/lib/gluestack-ui/hstack';
import { Pressable } from '@/lib/gluestack-ui/pressable';
import { Text } from '@/lib/gluestack-ui/text';

/** Gap between the floating bar and the bottom safe area. */
const BAR_MARGIN = 12;
const ICON_SIZE = 22;

const TABS: { name: string; href: '/' | '/accounts' | '/summary' | '/settings'; label: string; icon: SymbolViewProps['name'] }[] = [
  {
    name: 'index',
    href: '/',
    label: 'Transactions',
    icon: { ios: 'list.bullet.rectangle', android: 'receipt_long', web: 'receipt_long' },
  },
  {
    name: 'accounts',
    href: '/accounts',
    label: 'Accounts',
    icon: { ios: 'building.columns', android: 'account_balance', web: 'account_balance' },
  },
  { name: 'summary', href: '/summary', label: 'Summary', icon: { ios: 'chart.pie', android: 'pie_chart', web: 'pie_chart' } },
  { name: 'settings', href: '/settings', label: 'Settings', icon: { ios: 'gearshape', android: 'settings', web: 'settings' } },
];

/**
 * Floating pill tab bar: round icon buttons on navy, the active tab expands into a
 * purple pill with its label. Screens scroll underneath (see `BottomTabInset`).
 */
export default function AppTabs() {
  return (
    <Tabs>
      <TabSlot style={{ height: '100%' }} />
      <TabList asChild>
        <TabBar>
          {TABS.map((tab) => (
            <TabTrigger key={tab.name} name={tab.name} href={tab.href} asChild>
              <TabButton label={tab.label} icon={tab.icon} />
            </TabTrigger>
          ))}
        </TabBar>
      </TabList>
    </Tabs>
  );
}

function TabBar({ children, ...props }: TabListProps) {
  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();
  const shadow = colorScheme === 'dark' ? '0 10px 30px rgba(0, 0, 0, 0.45)' : '0 8px 28px rgba(17, 24, 59, 0.14)';
  return (
    <View
      {...props}
      pointerEvents="box-none"
      className="absolute inset-x-0 items-center"
      style={{ bottom: insets.bottom + BAR_MARGIN }}>
      <HStack
        className="items-center gap-3.5 rounded-full border border-border/70 bg-tab-bar p-2.5 dark:border-white/5"
        style={{ boxShadow: shadow }}>
        {children}
      </HStack>
    </View>
  );
}

type TabButtonProps = TabTriggerSlotProps & {
  label: string;
  icon: SymbolViewProps['name'];
};

// `style` is dropped: TabTrigger's default (row, space-between) would push the icon off-centre.
function TabButton({ label, icon, isFocused, style: _triggerStyle, ...props }: TabButtonProps) {
  const colors = useGluestackColors();
  return (
    // Android draws `android_ripple` over the Pressable's whole rectangle, ignoring its own
    // rounded corners, so this parent clips the ripple to the pill shape.
    <Animated.View layout={LinearTransition.duration(220)} style={{ borderRadius: 999, overflow: 'hidden' }}>
      {/* TabTriggerSlotProps types `ref` for a function component, not the Pressable it lands on. */}
      <Pressable
        {...(props as PressableProps)}
        accessibilityRole="tab"
        accessibilityLabel={label}
        accessibilityState={{ selected: isFocused }}
        android_ripple={{ color: `${colors.primary}29` }}
        className={`h-12 flex-row items-center justify-center overflow-hidden rounded-full ${
          isFocused ? 'gap-2 bg-primary/15 pl-4 pr-5' : 'w-12 bg-tab-item'
        }`}>
        <SymbolView
          name={icon}
          size={ICON_SIZE}
          tintColor={isFocused ? colors.primary : colors.tabIcon}
          style={{ width: ICON_SIZE, height: ICON_SIZE }}
        />
        {isFocused ? (
          <Text numberOfLines={1} className="text-sm font-semibold text-primary">
            {label}
          </Text>
        ) : null}
      </Pressable>
    </Animated.View>
  );
}
