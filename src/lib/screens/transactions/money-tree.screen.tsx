import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';

import { LedgerPending, TransactionRow, transactionTitle } from '@/lib/components';
import { Box } from '@/lib/gluestack-ui/box';
import { HStack } from '@/lib/gluestack-ui/hstack';
import { ChevronDownIcon, ChevronRightIcon, Icon } from '@/lib/gluestack-ui/icon';
import { Pressable } from '@/lib/gluestack-ui/pressable';
import { Text } from '@/lib/gluestack-ui/text';
import { VStack } from '@/lib/gluestack-ui/vstack';
import { getMoneyTree } from '@/lib/db';
import { useLedger, useLedgerQuery, useRipple } from '@/lib/hooks';
import { AmountText, Card, EmptyState, GradientCard, GradientStat, ScreenContainer } from '@/lib/ui';
import { flattenMoneyTree, formatFullDate, type MoneyTree, MONEY_TREE_MAX_NODES, type MoneyTreeNode, nameLookup } from '@/lib/utils';

/** Trees up to this size open fully; bigger ones open only along the way to the entry. */
const OPEN_ALL_UP_TO = 40;
/** Indent per level. */
const INDENT = 14;

/**
 * Nodes shown closed when the screen opens: none for a small tree; for a big one, every node
 * with children except the ones on the way from the root to the entry, and the entry itself.
 */
function initiallyClosed(tree: MoneyTree, entryId: string): Set<string> {
  if (tree.size <= OPEN_ALL_UP_TO) return new Set();
  const open = new Set([...tree.path.map((tx) => tx.id), entryId]);
  return new Set(flattenMoneyTree(tree.root).filter((node) => node.children.length > 0 && !open.has(node.tx.id)).map((node) => node.tx.id));
}

/**
 * The money tree of an entry (`money-tree/[id]`): where its money came from, up to the entry
 * that started the chain (e.g. the salary), and everything paid from that, level by level,
 * with what's left at each step. The entry it was opened from is highlighted.
 */
export function MoneyTreeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { status, error, accounts, categories } = useLedger();
  const nameOf = useMemo(() => nameLookup(accounts, categories), [accounts, categories]);
  const tree = useLedgerQuery((database) => getMoneyTree(database, id), [id]);
  // Nodes the user opened or closed, flipped against the initial state.
  const [flipped, setFlipped] = useState<ReadonlySet<string>>(new Set());

  const closed = useMemo(() => {
    const initial = tree ? initiallyClosed(tree, id) : new Set<string>();
    for (const nodeId of flipped) {
      if (initial.has(nodeId)) initial.delete(nodeId);
      else initial.add(nodeId);
    }
    return initial;
  }, [tree, id, flipped]);

  if (status !== 'ready') {
    return (
      <ScreenContainer>
        <Stack.Screen options={{ title: 'Money tree' }} />
        <LedgerPending status={status} error={error} />
      </ScreenContainer>
    );
  }

  if (!tree) {
    return (
      <ScreenContainer>
        <Stack.Screen options={{ title: 'Money tree' }} />
        <EmptyState title="Transaction not found" message="It may have been deleted." />
      </ScreenContainer>
    );
  }

  const root = tree.root.tx;
  const rows = flattenMoneyTree(tree.root, closed);
  const toggle = (nodeId: string) =>
    setFlipped((current) => {
      const next = new Set(current);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });

  return (
    <ScreenContainer>
      <Stack.Screen options={{ title: 'Money tree' }} />

      <GradientCard className="mb-4 mt-4 gap-4">
        <VStack className="gap-1">
          <Text className="text-xs font-medium uppercase tracking-wide text-white/75">Started with</Text>
          <Text className="text-base font-semibold text-white" numberOfLines={2}>
            {transactionTitle(root, nameOf)} · {formatFullDate(root.date)}
          </Text>
          <AmountText amount={root.amount} tone="onHero" weight="semibold" className="text-3xl leading-[40px]" />
        </VStack>
        <HStack className="gap-3">
          <GradientStat label="Spent">
            <AmountText amount={tree.spent} tone="onHero" weight="semibold" className="text-lg" />
          </GradientStat>
          <GradientStat label="Still in accounts">
            <AmountText amount={tree.left} tone="onHero" weight="semibold" className="text-lg" />
          </GradientStat>
        </HStack>
      </GradientCard>

      <Text className="px-1 pb-2 text-xs text-muted-foreground">
        Each step shows what&apos;s left of its money. Tap an entry to open it.
      </Text>

      <Card>
        {rows.map((node, index) => (
          <TreeRow
            key={node.tx.id}
            node={node}
            nameOf={nameOf}
            divider={index > 0}
            highlighted={node.tx.id === id}
            closed={closed.has(node.tx.id)}
            onToggle={() => toggle(node.tx.id)}
          />
        ))}
      </Card>

      {tree.truncated ? (
        <Text className="px-1 pt-3 text-xs text-muted-foreground">
          This tree is very large: it shows the first {MONEY_TREE_MAX_NODES} entries, nearest the start. The totals above count all of
          them.
        </Text>
      ) : null}
      {tree.size === 1 ? (
        <Text className="px-1 pt-3 text-sm text-muted-foreground">
          Nothing is linked to this entry yet. Use &quot;Linked to&quot; when you add an expense or transfer paid with this money.
        </Text>
      ) : null}
    </ScreenContainer>
  );
}

type TreeRowProps = {
  node: MoneyTreeNode;
  nameOf: (id: string) => string;
  divider: boolean;
  highlighted: boolean;
  closed: boolean;
  onToggle: () => void;
};

function TreeRow({ node, nameOf, divider, highlighted, closed, onToggle }: TreeRowProps) {
  const ripple = useRipple();
  const hasChildren = node.children.length > 0;
  return (
    <HStack
      className={`items-center ${divider ? 'border-t border-border' : ''} ${highlighted ? 'bg-primary/10' : ''}`}
      style={{ paddingLeft: node.depth * INDENT }}
    >
      {hasChildren ? (
        <Pressable
          onPress={onToggle}
          android_ripple={ripple}
          accessibilityRole="button"
          accessibilityLabel={closed ? `Show ${node.children.length} linked` : 'Hide linked entries'}
          className="h-12 w-9 items-center justify-center"
        >
          <Icon as={closed ? ChevronRightIcon : ChevronDownIcon} size="sm" className="text-muted-foreground" />
        </Pressable>
      ) : (
        <Box className="w-9" />
      )}
      <Box className="flex-1">
        <TransactionRow
          transaction={node.tx}
          nameOf={nameOf}
          showDate
          remaining={node.tx.type === 'expense' ? undefined : node.left}
          onPress={() => router.push({ pathname: '/transaction/[id]', params: { id: node.tx.id } })}
        />
        {closed ? (
          <Text className="-mt-2 pb-2 pl-4 text-xs text-muted-foreground">
            {node.children.length} linked {node.children.length === 1 ? 'entry' : 'entries'} hidden
          </Text>
        ) : null}
      </Box>
    </HStack>
  );
}
