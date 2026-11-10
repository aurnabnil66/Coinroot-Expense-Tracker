import { router } from 'expo-router';
import { useMemo } from 'react';

import { BALANCE_ADJUSTMENT_CATEGORY, TRANSACTION_TYPE_LABELS } from '@/lib/constants';
import { Box } from '@/lib/gluestack-ui/box';
import { HStack } from '@/lib/gluestack-ui/hstack';
import { AddIcon, Icon } from '@/lib/gluestack-ui/icon';
import { Pressable } from '@/lib/gluestack-ui/pressable';
import { Text } from '@/lib/gluestack-ui/text';
import { VStack } from '@/lib/gluestack-ui/vstack';
import { useRipple } from '@/lib/hooks';
import { type Account, type Category, type Transaction, TRANSACTION_TYPES, type TransactionType } from '@/lib/types';
import { nameLookup, type QuickPreset, quickPresets } from '@/lib/utils';

import { TransactionTypeIcon } from './transaction-type-icon.component';

type QuickAddProps = {
  accounts: readonly Account[];
  categories: readonly Category[];
  transactions: readonly Transaction[];
};

const TYPE_BUTTON_CLASS: Record<TransactionType, string> = {
  expense: 'bg-expense/20 dark:bg-expense/25',
  income: 'bg-income/20 dark:bg-income/25',
  transfer: 'bg-transfer/20 dark:bg-transfer/25',
};

const TYPE_TEXT_CLASS: Record<TransactionType, string> = {
  expense: 'text-expense',
  income: 'text-income',
  transfer: 'text-transfer',
};

/** Simple mode: big buttons for the user's most frequent entries, plus one per transaction type. */
export function QuickAdd({ accounts, categories, transactions }: QuickAddProps) {
  const nameOf = useMemo(() => nameLookup(accounts, categories), [accounts, categories]);
  const presets = useMemo(() => {
    // Only offer combinations whose accounts and categories still exist and aren't archived,
    // and skip balance adjustments, which only come from Count cash / Check balance.
    const active = new Set(
      [...accounts, ...categories]
        .filter((item) => !item.archived && item.name.toLowerCase() !== BALANCE_ADJUSTMENT_CATEGORY.toLowerCase())
        .map((item) => item.id)
    );
    return quickPresets(transactions, 8)
      .filter((p) => active.has(p.fromId) && active.has(p.toId))
      .slice(0, 4);
  }, [accounts, categories, transactions]);

  const open = (params: { type: TransactionType; fromId?: string; toId?: string }) =>
    router.push({ pathname: '/transaction-form', params });

  const rows: QuickPreset[][] = [];
  for (let i = 0; i < presets.length; i += 2) rows.push(presets.slice(i, i + 2));

  return (
    <VStack className="gap-3 pt-5">
      <Text className="text-sm font-bold text-foreground">Quick add</Text>
      {rows.map((row, index) => (
        <HStack key={index} className="gap-3">
          {row.map((preset) => (
            // Equal-width slots, so a lone tile in the last row still takes exactly half.
            <Box key={`${preset.type}|${preset.fromId}|${preset.toId}`} className="flex-1">
              <PresetTile
                type={preset.type}
                title={presetTitle(preset, nameOf)}
                subtitle={presetSubtitle(preset, nameOf)}
                onPress={() => open(preset)}
              />
            </Box>
          ))}
          {row.length === 1 ? <Box className="flex-1" /> : null}
        </HStack>
      ))}
      <HStack className="gap-2">
        {TRANSACTION_TYPES.map((type) => (
          <Pressable
            key={type}
            onPress={() => open({ type })}
            accessibilityRole="button"
            accessibilityLabel={`Add ${TRANSACTION_TYPE_LABELS[type].toLowerCase()}`}
            className={`h-12 flex-1 flex-row items-center justify-center gap-1.5 rounded-xl data-[active=true]:opacity-70 ${TYPE_BUTTON_CLASS[type]}`}>
            <Icon as={AddIcon} size="sm" className={TYPE_TEXT_CLASS[type]} />
            <Text className={`text-sm font-semibold ${TYPE_TEXT_CLASS[type]}`}>{TRANSACTION_TYPE_LABELS[type]}</Text>
          </Pressable>
        ))}
      </HStack>
    </VStack>
  );
}

function presetTitle(p: QuickPreset, nameOf: (id: string) => string): string {
  if (p.type === 'expense') return nameOf(p.toId);
  if (p.type === 'income') return nameOf(p.fromId);
  return `${nameOf(p.fromId)} → ${nameOf(p.toId)}`;
}

function presetSubtitle(p: QuickPreset, nameOf: (id: string) => string): string {
  if (p.type === 'expense') return `from ${nameOf(p.fromId)}`;
  if (p.type === 'income') return `into ${nameOf(p.toId)}`;
  return 'Transfer';
}

type PresetTileProps = {
  type: TransactionType;
  title: string;
  subtitle: string;
  onPress: () => void;
};

function PresetTile({ type, title, subtitle, onPress }: PresetTileProps) {
  const ripple = useRipple();
  return (
    // Android draws the ripple over the whole rectangle, so a rounded parent clips it.
    <Box className="overflow-hidden rounded-xl">
      <Pressable
        onPress={onPress}
        android_ripple={ripple}
        accessibilityRole="button"
        accessibilityLabel={`Add ${title}, ${subtitle}`}
        className="gap-3 overflow-hidden rounded-xl border border-border/70 bg-card p-4 data-[active=true]:bg-accent">
        <TransactionTypeIcon type={type} />
        <VStack>
          <Text numberOfLines={1} className="text-base font-semibold text-foreground">
            {title}
          </Text>
          <Text numberOfLines={1} className="text-sm text-muted-foreground">
            {subtitle}
          </Text>
        </VStack>
      </Pressable>
    </Box>
  );
}
