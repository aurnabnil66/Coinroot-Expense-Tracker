import { Tabs, TabList, TabTrigger, TabSlot, TabTriggerSlotProps, TabListProps } from 'expo-router/ui';
import { type PressableProps, View } from 'react-native';

import { MaxContentWidth } from '@/lib/constants';
import { HStack } from '@/lib/gluestack-ui/hstack';
import { Pressable } from '@/lib/gluestack-ui/pressable';
import { Text } from '@/lib/gluestack-ui/text';

const TABS = [
  { name: 'index', href: '/', label: 'Transactions' },
  { name: 'accounts', href: '/accounts', label: 'Accounts' },
  { name: 'summary', href: '/summary', label: 'Summary' },
  { name: 'settings', href: '/settings', label: 'Settings' },
] as const;

export default function AppTabs() {
  return (
    <Tabs>
      <TabSlot style={{ height: '100%' }} />
      <TabList asChild>
        <CustomTabList>
          {TABS.map((tab) => (
            <TabTrigger key={tab.name} name={tab.name} href={tab.href} asChild>
              <TabButton>{tab.label}</TabButton>
            </TabTrigger>
          ))}
        </CustomTabList>
      </TabList>
    </Tabs>
  );
}

export function TabButton({ children, isFocused, ...props }: TabTriggerSlotProps) {
  return (
    // TabTriggerSlotProps types `ref` for a function component, not the Pressable it lands on.
    <Pressable
      {...(props as PressableProps)}
      className={`rounded-full px-4 py-1.5 data-[active=true]:opacity-70 ${isFocused ? 'bg-primary' : ''}`}>
      <Text className={`text-sm font-medium ${isFocused ? 'text-primary-foreground' : 'text-muted-foreground'}`}>
        {children}
      </Text>
    </Pressable>
  );
}

export function CustomTabList(props: TabListProps) {
  return (
    <View {...props} className="absolute bottom-0 w-full flex-row justify-center p-4">
      <HStack
        className="flex-1 items-center gap-1 rounded-full border border-border bg-card p-1.5"
        style={{ maxWidth: MaxContentWidth }}>
        <Text className="mr-auto px-3 text-sm font-bold text-foreground">Coinroot</Text>
        {props.children}
      </HStack>
    </View>
  );
}
