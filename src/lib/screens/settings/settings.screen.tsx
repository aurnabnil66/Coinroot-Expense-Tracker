import Constants from 'expo-constants';
import { router } from 'expo-router';

import { CATEGORY_KIND_LABELS } from '@/lib/constants';
import { Text } from '@/lib/gluestack-ui/text';
import { useLedger } from '@/lib/hooks';
import { Card, ListRow, ScreenContainer, ScreenHeader, SectionHeader } from '@/lib/ui';

export function SettingsScreen() {
  const { categories } = useLedger();
  const count = (kind: 'expense' | 'income_source') =>
    String(categories.filter((c) => c.kind === kind && !c.archived).length);

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

      <SectionHeader title="Appearance" />
      <Card>
        <ListRow title="Theme" trailing="Device default" />
      </Card>

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
