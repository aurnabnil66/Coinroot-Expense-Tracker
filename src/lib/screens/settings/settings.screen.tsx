import Constants from 'expo-constants';
import { router } from 'expo-router';
import { ActivityIndicator } from 'react-native';

import { useBackupActions } from '@/lib/components';
import { CATEGORY_KIND_LABELS } from '@/lib/constants';
import { Box } from '@/lib/gluestack-ui/box';
import { useGluestackColors } from '@/lib/gluestack-ui/gluestack-ui-provider';
import { HStack } from '@/lib/gluestack-ui/hstack';
import { DownloadIcon, EditIcon, LogOutIcon, RepeatIcon, UserIcon } from '@/lib/gluestack-ui/icon';
import { Text } from '@/lib/gluestack-ui/text';
import { VStack } from '@/lib/gluestack-ui/vstack';
import {
  setSimpleMode,
  setThemePreference,
  type ThemePreference,
  useAuth,
  useLastBackupAt,
  useLedger,
  useProfile,
  useSimpleMode,
  useThemePreference,
} from '@/lib/hooks';
import { ledgerStore } from '@/lib/db';
import { authStore } from '@/lib/mocks';
import { formatBdPhone, formatFullDate } from '@/lib/utils';
import {
  Avatar,
  BanknoteIcon,
  Button,
  Card,
  IconBadge,
  ListRow,
  PaletteIcon,
  ScreenContainer,
  ScreenHeader,
  SectionHeader,
  SegmentedControl,
  Skeleton,
  SpreadsheetIcon,
  SwitchRow,
  TagIcon,
  UploadIcon,
  useDialog,
  ZapIcon,
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
  const backup = useBackupActions();
  const lastBackupAt = useLastBackupAt();
  const colors = useGluestackColors();
  const dialog = useDialog();
  const email = profile.email || session?.email;
  const profileSubtitle = profile.nickname
    ? [email, profile.phone ? formatBdPhone(profile.phone) : null].filter(Boolean).join(' · ') || 'Your nickname and photo'
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
        <HStack className="items-center gap-4 px-4 pt-4">
          <Avatar name={profile.nickname} photo={profile.photo} />
          <VStack className="flex-1">
            <Text numberOfLines={1} className="text-lg font-semibold text-foreground">
              {profile.nickname || 'No profile yet'}
            </Text>
            <Text numberOfLines={1} className="text-sm text-muted-foreground">
              {profileSubtitle}
            </Text>
          </VStack>
        </HStack>
        <Box className="p-4">
          <Button
            label={profile.nickname ? 'Edit profile' : 'Create profile'}
            icon={EditIcon}
            variant="outline"
            size="sm"
            onPress={() => router.push('/profile-form')}
          />
        </Box>
        {session ? null : (
          <ListRow
            divider
            leading={<IconBadge icon={UserIcon} tone="primary" />}
            title="Log in or create account"
            subtitle="Optional, for backup and sync later"
            onPress={() => router.push('/log-in')}
          />
        )}
      </Card>

      <SectionHeader title="Preferences" />
      <Card>
        <HStack className="items-center gap-3 px-4 pb-2 pt-3">
          <IconBadge icon={PaletteIcon} tone="primary" />
          <VStack className="flex-1">
            <Text className="text-base font-medium text-foreground">Theme</Text>
            <Text className="text-sm text-muted-foreground">Device default follows your phone</Text>
          </VStack>
        </HStack>
        <Box className="px-4 pb-4 pt-1">
          <SegmentedControl options={THEME_OPTIONS} value={themePreference} onChange={setThemePreference} />
        </Box>
        <SwitchRow
          inCard
          divider
          leading={<IconBadge icon={ZapIcon} tone="warning" />}
          label="Simple mode"
          description="Quick-add buttons for your usual entries, fewer fields when adding"
          value={simpleMode}
          onValueChange={setSimpleMode}
        />
      </Card>

      <SectionHeader title="Categories" />
      <Card>
        <ListRow
          leading={<IconBadge icon={TagIcon} tone="expense" />}
          title={CATEGORY_KIND_LABELS.expense.plural}
          trailing={count('expense')}
          onPress={() => router.push({ pathname: '/categories', params: { kind: 'expense' } })}
        />
        <ListRow
          divider
          leading={<IconBadge icon={BanknoteIcon} tone="income" />}
          title={CATEGORY_KIND_LABELS.income_source.plural}
          trailing={count('income_source')}
          onPress={() => router.push({ pathname: '/categories', params: { kind: 'income_source' } })}
        />
      </Card>

      <SectionHeader title="Backup & data" />
      <Card>
        <ListRow
          leading={<IconBadge icon={UploadIcon} tone="sky" />}
          title="Back up to a file"
          subtitle={lastBackupAt ? `Last backup ${formatFullDate(lastBackupAt.slice(0, 10))}` : 'Not backed up yet'}
          trailing={backup.busy === 'backup' ? <ActivityIndicator color={colors.primary} /> : undefined}
          onPress={() => void backup.backUp()}
        />
        <ListRow
          divider
          leading={<IconBadge icon={DownloadIcon} tone="transfer" />}
          title="Restore from a backup"
          subtitle="Replaces what's on this phone"
          trailing={backup.busy === 'restore' ? <ActivityIndicator color={colors.primary} /> : undefined}
          onPress={() => void backup.restore()}
        />
        <ListRow
          divider
          leading={<IconBadge icon={SpreadsheetIcon} tone="muted" />}
          title="Import from spreadsheet"
          trailing={
            <Box className="rounded-full bg-muted px-2.5 py-0.5">
              <Text className="text-xs font-medium text-muted-foreground">Soon</Text>
            </Box>
          }
        />
      </Card>
      <Text className="px-1 pt-2 text-xs text-muted-foreground">
        Everything is saved on this phone and works offline. Keep a backup somewhere safe, like Drive or email.
      </Text>

      <Card className="mt-6">
        <ListRow
          tone="danger"
          leading={<IconBadge icon={RepeatIcon} tone="danger" />}
          title="Set up accounts again"
          subtitle="Removes all accounts and transactions"
          onPress={() => void startOver()}
        />
        {session ? (
          <ListRow
            divider
            tone="danger"
            leading={<IconBadge icon={LogOutIcon} tone="danger" />}
            title="Log out"
            subtitle="Your data stays on this phone"
            onPress={() => void logOut()}
          />
        ) : null}
      </Card>

      <Text className="pt-6 text-center text-xs text-muted-foreground">
        Coinroot · Version {Constants.expoConfig?.version ?? '–'}
      </Text>
    </ScreenContainer>
  );
}
