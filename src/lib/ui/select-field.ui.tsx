import { type ReactNode, useState } from 'react';

import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper,
  ActionsheetItem,
  ActionsheetScrollView,
} from '@/lib/gluestack-ui/actionsheet';
import { Box } from '@/lib/gluestack-ui/box';
import { HStack } from '@/lib/gluestack-ui/hstack';
import { AddIcon, CheckIcon, ChevronDownIcon, Icon, SearchIcon } from '@/lib/gluestack-ui/icon';
import { Input, InputField, InputIcon, InputSlot } from '@/lib/gluestack-ui/input';
import { Pressable } from '@/lib/gluestack-ui/pressable';
import { Text } from '@/lib/gluestack-ui/text';
import { useRipple } from '@/lib/hooks';

import { FieldShell } from './field-shell.ui';

export type SelectOption = {
  value: string;
  label: string;
  description?: string;
  leading?: ReactNode;
  /** Right-aligned detail, e.g. a balance or "৳50 left". */
  trailing?: string;
};

type SelectFieldProps = {
  label: string;
  value: string | null;
  options: readonly SelectOption[];
  onChange: (value: string | null) => void;
  onBlur?: () => void;
  placeholder?: string;
  error?: string;
  hint?: string;
  /** Title of the bottom sheet (defaults to the label). */
  sheetTitle?: string;
  /** Show a "None" choice that clears the value. */
  noneLabel?: string;
  /** Show a "+ New …" row; receives the current search text. */
  onCreate?: (query: string) => void;
  createLabel?: string;
};

const SEARCH_THRESHOLD = 7;

/** A field that opens a bottom sheet to pick one option, optionally creating a new one. */
export function SelectField({
  label,
  value,
  options,
  onChange,
  onBlur,
  placeholder = 'Choose…',
  error,
  hint,
  sheetTitle,
  noneLabel,
  onCreate,
  createLabel = 'New',
}: SelectFieldProps) {
  const [open, setOpen] = useState(false);
  const ripple = useRipple();
  const [query, setQuery] = useState('');
  const selected = options.find((option) => option.value === value);

  const trimmed = query.trim();
  const visible = trimmed
    ? options.filter((option) => option.label.toLowerCase().includes(trimmed.toLowerCase()))
    : options;
  const exactMatch = options.some((option) => option.label.toLowerCase() === trimmed.toLowerCase());

  const close = () => {
    setOpen(false);
    setQuery('');
    onBlur?.();
  };
  const choose = (next: string | null) => {
    onChange(next);
    close();
  };

  return (
    <FieldShell label={label} error={error} hint={hint}>
      <Pressable
        onPress={() => setOpen(true)}
        android_ripple={ripple}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${selected?.label ?? placeholder}`}
        className={`h-14 flex-row items-center gap-3 overflow-hidden rounded-2xl border bg-card px-4 data-[active=true]:bg-accent ${
          error ? 'border-destructive/60' : 'border-border'
        }`}>
        {selected?.leading}
        <Text numberOfLines={1} className={`flex-1 text-base ${selected ? 'text-foreground' : 'text-muted-foreground'}`}>
          {selected?.label ?? placeholder}
        </Text>
        <Icon as={ChevronDownIcon} size="sm" className="text-muted-foreground" />
      </Pressable>

      <Actionsheet isOpen={open} onClose={close} snapPoints={[70]}>
        <ActionsheetBackdrop />
        <ActionsheetContent className="rounded-t-3xl bg-card">
          <ActionsheetDragIndicatorWrapper>
            <ActionsheetDragIndicator />
          </ActionsheetDragIndicatorWrapper>
          <Text className="w-full px-1 pb-3 pt-1 text-lg font-semibold text-foreground">{sheetTitle ?? label}</Text>

          {options.length >= SEARCH_THRESHOLD || onCreate ? (
            <Input className="mb-2 h-12 rounded-2xl bg-background">
              <InputSlot className="pl-1">
                <InputIcon as={SearchIcon} />
              </InputSlot>
              <InputField
                value={query}
                onChangeText={setQuery}
                placeholder={onCreate ? 'Search or type a new name' : 'Search'}
                autoCorrect={false}
                className="text-base"
              />
            </Input>
          ) : null}

          <ActionsheetScrollView keyboardShouldPersistTaps="handled" className="w-full">
            {onCreate && trimmed && !exactMatch ? (
              <ActionsheetItem onPress={() => { onCreate(trimmed); close(); }} className="rounded-2xl">
                <Box className="h-8 w-8 items-center justify-center rounded-xl bg-primary/10">
                  <Icon as={AddIcon} size="sm" className="text-primary" />
                </Box>
                <Text className="flex-1 text-base font-medium text-primary">
                  {createLabel} “{trimmed}”
                </Text>
              </ActionsheetItem>
            ) : null}

            {noneLabel && !trimmed ? (
              <OptionItem label={noneLabel} selected={value === null} onPress={() => choose(null)} />
            ) : null}

            {visible.map((option) => (
              <OptionItem
                key={option.value}
                {...option}
                selected={option.value === value}
                onPress={() => choose(option.value)}
              />
            ))}

            {visible.length === 0 && !onCreate ? (
              <Text className="py-6 text-center text-sm text-muted-foreground">Nothing matches “{trimmed}”</Text>
            ) : null}

            {onCreate && !trimmed ? (
              <ActionsheetItem onPress={() => { onCreate(''); close(); }} className="rounded-2xl">
                <Box className="h-8 w-8 items-center justify-center rounded-xl bg-primary/10">
                  <Icon as={AddIcon} size="sm" className="text-primary" />
                </Box>
                <Text className="flex-1 text-base font-medium text-primary">{createLabel}</Text>
              </ActionsheetItem>
            ) : null}
          </ActionsheetScrollView>
        </ActionsheetContent>
      </Actionsheet>
    </FieldShell>
  );
}

type OptionItemProps = Omit<SelectOption, 'value'> & {
  selected: boolean;
  onPress: () => void;
};

function OptionItem({ label, description, leading, trailing, selected, onPress }: OptionItemProps) {
  return (
    <ActionsheetItem onPress={onPress} className={`rounded-2xl ${selected ? 'bg-secondary' : ''}`}>
      {leading}
      <Box className="flex-1">
        <Text numberOfLines={1} className="text-base text-foreground">
          {label}
        </Text>
        {description ? (
          <Text numberOfLines={1} className="text-xs text-muted-foreground">
            {description}
          </Text>
        ) : null}
      </Box>
      {trailing ? <Text className="text-sm tabular-nums text-muted-foreground">{trailing}</Text> : null}
      <HStack className="w-5 justify-end">
        {selected ? <Icon as={CheckIcon} size="sm" className="text-primary" /> : null}
      </HStack>
    </ActionsheetItem>
  );
}
