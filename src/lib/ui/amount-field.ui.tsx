import { TextInput } from 'react-native';

import { useGluestackColors } from '@/lib/gluestack-ui/gluestack-ui-provider';
import { HStack } from '@/lib/gluestack-ui/hstack';
import { Text } from '@/lib/gluestack-ui/text';
import { VStack } from '@/lib/gluestack-ui/vstack';
import { TAKA_SIGN } from '@/lib/utils';

type AmountFieldProps = {
  value: string;
  onChangeText: (text: string) => void;
  onBlur?: () => void;
  error?: string;
  /** Text colour class for the number, e.g. "text-income". */
  toneClass?: string;
  autoFocus?: boolean;
};

/** Large, centred taka amount input — the focus of the transaction form. */
export function AmountField({ value, onChangeText, onBlur, error, toneClass = 'text-foreground', autoFocus }: AmountFieldProps) {
  const colors = useGluestackColors();
  return (
    <VStack className="items-center gap-1 py-4">
      <HStack className="items-center justify-center gap-1">
        <Text className={`text-3xl font-semibold ${toneClass}`}>{TAKA_SIGN}</Text>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          onBlur={onBlur}
          autoFocus={autoFocus}
          placeholder="0"
          placeholderTextColor={colors.mutedForeground}
          keyboardType="decimal-pad"
          inputMode="decimal"
          accessibilityLabel="Amount in taka"
          className={`min-w-16 font-sans text-5xl font-semibold ${toneClass}`}
        />
      </HStack>
      {error ? <Text className="text-xs text-destructive">{error}</Text> : null}
    </VStack>
  );
}
