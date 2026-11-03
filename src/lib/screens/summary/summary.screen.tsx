import { useMemo, useState } from 'react';

import { CATEGORY_COLORS, DEFAULT_CATEGORY_COLOR } from '@/lib/constants';
import { Box } from '@/lib/gluestack-ui/box';
import { HStack } from '@/lib/gluestack-ui/hstack';
import { Text } from '@/lib/gluestack-ui/text';
import { VStack } from '@/lib/gluestack-ui/vstack';
import { useLedger } from '@/lib/hooks';
import {
  AmountText,
  type AmountTone,
  Card,
  EmptyState,
  InitialBadge,
  MonthSwitcher,
  ProgressBar,
  ScreenContainer,
  ScreenHeader,
  SectionHeader,
} from '@/lib/ui';
import { addMonths, formatMonthLabel, monthlySummary, todayKey, toMonthKey } from '@/lib/utils';

function Stat({ label, amount, tone, hint }: { label: string; amount: number; tone?: AmountTone; hint?: string }) {
  return (
    <Box className="flex-1 gap-1 p-4">
      <Text className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</Text>
      <AmountText amount={amount} tone={tone} className="text-xl" />
      {hint ? <Text className="text-xs text-muted-foreground">{hint}</Text> : null}
    </Box>
  );
}

export function SummaryScreen() {
  const { accounts, categories, transactions } = useLedger();
  const [month, setMonth] = useState(() => toMonthKey(todayKey()));
  const summary = useMemo(() => monthlySummary(month, transactions, accounts), [month, transactions, accounts]);
  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  return (
    <ScreenContainer safeTop tabBar>
      <ScreenHeader title="Summary" />
      <MonthSwitcher
        label={formatMonthLabel(month)}
        onPrevious={() => setMonth((m) => addMonths(m, -1))}
        onNext={() => setMonth((m) => addMonths(m, 1))}
      />

      <Card className="mt-4">
        <HStack>
          <Stat label="Income" amount={summary.income} tone="income" />
          <Box className="w-px bg-border" />
          <Stat label="Expenses" amount={summary.expenses} />
        </HStack>
        <Box className="h-px bg-border" />
        <HStack>
          <Stat
            label="Saved"
            amount={summary.saved}
            tone={summary.saved < 0 ? 'expense' : 'default'}
            hint="Income − expenses"
          />
          <Box className="w-px bg-border" />
          <Stat label="To savings" amount={summary.movedToSavings} hint="DPS and savings deposits" />
        </HStack>
      </Card>

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
            const color = CATEGORY_COLORS[category?.color ?? DEFAULT_CATEGORY_COLOR] ?? CATEGORY_COLORS[DEFAULT_CATEGORY_COLOR];
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
    </ScreenContainer>
  );
}
