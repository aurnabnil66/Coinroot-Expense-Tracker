import { HStack } from '@/lib/gluestack-ui/hstack';
import { ChevronLeftIcon, ChevronRightIcon } from '@/lib/gluestack-ui/icon';
import { Pressable } from '@/lib/gluestack-ui/pressable';
import { Text } from '@/lib/gluestack-ui/text';
import { addDays, formatDayLabel, formatFullDate, todayKey } from '@/lib/utils';

import { FieldShell } from './field-shell.ui';
import { IconButton } from './icon-button.ui';

type DateFieldProps = {
  label: string;
  /** "YYYY-MM-DD" */
  value: string;
  onChange: (value: string) => void;
  error?: string;
};

/**
 * Day stepper with Today / Yesterday shortcuts. Most entries are for today or
 * yesterday, so this beats a calendar for speed; older days are a few taps back.
 */
export function DateField({ label, value, onChange, error }: DateFieldProps) {
  const today = todayKey();
  const shortcuts = [
    { label: 'Today', value: today },
    { label: 'Yesterday', value: addDays(today, -1) },
  ];
  const dayLabel = formatDayLabel(value, today);
  const isRelative = dayLabel === 'Today' || dayLabel === 'Yesterday';

  return (
    <FieldShell label={label} error={error}>
      <HStack className="h-14 items-center gap-2 rounded-2xl border border-border bg-card px-2">
        <IconButton icon={ChevronLeftIcon} onPress={() => onChange(addDays(value, -1))} accessibilityLabel="Previous day" variant="ghost" />
        <Text className="flex-1 text-center text-base font-medium text-foreground">
          {isRelative ? `${dayLabel}, ${formatFullDate(value)}` : formatFullDate(value)}
        </Text>
        <IconButton icon={ChevronRightIcon} onPress={() => onChange(addDays(value, 1))} accessibilityLabel="Next day" variant="ghost" />
      </HStack>
      <HStack className="gap-2">
        {shortcuts.map((shortcut) => {
          const selected = shortcut.value === value;
          return (
            <Pressable
              key={shortcut.label}
              onPress={() => onChange(shortcut.value)}
              className={`rounded-full border px-4 py-1.5 ${selected ? 'border-primary bg-primary' : 'border-border bg-card'}`}>
              <Text className={`text-xs font-semibold ${selected ? 'text-primary-foreground' : 'text-muted-foreground'}`}>
                {shortcut.label}
              </Text>
            </Pressable>
          );
        })}
      </HStack>
    </FieldShell>
  );
}
