import { router } from 'expo-router';

import { LedgerPending } from '@/lib/components';
import { ACCOUNT_TYPE_COLORS, ACCOUNT_TYPE_SECTIONS } from '@/lib/constants';
import { getAccountBalances } from '@/lib/db';
import { AddIcon } from '@/lib/gluestack-ui/icon';
import { HStack } from '@/lib/gluestack-ui/hstack';
import { Text } from '@/lib/gluestack-ui/text';
import { VStack } from '@/lib/gluestack-ui/vstack';
import { useCategoryColors, useLedger, useLedgerQuery } from '@/lib/hooks';
import type { Account } from '@/lib/types';
import {
  AmountText,
  Card,
  EmptyState,
  GradientCard,
  GradientStat,
  IconButton,
  InitialBadge,
  ListRow,
  ScreenContainer,
  ScreenHeader,
  SectionHeader,
  Skeleton,
  SkeletonCard,
} from '@/lib/ui';
import { formatFullDate } from '@/lib/utils';

const NO_BALANCES: ReadonlyMap<string, number> = new Map();

export function AccountsScreen() {
  const { status, error, accounts } = useLedger();
  const balances = useLedgerQuery(getAccountBalances, []) ?? NO_BALANCES;
  const palette = useCategoryColors();

  const active = accounts.filter((a) => !a.archived).sort((a, b) => a.sortOrder - b.sortOrder);
  const archived = accounts.filter((a) => a.archived);
  const total = active.reduce((sum, a) => sum + (balances.get(a.id) ?? 0), 0);
  const inSavings = active
    .filter((a) => a.type === 'savings')
    .reduce((sum, a) => sum + (balances.get(a.id) ?? 0), 0);

  const renderAccounts = (list: Account[]) => (
    <Card>
      {list.map((account, index) => {
        const balance = balances.get(account.id) ?? 0;
        return (
          <ListRow
            key={account.id}
            divider={index > 0}
            muted={account.archived}
            leading={<InitialBadge label={account.name} color={palette[ACCOUNT_TYPE_COLORS[account.type]]} />}
            title={account.name}
            subtitle={`Since ${formatFullDate(account.openingDate)}`}
            trailing={<AmountText amount={balance} tone={balance < 0 ? 'expense' : 'default'} className="text-base" />}
            onPress={() => router.push({ pathname: '/account/[id]', params: { id: account.id } })}
          />
        );
      })}
    </Card>
  );

  const header = (
    <ScreenHeader
      title="Accounts"
      right={<IconButton icon={AddIcon} variant="primary" onPress={() => router.push('/account-form')} accessibilityLabel="Add account" />}
    />
  );

  if (status !== 'ready') {
    return (
      <ScreenContainer safeTop tabBar header={header}>
        <LedgerPending
          status={status}
          error={error}
          loading={
            <>
              <Skeleton className="h-44 rounded-xl" />
              <Skeleton className="mb-3 mt-6 h-3.5 w-28 rounded-full" />
              <SkeletonCard rows={3} />
              <Skeleton className="mb-3 mt-6 h-3.5 w-20 rounded-full" />
              <SkeletonCard rows={2} />
            </>
          }
        />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer
      safeTop
      tabBar
      header={
        <>
          {header}
          {/* Header and total stay put; only the account list scrolls. */}
          <GradientCard className="gap-4">
            <VStack className="gap-1">
              <Text className="text-sm font-medium text-white/75">Total money</Text>
              <AmountText amount={total} tone="onHero" weight="semibold" className="text-4xl" />
              <Text className="text-sm text-white/75">
                Across {active.length} {active.length === 1 ? 'account' : 'accounts'}
              </Text>
            </VStack>
            {inSavings > 0 ? (
              <HStack className="gap-3">
                <GradientStat label="Available">
                  <AmountText amount={total - inSavings} tone="onHero" className="text-lg" />
                </GradientStat>
                <GradientStat label="In savings">
                  <AmountText amount={inSavings} tone="onHero" className="text-lg" />
                </GradientStat>
              </HStack>
            ) : null}
          </GradientCard>
        </>
      }>
      {active.length === 0 ? (
        <EmptyState title="No accounts yet" message="Add your bank accounts, cash and mobile wallets." />
      ) : null}

      <VStack>
        {ACCOUNT_TYPE_SECTIONS.map(({ type, title }) => {
          const list = active.filter((a) => a.type === type);
          if (list.length === 0) return null;
          const subtotal = list.reduce((sum, a) => sum + (balances.get(a.id) ?? 0), 0);
          return (
            <VStack key={type}>
              <SectionHeader title={title} right={list.length > 1 ? <AmountText amount={subtotal} className="text-xs text-muted-foreground" /> : undefined} />
              {renderAccounts(list)}
            </VStack>
          );
        })}

        {archived.length > 0 ? (
          <VStack>
            <SectionHeader title="Archived" />
            {renderAccounts(archived)}
          </VStack>
        ) : null}
      </VStack>
    </ScreenContainer>
  );
}
