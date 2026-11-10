import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';

import { LedgerPending, TransactionRow } from '@/lib/components';
import { ACCOUNT_TYPE_LABELS } from '@/lib/constants';
import { getAccountBalances, getAccountTransactions, getTransactionsBetween } from '@/lib/db';
import { Box } from '@/lib/gluestack-ui/box';
import { HStack } from '@/lib/gluestack-ui/hstack';
import { CheckCircleIcon } from '@/lib/gluestack-ui/icon';
import { Text } from '@/lib/gluestack-ui/text';
import { VStack } from '@/lib/gluestack-ui/vstack';
import { useLedger, useLedgerQuery } from '@/lib/hooks';
import { AmountText, Button, Card, EmptyState, ScreenContainer, SectionHeader } from '@/lib/ui';
import { daysInMonth, formatFullDate, nameLookup, todayKey, toMonthKey } from '@/lib/utils';

/** Entries shown at first and added by each "Load more". */
const PAGE_SIZE = 50;

export function AccountDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { status, error, accounts, categories } = useLedger();
  const nameOf = useMemo(() => nameLookup(accounts, categories), [accounts, categories]);
  const account = accounts.find((a) => a.id === id);
  const month = toMonthKey(todayKey());
  const [limit, setLimit] = useState(PAGE_SIZE);

  const balance = useLedgerQuery((database) => getAccountBalances(database).get(id) ?? 0, [id]) ?? 0;
  const thisMonth = useLedgerQuery(
    (database) => getTransactionsBetween(database, `${month}-01`, `${month}-${daysInMonth(month)}`, id),
    [id, month]
  );
  const history = useLedgerQuery((database) => getAccountTransactions(database, id, limit), [id, limit]);
  const related = history?.transactions ?? [];

  if (status !== 'ready') {
    return (
      <ScreenContainer>
        <Stack.Screen options={{ title: 'Account' }} />
        <LedgerPending status={status} error={error} />
      </ScreenContainer>
    );
  }

  if (!account) {
    return (
      <ScreenContainer>
        <EmptyState title="Account not found" />
      </ScreenContainer>
    );
  }

  let moneyIn = 0;
  let moneyOut = 0;
  for (const tx of thisMonth ?? []) {
    if (tx.date < account.openingDate) continue;
    if (tx.type !== 'expense' && tx.toId === account.id) moneyIn += tx.amount;
    if (tx.type !== 'income' && tx.fromId === account.id) moneyOut += tx.amount;
  }

  return (
    <ScreenContainer>
      <Stack.Screen
        options={{
          title: account.name,
          headerRight: () => (
            <Button label="Edit" variant="link" size="md" onPress={() => router.push({ pathname: '/account-form', params: { id: account.id } })} />
          ),
        }}
      />

      <VStack className="items-center gap-1 py-6">
        <Text className="text-sm font-medium text-muted-foreground">
          {ACCOUNT_TYPE_LABELS[account.type]}
          {account.archived ? ' · Archived' : ''}
        </Text>
        <AmountText amount={balance} tone={balance < 0 ? 'expense' : 'default'} weight="semibold" className="text-4xl" />
        <Text className="text-sm text-muted-foreground">
          Opening <AmountText amount={account.openingBalance} className="text-sm font-normal text-muted-foreground" /> on{' '}
          {formatFullDate(account.openingDate)}
        </Text>
        <Button
          label={account.type === 'cash' ? 'Count cash' : 'Check balance'}
          variant="outline"
          size="sm"
          icon={CheckCircleIcon}
          className="mt-4"
          onPress={() => router.push({ pathname: '/balance-check', params: { accountId: account.id } })}
        />
      </VStack>

      <Card className="flex-row">
        <Box className="flex-1 gap-1 p-4">
          <Text className="text-xs font-medium uppercase tracking-wider text-muted-foreground">In this month</Text>
          <AmountText amount={moneyIn} tone="income" className="text-lg" />
        </Box>
        <Box className="w-px bg-border" />
        <Box className="flex-1 gap-1 p-4">
          <Text className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Out this month</Text>
          <AmountText amount={moneyOut} className="text-lg" />
        </Box>
      </Card>

      <SectionHeader title="Transactions" />
      <Card>
        {related.map((tx, index) => (
          <TransactionRow
            key={tx.id}
            transaction={tx}
            nameOf={nameOf}
            showDate
            divider={index > 0}
            onPress={() => router.push({ pathname: '/transaction/[id]', params: { id: tx.id } })}
          />
        ))}
        {related.length === 0 ? (
          <HStack className="p-4">
            <Text className="text-sm text-muted-foreground">No transactions in this account yet.</Text>
          </HStack>
        ) : null}
      </Card>
      {history?.hasMore ? (
        <Button label="Load more" variant="outline" className="mt-4" onPress={() => setLimit((n) => n + PAGE_SIZE)} />
      ) : null}
    </ScreenContainer>
  );
}
