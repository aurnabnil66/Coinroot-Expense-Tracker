import { NativeTabs } from 'expo-router/native-tabs';

import { useGluestackColors } from '@/lib/gluestack-ui/gluestack-ui-provider';

export default function AppTabs() {
  // The native tab bar takes colour props, not className.
  const colors = useGluestackColors();

  return (
    <NativeTabs
      backgroundColor={colors.background}
      indicatorColor={colors.secondary}
      iconColor={{ default: colors.mutedForeground, selected: colors.primary }}
      labelStyle={{ default: { color: colors.mutedForeground }, selected: { color: colors.primary } }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Transactions</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="list.bullet.rectangle" md="receipt_long" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="accounts">
        <NativeTabs.Trigger.Label>Accounts</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="building.columns" md="account_balance" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="summary">
        <NativeTabs.Trigger.Label>Summary</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="chart.pie" md="pie_chart" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="settings">
        <NativeTabs.Trigger.Label>Settings</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="gearshape" md="settings" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
