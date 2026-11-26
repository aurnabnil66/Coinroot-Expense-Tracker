import { router } from "expo-router";
import { ActivityIndicator } from "react-native";

import { useBackupActions } from "@/lib/components";
import { CATEGORY_KIND_LABELS } from "@/lib/constants";
import { Box } from "@/lib/gluestack-ui/box";
import { useGluestackColors } from "@/lib/gluestack-ui/gluestack-ui-provider";
import { HStack } from "@/lib/gluestack-ui/hstack";
import {
  BellIcon,
  DownloadIcon,
  EditIcon,
  LogOutIcon,
  RepeatIcon,
  UserIcon,
} from "@/lib/gluestack-ui/icon";
import { Text } from "@/lib/gluestack-ui/text";
import { VStack } from "@/lib/gluestack-ui/vstack";
import {
  setSimpleMode,
  setThemePreference,
  type ThemePreference,
  useAppUpdate,
  useAuth,
  useLastBackupAt,
  useLedger,
  useProfile,
  useSimpleMode,
  useSyncStatus,
  useThemePreference,
} from "@/lib/hooks";
import { ledgerStore, type SyncSkip } from "@/lib/db";
import { authStore, type SyncSnapshot, syncStore } from "@/lib/supabase";
import {
  appVersion,
  isUpdateCheckSupported,
  runningUpdate,
  UpdateCheckError,
  type UpdateSnapshot,
  updateStore,
} from "@/lib/updates";
import {
  formatBdPhone,
  formatFullDate,
  formatSyncedAt,
  formatTaka,
  isDateKey,
  toDateKey,
} from "@/lib/utils";
import {
  Avatar,
  BanknoteIcon,
  Button,
  Card,
  CloudIcon,
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
} from "@/lib/ui";

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "Device" },
];

const SKIP_TABLE_LABELS: Record<SyncSkip["table"], string> = {
  transactions: "Entry",
  accounts: "Account",
  categories: "Category",
};
/** Left-out rows listed in the dialog; the rest are counted. */
const MAX_SKIPS_LISTED = 8;

/** One left-out cloud row, e.g. "Entry · 5 Nov 2026 · ৳5,000 · ATM: a transfer to the same account". */
function describeSkip(skip: SyncSkip): string {
  const { date, amount, name, note } = skip.details;
  const what = [
    SKIP_TABLE_LABELS[skip.table],
    name,
    date && isDateKey(date) ? formatFullDate(date) : date,
    amount !== null ? formatTaka(amount) : null,
    note,
  ]
    .filter(Boolean)
    .join(" · ");
  return `${what}: ${skip.reason}`;
}

/** The Cloud sync row's second line. */
function syncSubtitle(sync: SyncSnapshot): string {
  switch (sync.status) {
    case "syncing":
      return "Syncing…";
    case "error":
      return `Couldn't sync. ${sync.error ?? ""} Tap to try again.`.replace(/\s+/g, " ");
    case "blocked":
      return "Paused: this phone has another account's records";
    case "off":
      return sync.offReason === "sample"
        ? "Off while exploring sample data"
        : "Off";
    default: {
      if (!sync.lastSyncedAt) return "Not synced yet";
      const waiting = sync.pending > 0 ? ` · ${sync.pending} waiting` : "";
      const skipped =
        sync.skipped.length > 0
          ? ` · ${sync.skipped.length} from the cloud left out`
          : "";
      return `Synced ${formatSyncedAt(sync.lastSyncedAt)}${waiting}${skipped}`;
    }
  }
}

/** The App updates row's second line. */
function updateSubtitle(update: UpdateSnapshot): string {
  if (update.status === "checking") return "Checking…";
  if (update.available) return `Version ${update.available.version} is out. Tap to download`;
  if (update.status === "error") return `Couldn't check. ${update.error ?? ""}`.trim();
  if (update.lastCheckedAt) return `Up to date · checked ${formatSyncedAt(update.lastCheckedAt)}`;
  return "Tap to check now";
}

/** The footer: the APK's version, plus the OTA update it runs (if any), e.g. "update of 26 Nov 2026 (1a2b3c4d)". */
function versionLabel(): string {
  const update = runningUpdate();
  const ota = update
    ? ` · update of ${formatFullDate(toDateKey(update.createdAt))} (${update.id.slice(0, 8)})`
    : "";
  return `Coinroot · Version ${appVersion || "–"}${ota}`;
}

