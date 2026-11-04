import { ScrollView } from 'react-native';

import { Pressable } from '@/lib/gluestack-ui/pressable';
import { Text } from '@/lib/gluestack-ui/text';

import { FormTextField } from './form-text-field.ui';

type SuggestTextFieldProps = {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  onBlur?: () => void;
  error?: string;
  hint?: string;
  placeholder?: string;
  maxLength?: number;
  /** Earlier values, most relevant first; the ones matching what's typed show as chips. */
  suggestions: readonly string[];
  /** Most chips to show at once. */
  limit?: number;
};

/** A text field with tappable chips of earlier values (e.g. client names) that match what's typed. */
export function SuggestTextField({ suggestions, limit = 6, ...fieldProps }: SuggestTextFieldProps) {
  const typed = fieldProps.value.trim().toLowerCase();
  const matches = suggestions
    .filter((s) => s.toLowerCase() !== typed && s.toLowerCase().includes(typed))
    .slice(0, limit);

  return (
    <>
      <FormTextField {...fieldProps} />
      {matches.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerClassName="gap-2" className="-mt-3">
          {matches.map((name) => (
            <Pressable
              key={name}
              onPress={() => fieldProps.onChangeText(name)}
              accessibilityRole="button"
              accessibilityLabel={`Use ${name}`}
              className="rounded-full border border-border bg-card px-4 py-1.5 data-[active=true]:bg-accent">
              <Text className="text-xs font-semibold text-muted-foreground">{name}</Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
    </>
  );
}
