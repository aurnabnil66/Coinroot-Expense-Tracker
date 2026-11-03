import { useMemo, useState } from 'react';

import { HStack } from '@/lib/gluestack-ui/hstack';
import { Text } from '@/lib/gluestack-ui/text';
import { VStack } from '@/lib/gluestack-ui/vstack';
import type { Transaction } from '@/lib/types';
import { AmountText, type BarDatum, BarChart, Card, SegmentedControl } from '@/lib/ui';
import {
  dailySpending,
  formatDayLabel,
  formatMonthLabel,
  formatShortMonth,
  formatTaka,
  formatTakaCompact,
  monthlySpending,
  niceTakaCeiling,
  todayKey,
  toMonthKey,
} from '@/lib/utils';

type ChartRange = 'days' | 'months';

const RANGE_OPTIONS = [
  { value: 'days', label: 'Daily' },
  { value: 'months', label: 'Last 6 months' },
] as const;

const MONTH_COUNT = 6;

type SpendingChartProps = {
  /** The month being viewed ("YYYY-MM"). The 6-month view ends with it. */
  month: string;
  transactions: readonly Transaction[];
};

/** Expenses over time: per day of the month, or per month for the last six months. Tap a bar for its total. */
export function SpendingChart({ month, transactions }: SpendingChartProps) {
  const [range, setRange] = useState<ChartRange>('days');
  const [selected, setSelected] = useState<string | null>(null);
  const today = todayKey();
  const currentMonth = toMonthKey(today);

  const periods = useMemo(
    () => (range === 'days' ? dailySpending(month, transactions) : monthlySpending(month, MONTH_COUNT, transactions)),
    [range, month, transactions]
  );

  const data: BarDatum[] = periods.map(({ key, amount }) => {
    const label = range === 'days' ? dayAxisLabel(key) : formatShortMonth(key);
    const fullLabel = range === 'days' ? formatDayLabel(key, today) : formatMonthLabel(key);
    return { key, value: amount, label, accessibilityLabel: `${fullLabel}: ${formatTaka(amount)} spent` };
  });

  const total = periods.reduce((sum, p) => sum + p.amount, 0);
  // Average over the days that have happened so far, so a half-finished month isn't understated.
  const elapsedDays = month < currentMonth ? periods.length : month === currentMonth ? Number(today.slice(8)) : 0;
  const average = range === 'days' ? (elapsedDays > 0 ? Math.round(total / elapsedDays) : 0) : Math.round(total / MONTH_COUNT);

  const selectedPeriod = periods.find((p) => p.key === selected);
  const caption = selectedPeriod
    ? range === 'days'
      ? formatDayLabel(selectedPeriod.key, today)
      : formatMonthLabel(selectedPeriod.key)
    : range === 'days'
      ? 'Average per day'
      : 'Average per month';

  const changeRange = (next: ChartRange) => {
    setRange(next);
    setSelected(null);
  };

  return (
    <Card className="gap-4 p-4">
      <SegmentedControl options={RANGE_OPTIONS} value={range} onChange={changeRange} />
      <HStack className="items-end justify-between gap-3">
        <VStack className="gap-0.5">
          <Text className="text-xs font-medium text-muted-foreground">{caption}</Text>
          <AmountText amount={selectedPeriod?.amount ?? average} className="text-2xl" />
        </VStack>
        <VStack className="items-end gap-0.5">
          <Text className="text-xs font-medium text-muted-foreground">Total</Text>
          <AmountText amount={total} tone="muted" className="text-base" />
        </VStack>
      </HStack>
      <BarChart
        data={data}
        maxValue={niceTakaCeiling(Math.max(0, ...periods.map((p) => p.amount)))}
        formatValue={formatTakaCompact}
        selectedKey={selected}
        onSelect={setSelected}
        highlightKey={range === 'days' ? today : month}
      />
      {total === 0 ? (
        <Text className="text-center text-sm text-muted-foreground">Nothing spent in this period.</Text>
      ) : null}
    </Card>
  );
}

/** Labels day 1 and every fifth day so a month's 30 bars stay readable. */
function dayAxisLabel(dateKey: string): string {
  const day = Number(dateKey.slice(8));
  return day === 1 || day % 5 === 0 ? String(day) : '';
}
