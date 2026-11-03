import { router } from 'expo-router';
import { useMemo } from 'react';
import { SectionList } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TransactionRow } from '@/lib/components';
import { BottomTabInset } from '@/lib/constants';
import { Box } from '@/lib/gluestack-ui/box';
import { HStack } from '@/lib/gluestack-ui/hstack';
import { Text } from '@/lib/gluestack-ui/text';
import { useLedger } from '@/lib/hooks';
import { AmountText, Card, EmptyState, Fab, FAB_SIZE, ScreenContainer, ScreenHeader } from '@/lib/ui';
import {
  formatDayLabel,
  formatMonthLabel,
  formatTaka,
  groupByDay,
  monthlySummary,
  nameLookup,
  remainingOf,
  todayKey,
  toMonthKey,
} from '@/lib/utils';

export function TransactionsScreen() {
  const insets = useSafeAreaInsets();
  const { accounts, categories, transactions } = useLedger();
  const nameOf = useMemo(() => nameLookup(accounts, categories), [accounts, categories]);
  const sections = useMemo(() => groupByDay(transactions), [transactions]);
  const parentIds = useMemo(() => new Set(transactions.map((tx) => tx.parentId)), [transactions]);
  const month = toMonthKey(todayKey());
  const summary = useMemo(() => monthlySummary(month, transactions, accounts), [month, transactions, accounts]);

  return (
    <ScreenContainer safeTop scroll={false}>
      <SectionList
        sections={sections}
        keyExtractor={(tx) => tx.id}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingBottom: insets.bottom + BottomTabInset + FAB_SIZE + 40,
        }}
        ListHeaderComponent={
          <>
            <ScreenHeader title="Transactions" subtitle={formatMonthLabel(month)} />
            <Card className="flex-row">
              <Box className="flex-1 gap-1 p-4">
                <Text className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Spent</Text>
                <AmountText amount={summary.expenses} className="text-xl" />
              </Box>
              <Box className="w-px bg-border" />
              <Box className="flex-1 gap-1 p-4">
                <Text className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Income</Text>
                <AmountText amount={summary.income} tone="income" className="text-xl" />
              </Box>
            </Card>
          </>
        }
        renderSectionHeader={({ section }) => (
          <HStack className="items-center justify-between pb-2 pt-6">
            <Text className="text-sm font-semibold text-foreground">{formatDayLabel(section.date)}</Text>
            {section.spent > 0 ? (
              <Text className="text-xs font-medium tabular-nums text-muted-foreground">
                Spent {formatTaka(section.spent)}
              </Text>
            ) : null}
          </HStack>
        )}
        renderItem={({ item, index, section }) => {
          const first = index === 0;
          const last = index === section.data.length - 1;
          return (
            <Box
              className={`overflow-hidden border-x border-border bg-card ${first ? 'rounded-t-2xl border-t' : ''} ${
                last ? 'rounded-b-2xl border-b' : ''
              }`}>
              <TransactionRow
                transaction={item}
                nameOf={nameOf}
                divider={!first}
                remaining={parentIds.has(item.id) ? remainingOf(item, transactions) : undefined}
                onPress={() => router.push({ pathname: '/transaction/[id]', params: { id: item.id } })}
              />
            </Box>
          );
        }}
        ListEmptyComponent={
          <EmptyState
            title="No transactions yet"
            message="Tap + to add your first income, expense or transfer."
          />
        }
      />
      <Fab onPress={() => router.push('/transaction-form')} accessibilityLabel="Add transaction" />
    </ScreenContainer>
  );
}
