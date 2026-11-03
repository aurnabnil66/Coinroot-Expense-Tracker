import { router } from 'expo-router';
import { useMemo } from 'react';

import { ACCOUNT_TYPE_COLORS, ACCOUNT_TYPE_SECTIONS, CATEGORY_COLORS } from '@/lib/constants';
import { AddIcon } from '@/lib/gluestack-ui/icon';
import { Text } from '@/lib/gluestack-ui/text';
import { VStack } from '@/lib/gluestack-ui/vstack';
import { useLedger } from '@/lib/hooks';
import type { Account } from '@/lib/types';
import {
  AmountText,
  Card,
  EmptyState,
  IconButton,
  InitialBadge,
  ListRow,
  ScreenContainer,
  ScreenHeader,
  SectionHeader,
} from '@/lib/ui';
import { accountBalances, formatFullDate, formatTaka } from '@/lib/utils';

export function AccountsScreen() {
  const { accounts, transactions } = useLedger();
  const balances = useMemo(() => accountBalances(accounts, transactions), [accounts, transactions]);

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
            leading={<InitialBadge label={account.name} color={CATEGORY_COLORS[ACCOUNT_TYPE_COLORS[account.type]]} />}
            title={account.name}
            subtitle={`Since ${formatFullDate(account.openingDate)}`}
            trailing={<AmountText amount={balance} tone={balance < 0 ? 'expense' : 'default'} className="text-base" />}
            onPress={() => router.push({ pathname: '/account/[id]', params: { id: account.id } })}
          />
        );
      })}
    </Card>
  );

  return (
    <ScreenContainer safeTop tabBar>
      <ScreenHeader
        title="Accounts"
        right={<IconButton icon={AddIcon} onPress={() => router.push('/account-form')} accessibilityLabel="Add account" />}
      />

      <Card className="gap-1 p-5">
        <Text className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Total money</Text>
        <AmountText amount={total} className="text-4xl font-bold" />
        <Text className="text-sm text-muted-foreground">
          Across {active.length} {active.length === 1 ? 'account' : 'accounts'}
          {inSavings > 0 ? ` · ${formatTaka(inSavings)} in savings` : ''}
        </Text>
      </Card>

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
