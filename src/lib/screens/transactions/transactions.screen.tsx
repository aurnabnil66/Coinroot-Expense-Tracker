import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { SectionList } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TransactionRow } from '@/lib/components';
import { BottomTabInset } from '@/lib/constants';
import { Box } from '@/lib/gluestack-ui/box';
import { Button, ButtonText } from '@/lib/gluestack-ui/button';
import { HStack } from '@/lib/gluestack-ui/hstack';
import { Text } from '@/lib/gluestack-ui/text';
import { useLedger } from '@/lib/hooks';
import { AmountText, EmptyState, Fab, FAB_SIZE, GradientCard, GradientStat, ScreenContainer, ScreenHeader } from '@/lib/ui';
import {
  formatDayLabel,
  formatMonthLabel,
  formatTaka,
  groupByDay,
  monthlySummary,
  nameLookup,
  remainingOf,
  takeDays,
  todayKey,
  toMonthKey,
} from '@/lib/utils';

/** Transactions shown per page; "Load more" adds another page (always whole days). */
const PAGE_SIZE = 30;

export function TransactionsScreen() {
  const insets = useSafeAreaInsets();
  const { accounts, categories, transactions } = useLedger();
  const nameOf = useMemo(() => nameLookup(accounts, categories), [accounts, categories]);
  const allSections = useMemo(() => groupByDay(transactions), [transactions]);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const sections = useMemo(() => takeDays(allSections, limit), [allSections, limit]);
  const shown = sections.reduce((count, section) => count + section.data.length, 0);
  const hasMore = sections.length < allSections.length;
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
            <GradientCard className="gap-4">
              <Box className="gap-1">
                <Text className="text-sm font-medium text-white/75">Spent this month</Text>
                <AmountText amount={summary.expenses} tone="onHero" className="text-4xl" />
              </Box>
              <HStack className="gap-3">
                <GradientStat label="Income">
                  <AmountText amount={summary.income} tone="onHero" className="text-lg" />
                </GradientStat>
                <GradientStat label="Saved">
                  <AmountText amount={summary.saved} tone="onHero" className="text-lg" />
                </GradientStat>
              </HStack>
            </GradientCard>
          </>
        }
        renderSectionHeader={({ section }) => (
          <HStack className="items-center justify-between pb-2 pt-6">
            <Text className="text-sm font-bold text-foreground">{formatDayLabel(section.date)}</Text>
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
              className={`overflow-hidden border-x border-border/70 bg-card ${first ? 'rounded-t-3xl border-t' : ''} ${
                last ? 'rounded-b-3xl border-b' : ''
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
        ListFooterComponent={
          hasMore ? (
            <Box className="items-center gap-2 pt-6">
              <Button
                variant="outline"
                size="lg"
                className="h-12 w-full rounded-2xl"
                onPress={() => setLimit((current) => current + PAGE_SIZE)}>
                <ButtonText className="text-base font-semibold">Load more</ButtonText>
              </Button>
              <Text className="text-xs text-muted-foreground">
                Showing {shown} of {transactions.length}
              </Text>
            </Box>
          ) : undefined
        }
        ListEmptyComponent={
          <EmptyState
            title="No transactions yet"
            message="Tap + to add your first income, expense or transfer."
          />
        }
      />
      <Fab onPress={() => router.push('/transaction-form')} label="Add" />
    </ScreenContainer>
  );
}
