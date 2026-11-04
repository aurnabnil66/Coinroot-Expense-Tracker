import { Box } from '@/lib/gluestack-ui/box';
import { ArrowDownIcon, ArrowUpIcon, Icon, RepeatIcon } from '@/lib/gluestack-ui/icon';
import type { TransactionType } from '@/lib/types';

const styles: Record<TransactionType, { icon: typeof ArrowUpIcon; box: string; color: string }> = {
  expense: { icon: ArrowUpIcon, box: 'bg-expense/20 dark:bg-expense/25', color: 'text-expense' },
  income: { icon: ArrowDownIcon, box: 'bg-income/20 dark:bg-income/25', color: 'text-income' },
  transfer: { icon: RepeatIcon, box: 'bg-transfer/20 dark:bg-transfer/25', color: 'text-transfer' },
};

/** Money out (arrow up), money in (arrow down) or moved between own accounts (repeat). */
export function TransactionTypeIcon({ type, size = 'md' }: { type: TransactionType; size?: 'sm' | 'md' }) {
  const style = styles[type];
  return (
    <Box className={`${size === 'sm' ? 'h-9 w-9 rounded-xl' : 'h-11 w-11 rounded-2xl'} items-center justify-center ${style.box}`}>
      <Icon as={style.icon} size={size === 'sm' ? 'xs' : 'sm'} className={style.color} />
    </Box>
  );
}
