import { useState } from 'react';
import { Pressable, TextInput, type TextInputInstance } from 'react-native';

import { useGluestackColors } from '@/lib/gluestack-ui/gluestack-ui-provider';
import { HStack } from '@/lib/gluestack-ui/hstack';
import { Text } from '@/lib/gluestack-ui/text';
import { VStack } from '@/lib/gluestack-ui/vstack';
import { focusInput, useAutoFocus } from '@/lib/hooks';
import { TAKA_SIGN } from '@/lib/utils';

type AmountFieldProps = {
  value: string;
  onChangeText: (text: string) => void;
  onBlur?: () => void;
  error?: string;
  /** Colour class for the ৳ sign only, e.g. "text-income"; the number keeps the normal text colour. */
  signClass?: string;
  autoFocus?: boolean;
};

/** Longer amounts drop a size so they always fit on one line. */
const LONG_AMOUNT = 9;
/** Room for the cursor next to the measured text. */
const CURSOR_SPACE = 6;

/**
 * Large, centred taka amount input — the focus of the transaction form. The input is
 * exactly as wide as its text (measured from a hidden copy), so it grows with the
 * amount instead of scrolling sideways.
 */
export function AmountField({ value, onChangeText, onBlur, error, signClass = 'text-foreground', autoFocus }: AmountFieldProps) {
  const colors = useGluestackColors();
  const [width, setWidth] = useState(0);
  const inputRef = useAutoFocus<TextInputInstance>(autoFocus);
  // Explicit line heights: Tailwind's text-5xl / text-4xl set line-height 1, which clips Poppins.
  const sizeClass = value.length > LONG_AMOUNT ? 'text-4xl leading-[56px]' : 'text-5xl leading-[68px]';

  return (
    <VStack className="w-full items-center gap-1 py-2">
      {/* The input is only as wide as its digits, so the whole row (sign included) focuses it. */}
      <Pressable
        onPress={() => focusInput(inputRef.current)}
        accessible={false}
        className="items-center py-2"
        style={{ alignSelf: 'stretch' }}>
        <HStack className="max-w-full items-center justify-center gap-1">
          <Text className={`text-3xl font-semibold ${signClass}`}>{TAKA_SIGN}</Text>
          <Text
            aria-hidden
            numberOfLines={1}
            className={`absolute font-sans font-semibold opacity-0 ${sizeClass}`}
            onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
            {value || '0'}
          </Text>
          <TextInput
            ref={inputRef}
            value={value}
            onChangeText={onChangeText}
            onBlur={onBlur}
            placeholder="0"
            placeholderTextColor={colors.mutedForeground}
            cursorColor={colors.primary}
            selectionColor={`${colors.primary}55`}
            keyboardType="decimal-pad"
            inputMode="decimal"
            accessibilityLabel="Amount in taka"
            scrollEnabled={false}
            className={`px-0 py-0 font-sans font-semibold text-foreground ${sizeClass}`}
            style={{ width: width + CURSOR_SPACE, includeFontPadding: false }}
          />
        </HStack>
      </Pressable>
      {error ? <Text className="text-xs text-destructive">{error}</Text> : null}
    </VStack>
  );
}
