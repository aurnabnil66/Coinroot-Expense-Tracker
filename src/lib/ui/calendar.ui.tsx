import { useState } from 'react';

import { Box } from '@/lib/gluestack-ui/box';
import { HStack } from '@/lib/gluestack-ui/hstack';
import { ChevronLeftIcon, ChevronRightIcon } from '@/lib/gluestack-ui/icon';
import { Pressable } from '@/lib/gluestack-ui/pressable';
import { Text } from '@/lib/gluestack-ui/text';
import { VStack } from '@/lib/gluestack-ui/vstack';
import { addMonths, calendarWeeks, formatFullDate, formatMonthLabel, todayKey, toMonthKey, weekdayLabels } from '@/lib/utils';

import { IconButton } from './icon-button.ui';

/** Calendars start on Sunday (the Bangladeshi work week runs Sunday–Thursday). */
const WEEK_STARTS_ON = 0;

type CalendarProps = {
  /** Selected day, "YYYY-MM-DD". */
  value: string;
  onChange: (value: string) => void;
  /** Last selectable day (inclusive); later days are disabled. */
  maxDate?: string;
};

/** Month grid for picking a day; today is outlined and the selected day filled. */
export function Calendar({ value, onChange, maxDate }: CalendarProps) {
  const [month, setMonth] = useState(() => toMonthKey(value));
  const today = todayKey();
  const canGoNext = !maxDate || addMonths(month, 1) <= toMonthKey(maxDate);

  return (
    <VStack className="w-full gap-3">
      <HStack className="items-center justify-between">
        <IconButton icon={ChevronLeftIcon} variant="ghost" onPress={() => setMonth((m) => addMonths(m, -1))} accessibilityLabel="Previous month" />
        <Text className="text-base font-semibold text-foreground">{formatMonthLabel(month)}</Text>
        <Box className={canGoNext ? '' : 'opacity-30'} pointerEvents={canGoNext ? 'auto' : 'none'}>
          <IconButton icon={ChevronRightIcon} variant="ghost" onPress={() => setMonth((m) => addMonths(m, 1))} accessibilityLabel="Next month" />
        </Box>
      </HStack>

      <HStack>
        {weekdayLabels(WEEK_STARTS_ON).map((day) => (
          <Text key={day} className="flex-1 text-center text-xs font-medium text-muted-foreground">
            {day.slice(0, 2)}
          </Text>
        ))}
      </HStack>

      <VStack className="gap-1">
        {calendarWeeks(month, WEEK_STARTS_ON).map((week, index) => (
          <HStack key={index}>
            {week.map((day, column) =>
              day ? (
                <DayCell
                  key={day}
                  day={day}
                  selected={day === value}
                  isToday={day === today}
                  disabled={Boolean(maxDate && day > maxDate)}
                  onPress={() => onChange(day)}
                />
              ) : (
                <Box key={`empty-${column}`} className="flex-1" />
              )
            )}
          </HStack>
        ))}
      </VStack>
    </VStack>
  );
}

type DayCellProps = {
  day: string;
  selected: boolean;
  isToday: boolean;
  disabled: boolean;
  onPress: () => void;
};

function DayCell({ day, selected, isToday, disabled, onPress }: DayCellProps) {
  const circle = selected ? 'bg-primary' : isToday ? 'border border-primary' : '';
  const text = selected
    ? 'font-semibold text-primary-foreground'
    : disabled
      ? 'text-muted-foreground/40'
      : isToday
        ? 'font-semibold text-primary'
        : 'text-foreground';
  return (
    <Box className="flex-1 items-center">
      <Pressable
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={formatFullDate(day)}
        accessibilityState={{ selected, disabled }}
        className={`h-10 w-10 items-center justify-center rounded-full data-[active=true]:bg-accent ${circle}`}>
        <Text className={`text-sm ${text}`}>{Number(day.slice(8))}</Text>
      </Pressable>
    </Box>
  );
}
