import { HStack } from '@/lib/gluestack-ui/hstack';
import { Pressable } from '@/lib/gluestack-ui/pressable';
import { Text } from '@/lib/gluestack-ui/text';

type SegmentedControlProps<T extends string> = {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  /** Background class per option when selected (defaults to `bg-primary`). */
  selectedClass?: Partial<Record<T, string>>;
};

/** Pill switch: the selected option is a filled pill (white text; dark text on the brighter dark-mode colours). */
export function SegmentedControl<T extends string>({ options, value, onChange, selectedClass }: SegmentedControlProps<T>) {
  return (
    <HStack className="gap-1 rounded-2xl border border-border/70 bg-card p-1">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            className={`flex-1 items-center rounded-xl py-2.5 ${
              selected ? (selectedClass?.[option.value] ?? 'bg-primary') : 'data-[active=true]:bg-accent'
            }`}>
            <Text className={`text-sm font-semibold ${selected ? 'text-white dark:text-primary-foreground' : 'text-muted-foreground'}`}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </HStack>
  );
}
