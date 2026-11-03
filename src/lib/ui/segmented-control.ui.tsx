import { HStack } from '@/lib/gluestack-ui/hstack';
import { Pressable } from '@/lib/gluestack-ui/pressable';
import { Text } from '@/lib/gluestack-ui/text';

type SegmentedControlProps<T extends string> = {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  /** Text colour class per option when selected (e.g. income in green). */
  selectedTextClass?: Partial<Record<T, string>>;
};

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  selectedTextClass,
}: SegmentedControlProps<T>) {
  return (
    <HStack className="rounded-xl bg-muted p-1">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            className={`flex-1 items-center rounded-lg py-2 ${selected ? 'bg-card shadow-sm' : ''}`}>
            <Text
              className={`text-sm font-semibold ${
                selected ? (selectedTextClass?.[option.value] ?? 'text-foreground') : 'text-muted-foreground'
              }`}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </HStack>
  );
}
