import { useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper,
} from '@/lib/gluestack-ui/actionsheet';
import { HStack } from '@/lib/gluestack-ui/hstack';
import { CalendarDaysIcon, ChevronDownIcon, Icon } from '@/lib/gluestack-ui/icon';
import { Pressable } from '@/lib/gluestack-ui/pressable';
import { Text } from '@/lib/gluestack-ui/text';
import { useRipple } from '@/lib/hooks';
import { addDays, formatDayLabel, formatFullDate, todayKey } from '@/lib/utils';

import { Calendar } from './calendar.ui';
import { FieldShell } from './field-shell.ui';

type DateFieldProps = {
  label: string;
  /** "YYYY-MM-DD" */
  value: string;
  onChange: (value: string) => void;
  error?: string;
  /** Last selectable day in the calendar (defaults to today). */
  maxDate?: string;
};

/**
 * Date picker field: tap to choose a day from a calendar sheet. Most entries are for
 * today or yesterday, so those stay one tap away as shortcuts.
 */
export function DateField({ label, value, onChange, error, maxDate = todayKey() }: DateFieldProps) {
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const ripple = useRipple();
  const today = todayKey();
  const shortcuts = [
    { label: 'Today', value: today },
    { label: 'Yesterday', value: addDays(today, -1) },
  ];
  const dayLabel = formatDayLabel(value, today);
  const isRelative = dayLabel === 'Today' || dayLabel === 'Yesterday';
  const text = isRelative ? `${dayLabel}, ${formatFullDate(value)}` : formatFullDate(value);

  const choose = (day: string) => {
    onChange(day);
    setOpen(false);
  };

  return (
    <FieldShell label={label} error={error}>
      <Pressable
        onPress={() => setOpen(true)}
        android_ripple={ripple}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${text}. Opens a calendar.`}
        className={`h-14 flex-row items-center gap-3 overflow-hidden rounded-2xl border bg-card px-4 data-[active=true]:bg-accent ${
          error ? 'border-destructive/60' : 'border-border'
        }`}>
        <Icon as={CalendarDaysIcon} size="md" className="text-primary" />
        <Text className="flex-1 text-base text-foreground">{text}</Text>
        <Icon as={ChevronDownIcon} size="sm" className="text-muted-foreground" />
      </Pressable>

      <HStack className="gap-2">
        {shortcuts.map((shortcut) => {
          const selected = shortcut.value === value;
          return (
            <Pressable
              key={shortcut.label}
              onPress={() => onChange(shortcut.value)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              className={`rounded-full border px-4 py-1.5 ${selected ? 'border-primary bg-primary' : 'border-border bg-card'}`}>
              <Text className={`text-xs font-semibold ${selected ? 'text-primary-foreground' : 'text-muted-foreground'}`}>
                {shortcut.label}
              </Text>
            </Pressable>
          );
        })}
      </HStack>

      <Actionsheet isOpen={open} onClose={() => setOpen(false)}>
        <ActionsheetBackdrop />
        <ActionsheetContent className="rounded-t-3xl bg-card" style={{ paddingBottom: insets.bottom + 16 }}>
          <ActionsheetDragIndicatorWrapper>
            <ActionsheetDragIndicator />
          </ActionsheetDragIndicatorWrapper>
          <Text className="w-full px-1 pb-2 pt-1 text-lg font-semibold text-foreground">{label}</Text>
          {/* Remount per opening so the calendar starts on the selected month. */}
          {open ? <Calendar value={value} onChange={choose} maxDate={maxDate} /> : null}
        </ActionsheetContent>
      </Actionsheet>
    </FieldShell>
  );
}
