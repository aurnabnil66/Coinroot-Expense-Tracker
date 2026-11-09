import Constants from 'expo-constants';
import { router } from 'expo-router';

import { CATEGORY_KIND_LABELS } from '@/lib/constants';
import { Text } from '@/lib/gluestack-ui/text';
import { VStack } from '@/lib/gluestack-ui/vstack';
import { LogOutIcon, RepeatIcon } from '@/lib/gluestack-ui/icon';
import {
  setSimpleMode,
  setThemePreference,
  type ThemePreference,
  useAuth,
  useLedger,
  useProfile,
  useSimpleMode,
  useThemePreference,
} from '@/lib/hooks';
import { authStore, ledgerStore } from '@/lib/mocks';
import { formatBdPhone } from '@/lib/utils';
import {
  Avatar,
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
  const profile = useProfile();
  const session = useAuth();
  const dialog = useDialog();
  const profileSubtitle = profile.nickname
    ? [profile.email, profile.phone ? formatBdPhone(profile.phone) : null].filter(Boolean).join(' · ') || 'Edit your profile'
    : 'Add a nickname and a photo';

  const logOut = () =>
    dialog.confirm({
      title: 'Log out?',
      message: 'Your data stays on this phone. You can log in again any time.',
      tone: 'warning',
      icon: LogOutIcon,
      confirmLabel: 'Log out',
      onConfirm: () => authStore.signOut(),
    });

  const startOver = () =>
    dialog.confirm({
      title: 'Start over?',
      message: 'This removes all accounts and transactions and opens first-time setup again. Your profile is kept.',
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

      <Card>
        <ListRow
          leading={<Avatar name={profile.nickname} photo={profile.photo} />}
          title={profile.nickname || 'Create your profile'}
          subtitle={profileSubtitle}
          onPress={() => router.push('/profile-form')}
        />
      </Card>

      <SectionHeader title="Account" />
      <Card>
        {session ? (
          <>
            {/* Information only: a ListRow without onPress would look disabled. */}
            <VStack className="min-h-14 justify-center px-4 py-3">
              <Text className="text-sm text-muted-foreground">Signed in as</Text>
              <Text numberOfLines={1} className="text-base font-medium text-foreground">
                {session.email}
              </Text>
            </VStack>
            <ListRow divider title="Log out" onPress={() => void logOut()} />
          </>
        ) : (
          <ListRow
            title="Log in or create account"
            subtitle="Optional: for backup and sync later"
            onPress={() => router.push('/log-in')}
          />
        )}
      </Card>

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
