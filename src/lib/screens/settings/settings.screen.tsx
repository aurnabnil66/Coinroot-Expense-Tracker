import Constants from 'expo-constants';
import { router } from 'expo-router';

import { CATEGORY_KIND_LABELS } from '@/lib/constants';
import { Text } from '@/lib/gluestack-ui/text';
import { setThemePreference, type ThemePreference, useLedger, useThemePreference } from '@/lib/hooks';
import { Card, ListRow, ScreenContainer, ScreenHeader, SectionHeader, SegmentedControl, Skeleton } from '@/lib/ui';

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'Device default' },
];

export function SettingsScreen() {
  const { status, categories } = useLedger();
  const themePreference = useThemePreference();
  const count = (kind: 'expense' | 'income_source') =>
    status === 'ready' ? (
      String(categories.filter((c) => c.kind === kind && !c.archived).length)
    ) : (
      <Skeleton className="h-4 w-6 rounded-full" />
    );

  return (
    <ScreenContainer safeTop tabBar>
      <ScreenHeader title="Settings" />

      <SectionHeader title="Lists" />
      <Card>
        <ListRow
          title={CATEGORY_KIND_LABELS.expense.plural}
          trailing={count('expense')}
          onPress={() => router.push({ pathname: '/categories', params: { kind: 'expense' } })}
        />
        <ListRow
          divider
          title={CATEGORY_KIND_LABELS.income_source.plural}
          trailing={count('income_source')}
          onPress={() => router.push({ pathname: '/categories', params: { kind: 'income_source' } })}
        />
      </Card>

      <SectionHeader title="Theme" />
      <SegmentedControl options={THEME_OPTIONS} value={themePreference} onChange={setThemePreference} />
      <Text className="px-1 pt-2 text-xs text-muted-foreground">
        Device default follows your phone&apos;s light or dark setting.
      </Text>

      <SectionHeader title="Data" />
      <Card>
        <ListRow title="Import from spreadsheet" trailing="Soon" />
        <ListRow divider title="Backup & export" trailing="Soon" />
      </Card>
      <Text className="px-1 pt-2 text-xs text-muted-foreground">
        Showing sample data while the app is being built. Changes reset when the app restarts.
      </Text>

      <SectionHeader title="About" />
      <Card>
        <ListRow title="Coinroot" trailing={`Version ${Constants.expoConfig?.version ?? '–'}`} />
      </Card>
    </ScreenContainer>
  );
}
