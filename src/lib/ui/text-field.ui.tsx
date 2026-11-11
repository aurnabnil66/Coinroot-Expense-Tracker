import { type ComponentProps, useState } from 'react';
import { Pressable as RNPressable, ScrollView, type TextInputInstance, type TextInputProps } from 'react-native';

import { useGluestackColors } from '@/lib/gluestack-ui/gluestack-ui-provider';
import { EyeIcon, EyeOffIcon, Icon, SearchIcon } from '@/lib/gluestack-ui/icon';
import { Input, InputField, InputSlot } from '@/lib/gluestack-ui/input';
import { Pressable } from '@/lib/gluestack-ui/pressable';
import { Text } from '@/lib/gluestack-ui/text';
import { focusInput, useAutoFocus } from '@/lib/hooks';

import { FieldShell } from './field-shell.ui';

/**
 * What the field is for. Sets the keyboard, capitalisation, autofill and extras:
 * - `text` (default): plain text, sentence case
 * - `nickname`: one word, no autocorrect
 * - `email`: email keyboard, lowercase, no autocorrect
 * - `password` / `new-password`: hidden with a show / hide button (log in / sign up autofill)
 * - `phone`: phone keypad
 * - `money`: decimal keypad (for amounts in taka)
 * - `search`: search icon in front, no autocorrect
 */
export type TextFieldType = 'text' | 'nickname' | 'email' | 'password' | 'new-password' | 'phone' | 'money' | 'search';

type InputPreset = Pick<
  TextInputProps,
  'keyboardType' | 'autoCapitalize' | 'autoComplete' | 'autoCorrect' | 'textContentType' | 'returnKeyType'
>;

const PRESETS: Record<TextFieldType, InputPreset> = {
  text: {},
  nickname: { autoComplete: 'nickname', autoCorrect: false, textContentType: 'nickname' },
  email: {
    keyboardType: 'email-address',
    autoCapitalize: 'none',
    autoComplete: 'email',
    autoCorrect: false,
    textContentType: 'emailAddress',
  },
  password: { autoCapitalize: 'none', autoComplete: 'current-password', autoCorrect: false, textContentType: 'password' },
  'new-password': { autoCapitalize: 'none', autoComplete: 'new-password', autoCorrect: false, textContentType: 'newPassword' },
  phone: { keyboardType: 'phone-pad', autoComplete: 'tel', textContentType: 'telephoneNumber' },
  money: { keyboardType: 'decimal-pad' },
  search: { autoCorrect: false, returnKeyType: 'search' },
};

const SIZE_CLASS = {
  /** Form fields. */
  md: 'h-14',
  /** Compact, e.g. the search box in a picker sheet. */
  sm: 'h-12',
};

type TextFieldProps = {
  /** Shown above the field; leave out for a bare field (e.g. search). */
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  onBlur?: () => void;
  error?: string;
  hint?: string;
  placeholder?: string;
  type?: TextFieldType;
  /** Several lines (e.g. a long note); the box grows to 4 lines' height. */
  multiline?: boolean;
  maxLength?: number;
  autoFocus?: boolean;
  /** Shown dimmed and can't be edited (e.g. the sign-in email). */
  readOnly?: boolean;
  /** Icon at the start of the field (`search` gets one automatically). */
  icon?: ComponentProps<typeof Icon>['as'];
  /** Earlier values, most relevant first; the ones matching what's typed show as tappable chips. */
  suggestions?: readonly string[];
  /** Most suggestion chips shown at once. */
  suggestionLimit?: number;
  size?: keyof typeof SIZE_CLASS;
  /** Extra classes for the box (e.g. `bg-background`, margins). */
  className?: string;
};

/**
 * The app's one text input: label, field, then the error (or hint) below. Pick behaviour with
 * `type`; add `suggestions` for chips of earlier values. Takes plain props, no react-hook-form.
 */
