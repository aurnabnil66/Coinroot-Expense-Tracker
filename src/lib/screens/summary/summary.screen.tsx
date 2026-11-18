import { useMemo, useState } from 'react';

import { LedgerPending, SPENDING_CHART_MONTHS, SpendingChart } from '@/lib/components';
import { DEFAULT_CATEGORY_COLOR } from '@/lib/constants';
import { getMonthlySpending, getTransactionsBetween } from '@/lib/db';
import { Box } from '@/lib/gluestack-ui/box';
import { HStack } from '@/lib/gluestack-ui/hstack';
import { Text } from '@/lib/gluestack-ui/text';
import { VStack } from '@/lib/gluestack-ui/vstack';
import { useCategoryColors, useLedger, useLedgerQuery } from '@/lib/hooks';
import {
  AmountText,
  Card,
  EmptyState,
  GradientCard,
  GradientStat,
  InitialBadge,
  MonthSwitcher,
  ProgressBar,
  ScreenContainer,
  ScreenHeader,
  SectionHeader,
  Skeleton,
  SkeletonCard,
} from '@/lib/ui';
import type { Transaction } from '@/lib/types';
import {
  addMonths,
  dailySpending,
  daysInMonth,
  formatMonthLabel,
  incomeByPayer,
  monthlySummary,
  todayKey,
  toMonthKey,
} from '@/lib/utils';

const NO_ROWS: readonly Transaction[] = [];

export function SummaryScreen() {
  const { status, error, accounts, categories } = useLedger();
  const [month, setMonth] = useState(() => toMonthKey(todayKey()));
  // One month of entries (newest first) for the totals, categories, clients and daily bars;
  // the six-month bars are totalled in SQL.
  const monthRows = useLedgerQuery(
    (database) => getTransactionsBetween(database, `${month}-01`, `${month}-${daysInMonth(month)}`),
    [month]
  );
  const monthly = useLedgerQuery((database) => getMonthlySpending(database, month, SPENDING_CHART_MONTHS), [month]);
  const rows = monthRows ?? NO_ROWS;
  const summary = useMemo(() => monthlySummary(month, rows, accounts), [month, rows, accounts]);
  const daily = useMemo(() => dailySpending(month, rows), [month, rows]);
  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const palette = useCategoryColors();
  const byClient = useMemo(() => incomeByPayer(month, rows), [month, rows]);

  return (
    <ScreenContainer safeTop tabBar>
      <ScreenHeader title="Summary" />
      <MonthSwitcher
        label={formatMonthLabel(month)}
        onPrevious={() => setMonth((m) => addMonths(m, -1))}
        onNext={() => setMonth((m) => addMonths(m, 1))}
      />

      {status !== 'ready' ? (
        <VStack className="mt-4">
          <LedgerPending
            status={status}
            error={error}
            loading={
              <>
                <Skeleton className="h-48 rounded-xl" />
                <Skeleton className="mt-3 h-20 rounded-xl" />
                <Skeleton className="mb-3 mt-6 h-3.5 w-36 rounded-full" />
                <Skeleton className="h-72 rounded-xl" />
                <Skeleton className="mb-3 mt-6 h-3.5 w-40 rounded-full" />
                <SkeletonCard rows={4} />
              </>
            }
          />
        </VStack>
      ) : (
        <>
          <GradientCard className="mt-4 gap-4">
            <VStack className="gap-1">
              <Text className="text-sm font-medium text-white/75">Saved this month</Text>
              <AmountText amount={summary.saved} tone="onHero" weight="semibold" className="text-4xl" />
              <Text className="text-xs text-white/75">Income − expenses. Transfers never count.</Text>
            </VStack>
            <HStack className="gap-3">
              <GradientStat label="Income">
                <AmountText amount={summary.income} tone="onHero" className="text-lg" />
              </GradientStat>
              <GradientStat label="Expenses">
                <AmountText amount={summary.expenses} tone="onHero" className="text-lg" />
              </GradientStat>
            </HStack>
          </GradientCard>

          <Card className="mt-3 flex-row items-center gap-3 p-4">
            <Box className="h-11 w-11 items-center justify-center rounded-2xl bg-sky/20 dark:bg-sky/25">
              <Text className="text-lg font-bold text-sky">৳</Text>
            </Box>
            <VStack className="flex-1">
              <Text className="text-sm font-medium text-muted-foreground">Moved to savings</Text>
              <Text className="text-xs text-muted-foreground">DPS and savings deposits</Text>
            </VStack>
            <AmountText amount={summary.movedToSavings} className="text-lg" />
          </Card>

          <SectionHeader title="Spending over time" />
          <SpendingChart month={month} daily={daily} monthly={monthly ?? []} />

          <SectionHeader title="Spending by category" />
          {summary.byCategory.length === 0 ? (
            <Card>
              <EmptyState title="No expenses" message={`Nothing spent in ${formatMonthLabel(month)}.`} />
            </Card>
          ) : (
            <Card>
              {summary.byCategory.map((row, index) => {
                const category = categoryById.get(row.categoryId);
                const name = category?.name ?? 'Unknown';
                const color = palette[category?.color ?? DEFAULT_CATEGORY_COLOR] ?? palette[DEFAULT_CATEGORY_COLOR];
                return (
                  <HStack key={row.categoryId} className={`items-center gap-3 px-4 py-3 ${index > 0 ? 'border-t border-border' : ''}`}>
                    <InitialBadge label={name} color={color} />
                    <VStack className="flex-1 gap-1.5">
                      <HStack className="items-baseline justify-between gap-2">
                        <Text numberOfLines={1} className="flex-1 text-base font-medium text-foreground">
                          {name}
                        </Text>
                        <AmountText amount={row.amount} className="text-base" />
                      </HStack>
                      <HStack className="items-center gap-3">
                        <Box className="flex-1">
                          <ProgressBar value={row.share} color={color} />
                        </Box>
                        <Text className="w-10 text-right text-xs tabular-nums text-muted-foreground">
                          {Math.round(row.share * 100)}%
                        </Text>
                      </HStack>
                    </VStack>
                  </HStack>
                );
              })}
            </Card>
          )}

          {byClient.length > 0 ? (
            <>
              <SectionHeader title="Income by client" />
              <Card>
                {byClient.map((row, index) => (
                  <HStack key={row.receivedFrom} className={`items-center gap-3 px-4 py-3 ${index > 0 ? 'border-t border-border' : ''}`}>
                    <InitialBadge label={row.receivedFrom} color={palette.emerald} />
                    <Text numberOfLines={1} className="flex-1 text-base font-medium text-foreground">
                      {row.receivedFrom}
                    </Text>
                    <AmountText amount={row.amount} signed tone="income" className="text-base" />
                  </HStack>
                ))}
              </Card>
            </>
          ) : null}
        </>
      )}
    </ScreenContainer>
  );
}