export function SettingsScreen() {
  const { status, categories } = useLedger();
  const themePreference = useThemePreference();
  const simpleMode = useSimpleMode();
  const profile = useProfile();
  const session = useAuth();
  const sync = useSyncStatus();
  const update = useAppUpdate();
  const backup = useBackupActions();
  const lastBackupAt = useLastBackupAt();
  const colors = useGluestackColors();
  const dialog = useDialog();
  const email = session?.email || profile.email;
  const profileSubtitle = profile.nickname
    ? [email, profile.phone ? formatBdPhone(profile.phone) : null]
        .filter(Boolean)
        .join(" · ") || "Your nickname and photo"
    : "Add a nickname and a photo";

  const logOut = () =>
    dialog.confirm({
      title: "Log out?",
      message: "Your profile (nickname, email, phone, photo) is removed from this phone. Your accounts and transactions stay. You can log in again any time.",
      tone: "warning",
      icon: LogOutIcon,
      confirmLabel: "Log out",
      onConfirm: async () => {
        // Upload the latest changes first (waits a few seconds at most).
        await syncStore.syncWithin(10_000);
        await authStore.signOut();
      },
    });

  const syncPressed = () => {
    if (sync.status === "blocked") {
      return dialog.alert({
        title: "Sync is paused",
        message:
          "This phone still has the records of the account that synced here before. To sync this account, back them up if you need them, then use Set up accounts again. Or log out and log in with the other account.",
        tone: "warning",
      });
    }
    if (sync.status === "off" && sync.offReason === "sample") {
      return dialog.alert({
        title: "Sync is off",
        message:
          "Sample data never goes to the cloud. Sync starts once you set up your own accounts (Set up accounts again).",
        tone: "info",
      });
    }
    if (sync.status === "idle" && sync.skipped.length > 0) {
      const listed = sync.skipped.slice(0, MAX_SKIPS_LISTED).map(describeSkip);
      const more = sync.skipped.length - listed.length;
      return dialog
        .show({
          title: "Some entries are left out",
          message: [
            "These are in your cloud account, but this phone can't store them, so they're missing here. Coinroot tries them again on every sync, and they arrive once they're fixed (for example by editing them on the phone that made them).",
            ...listed,
            ...(more > 0 ? [`…and ${more} more.`] : []),
          ].join("\n\n"),
          tone: "warning",
          actions: [
            { label: "OK", value: "ok", variant: "secondary" },
            { label: "Sync now", value: "sync", variant: "primary" },
          ],
        })
        .then((choice) => (choice === "sync" ? syncStore.syncNow() : undefined));
    }
    return syncStore.syncNow();
  };

  const offerUpdate = (version: string) => {
    const release = updateStore.getSnapshot().available;
    if (!release || release.version !== version) return;
    return dialog
      .show({
        title: `Coinroot ${release.version} is available`,
        message:
          "Download it and open the file to install it over this version. Your accounts and entries stay. The first time, Android asks you to allow installs from your browser.",
        tone: "info",
        icon: DownloadIcon,
        actions: [
          { label: "What's new", value: "notes", variant: "secondary" },
          { label: "Download", value: "download", variant: "primary" },
        ],
      })
      .then((choice) => {
        if (choice === "download") return updateStore.download(release);
        if (choice === "notes") return updateStore.openNotes(release);
      });
  };

  const updatePressed = async () => {
    if (update.status === "checking") return;
    if (update.available) return offerUpdate(update.available.version);
    try {
      const newer = await updateStore.checkNow();
      if (newer) return offerUpdate(newer.version);
      return dialog.alert({
        title: "You're up to date",
        message: `Version ${appVersion} is the newest. Small fixes arrive by themselves when you open the app.`,
        tone: "success",
      });
    } catch (cause) {
      return dialog.alert({
        title: "Couldn't check for updates",
        message:
          cause instanceof UpdateCheckError
            ? cause.message
            : "Something went wrong. Try again later.",
        tone: "warning",
      });
    }
  };

  const startOver = () =>
    dialog.confirm({
      title: "Start over?",
      message: session
        ? "This removes all accounts and transactions, here and from your cloud account (so from every phone that syncs with it), and opens first-time setup again. Your profile is kept."
        : "This removes all accounts and transactions and opens first-time setup again. Your profile is kept.",
      tone: "warning",
      icon: RepeatIcon,
      confirmLabel: "Start over",
      onConfirm: () => ledgerStore.resetSetup(),
    });
  const count = (kind: "expense" | "income_source") =>
    status === "ready" ? (
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
            <Text
              numberOfLines={1}
              className="text-lg font-semibold text-foreground"
            >
              {profile.nickname || "No profile yet"}
            </Text>
            <Text numberOfLines={1} className="text-sm text-muted-foreground">
              {profileSubtitle}
            </Text>
          </VStack>
        </HStack>
        <Box className="p-4">
          <Button
            label={profile.nickname ? "Edit profile" : "Create profile"}
            icon={EditIcon}
            variant="outline"
            size="sm"
            onPress={() => router.push("/profile-form")}
          />
        </Box>
        {session ? null : (
          <ListRow
            divider
            leading={<IconBadge icon={UserIcon} tone="primary" />}
            title="Log in or create account"
            subtitle="Optional, for backup and sync later"
            onPress={() => router.push("/log-in")}
          />
        )}
      </Card>

      <SectionHeader title="Preferences" />
      <Card>
        <HStack className="items-center gap-3 px-4 pb-2 pt-3">
          <IconBadge icon={PaletteIcon} tone="primary" />
          <VStack className="flex-1">
            <Text className="text-base font-medium text-foreground">Theme</Text>
            <Text className="text-sm text-muted-foreground">
              Device follows your phone’s theme
            </Text>
          </VStack>
        </HStack>
        <Box className="px-4 pb-4 pt-1">
          <SegmentedControl
            options={THEME_OPTIONS}
            value={themePreference}
            onChange={setThemePreference}
          />
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
          trailing={count("expense")}
          onPress={() =>
            router.push({
              pathname: "/categories",
              params: { kind: "expense" },
            })
          }
        />
        <ListRow
          divider
          leading={<IconBadge icon={BanknoteIcon} tone="income" />}
          title={CATEGORY_KIND_LABELS.income_source.plural}
          trailing={count("income_source")}
          onPress={() =>
            router.push({
              pathname: "/categories",
              params: { kind: "income_source" },
            })
          }
        />
      </Card>

      <SectionHeader title="Backup & data" />
      <Card>
        {session ? (
          <ListRow
            leading={<IconBadge icon={CloudIcon} tone="primary" />}
            title="Cloud sync"
            subtitle={syncSubtitle(sync)}
            trailing={
              sync.status === "syncing" ? (
                <ActivityIndicator color={colors.primary} />
              ) : undefined
            }
            onPress={() => void syncPressed()}
          />
        ) : null}
        <ListRow
          divider={Boolean(session)}
          leading={<IconBadge icon={UploadIcon} tone="sky" />}
          title="Back up to a file"
          subtitle={
            lastBackupAt
              ? `Last backup ${formatFullDate(lastBackupAt.slice(0, 10))}`
              : "Not backed up yet"
          }
          trailing={
            backup.busy === "backup" ? (
              <ActivityIndicator color={colors.primary} />
            ) : undefined
          }
          onPress={() => void backup.backUp()}
        />
        <ListRow
          divider
          leading={<IconBadge icon={DownloadIcon} tone="transfer" />}
          title="Restore from a backup"
          subtitle="Replaces what's on this phone"
          trailing={
            backup.busy === "restore" ? (
              <ActivityIndicator color={colors.primary} />
            ) : undefined
          }
          onPress={() => void backup.restore()}
        />
        <ListRow
          divider
          leading={<IconBadge icon={SpreadsheetIcon} tone="income" />}
          title="Import from spreadsheet"
          subtitle="CSV, or a table copied from Excel or Word"
          onPress={() => router.push("/import")}
        />
        <ListRow
          divider
          leading={<IconBadge icon={SpreadsheetIcon} tone="primary" />}
          title="Export to spreadsheet"
          subtitle="All transactions as a CSV file"
          trailing={
            backup.busy === "export" ? (
              <ActivityIndicator color={colors.primary} />
            ) : undefined
          }
          onPress={() => void backup.exportCsv()}
        />
      </Card>
      <Text className="px-1 pt-2 text-xs text-muted-foreground">
        Everything is saved on this phone and works offline. Keep a backup
        somewhere safe, like Drive or email.
      </Text>

      {isUpdateCheckSupported ? (
        <>
          <SectionHeader title="App updates" />
          <Card>
            <ListRow
              leading={<IconBadge icon={DownloadIcon} tone="sky" />}
              title="Check for updates"
              subtitle={updateSubtitle(update)}
              trailing={
                update.status === "checking" ? (
                  <ActivityIndicator color={colors.primary} />
                ) : undefined
              }
              onPress={() => void updatePressed()}
            />
            <SwitchRow
              inCard
              divider
              leading={<IconBadge icon={BellIcon} tone="primary" />}
              label="Check automatically"
              description="Once a day, asks GitHub whether a new version is out. No data from the app is sent."
              value={update.autoCheck}
              onValueChange={updateStore.setAutoCheck}
            />
          </Card>
        </>
      ) : null}

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
            subtitle="Removes your profile from this phone"
            onPress={() => void logOut()}
          />
        ) : null}
      </Card>

      <Text className="pt-6 text-center text-xs text-muted-foreground">
        {versionLabel()}
      </Text>
    </ScreenContainer>
  );
}
