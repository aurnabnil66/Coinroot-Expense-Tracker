import Constants from 'expo-constants';
import { router } from 'expo-router';

import { CATEGORY_KIND_LABELS } from '@/lib/constants';
import { Text } from '@/lib/gluestack-ui/text';
import { RepeatIcon } from '@/lib/gluestack-ui/icon';
import {
  setSimpleMode,
  setThemePreference,
  type ThemePreference,
  useLedger,
  useSimpleMode,
  useThemePreference,
} from '@/lib/hooks';
import { ledgerStore } from '@/lib/mocks';
import {
  Card,
  ListRow,
  ScreenContainer,
  ScreenHeader,
  SectionHeader,
  SegmentedControl,
  Skeleton,
  SwitchRow,
  useDialog,
} from '@/lib/ui';

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'Device default' },
];

export function SettingsScreen() {
  const { status, categories } = useLedger();
  const themePreference = useThemePreference();
  const simpleMode = useSimpleMode();
  const dialog = useDialog();

  const startOver = () =>
    dialog.confirm({
      title: 'Start over?',
      message: 'This removes all accounts and transactions and opens first-time setup again.',
      tone: 'warning',
      icon: RepeatIcon,
      confirmLabel: 'Start over',
      onConfirm: () => ledgerStore.resetSetup(),
    });
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

      <SectionHeader title="Display" />
      <SwitchRow
        label="Simple mode"
        description="Big quick-add buttons for your usual entries, and fewer fields when adding."
        value={simpleMode}
        onValueChange={setSimpleMode}
      />

      <SectionHeader title="Data" />
      <Card>
        <ListRow title="Import from spreadsheet" trailing="Soon" />
        <ListRow divider title="Backup & export" trailing="Soon" />
        <ListRow divider title="Set up accounts again" subtitle="Start over with first-time setup" onPress={() => void startOver()} />
      </Card>
      <Text className="px-1 pt-2 text-xs text-muted-foreground">
        Prototype: everything is kept in memory for now and resets when the app restarts.
      </Text>

      <SectionHeader title="About" />
      <Card>
        <ListRow title="Coinroot" trailing={`Version ${Constants.expoConfig?.version ?? '–'}`} />
      </Card>
    </ScreenContainer>
  );
}