export function TextField({
  label,
  error,
  hint,
  type = 'text',
  multiline = false,
  readOnly = false,
  icon,
  suggestions,
  suggestionLimit = 6,
  size = 'md',
  className = '',
  autoFocus,
  ...inputProps
}: TextFieldProps) {
  const colors = useGluestackColors();
  const inputRef = useAutoFocus<TextInputInstance>(autoFocus);
  const [revealed, setRevealed] = useState(false);
  const isPassword = type === 'password' || type === 'new-password';
  const leadingIcon = icon ?? (type === 'search' ? SearchIcon : undefined);

  const field = (
    // The box's padding and edges belong to the container, not the text input, so a tap
    // there would do nothing; this focuses the input (and opens the keyboard) from anywhere.
    <RNPressable onPress={() => focusInput(inputRef.current)} disabled={readOnly} accessible={false}>
      <Input
        isInvalid={Boolean(error)}
        isReadOnly={readOnly}
        className={`rounded-2xl bg-card ${multiline ? 'h-28 items-start py-3' : SIZE_CLASS[size]} ${leadingIcon ? 'pl-3' : 'pl-4'} ${
          isPassword ? 'pr-2' : 'pr-4'
        } ${readOnly ? 'opacity-60' : ''} ${className}`}>
        {leadingIcon ? (
          <InputSlot>
            <Icon as={leadingIcon} size="md" className="text-muted-foreground" />
          </InputSlot>
        ) : null}
        <InputField
          // gluestack types InputField's ref as its props; it is the TextInput instance.
          ref={inputRef as never}
          {...PRESETS[type]}
          {...inputProps}
          multiline={multiline}
          secureTextEntry={isPassword && !revealed}
          editable={!readOnly}
          textAlignVertical={multiline ? 'top' : 'center'}
          cursorColor={colors.primary}
          selectionColor={`${colors.primary}55`}
          selectionHandleColor={colors.primary}
          // Android adds extra font padding above Poppins, which pushes single-line text up;
          // without it (and the default vertical padding) the text sits in the middle of the box.
          style={multiline ? undefined : { includeFontPadding: false, paddingVertical: 0 }}
          className="text-base"
        />
        {isPassword ? (
          <InputSlot
            onPress={() => setRevealed((shown) => !shown)}
            accessibilityRole="button"
            accessibilityLabel={revealed ? 'Hide password' : 'Show password'}
            className="h-10 w-10 rounded-full">
            <Icon as={revealed ? EyeOffIcon : EyeIcon} size="md" className="text-muted-foreground" />
          </InputSlot>
        ) : null}
      </Input>
    </RNPressable>
  );

  const chips = suggestions ? (
    <SuggestionChips
      suggestions={suggestions}
      typed={inputProps.value}
      limit={suggestionLimit}
      onPick={inputProps.onChangeText}
    />
  ) : null;

  if (!label) {
    return (
      <>
        {field}
        {chips}
      </>
    );
  }
  return (
    <>
      <FieldShell label={label} error={error} hint={hint}>
        {field}
      </FieldShell>
      {chips}
    </>
  );
}

type SuggestionChipsProps = {
  suggestions: readonly string[];
  typed: string;
  limit: number;
  onPick: (value: string) => void;
};

/** Chips of earlier values that contain what's typed (e.g. client names). */
function SuggestionChips({ suggestions, typed, limit, onPick }: SuggestionChipsProps) {
  const query = typed.trim().toLowerCase();
  const matches = suggestions.filter((s) => s.toLowerCase() !== query && s.toLowerCase().includes(query)).slice(0, limit);
  if (matches.length === 0) return null;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerClassName="gap-2"
      className="-mt-3">
      {matches.map((name) => (
        <Pressable
          key={name}
          onPress={() => onPick(name)}
          accessibilityRole="button"
          accessibilityLabel={`Use ${name}`}
          className="rounded-full border border-border bg-card px-4 py-1.5 data-[active=true]:bg-accent">
          <Text className="text-xs font-semibold text-muted-foreground">{name}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}
