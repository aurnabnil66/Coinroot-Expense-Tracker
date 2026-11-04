import { Box } from '@/lib/gluestack-ui/box';
import { HStack } from '@/lib/gluestack-ui/hstack';
import { Icon, LinkIcon } from '@/lib/gluestack-ui/icon';
import { Pressable } from '@/lib/gluestack-ui/pressable';
import { Text } from '@/lib/gluestack-ui/text';
import { useRipple } from '@/lib/hooks';
import { VStack } from '@/lib/gluestack-ui/vstack';
import type { Transaction } from '@/lib/types';
import { AmountText } from '@/lib/ui';
import { formatDayLabel, formatTaka } from '@/lib/utils';

import { TransactionTypeIcon } from './transaction-type-icon.component';

type TransactionRowProps = {
  transaction: Transaction;
  nameOf: (id: string) => string;
  /** What's left of this transaction's money after linked entries (shown when it has any). */
  remaining?: number;
  onPress?: () => void;
  /** Show the date in the subtitle (for lists not grouped by day). */
  showDate?: boolean;
  divider?: boolean;
};

export function transactionTitle(tx: Transaction, nameOf: (id: string) => string): string {
  if (tx.type === 'transfer') return `${nameOf(tx.fromId)} → ${nameOf(tx.toId)}`;
  return tx.type === 'expense' ? nameOf(tx.toId) : nameOf(tx.fromId);
}

function subtitle(tx: Transaction, nameOf: (id: string) => string, showDate?: boolean): string {
  const account = tx.type === 'expense' ? nameOf(tx.fromId) : tx.type === 'income' ? nameOf(tx.toId) : null;
  const party = tx.type === 'income' && tx.party ? `from ${tx.party}` : null;
  return [showDate ? formatDayLabel(tx.date) : null, account, party, tx.note || null].filter(Boolean).join(' · ');
}

export function TransactionRow({ transaction: tx, nameOf, remaining, onPress, showDate, divider }: TransactionRowProps) {
  const detail = subtitle(tx, nameOf, showDate);
  const ripple = useRipple();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      android_ripple={onPress ? ripple : undefined}
      className="data-[active=true]:bg-accent"
      accessibilityRole="button">
      <HStack className={`items-center gap-3 px-4 py-3 ${divider ? 'border-t border-border/70' : ''}`}>
        <TransactionTypeIcon type={tx.type} />
        <Box className="flex-1">
          <HStack className="items-center gap-1">
            <Text numberOfLines={1} className="shrink text-base font-medium text-foreground">
              {transactionTitle(tx, nameOf)}
            </Text>
            {tx.parentId ? <Icon as={LinkIcon} size="2xs" className="text-muted-foreground" /> : null}
          </HStack>
          {detail ? (
            <Text numberOfLines={1} className="text-sm text-muted-foreground">
              {detail}
            </Text>
          ) : null}
        </Box>
        <VStack className="items-end">
          <AmountText
            amount={tx.amount}
            outflow={tx.type === 'expense'}
            signed={tx.type === 'income'}
            tone={tx.type === 'income' ? 'income' : 'default'}
            className="text-base"
          />
          {remaining !== undefined ? (
            <Text className={`text-xs tabular-nums ${remaining < 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
              {formatTaka(remaining)} left
            </Text>
          ) : null}
        </VStack>
      </HStack>
    </Pressable>
  );
}
