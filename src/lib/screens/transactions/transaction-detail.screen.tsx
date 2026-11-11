import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';

import { LedgerPending, TransactionRow, TransactionTypeIcon, transactionTitle } from '@/lib/components';
import { TRANSACTION_FIELD_LABELS, TRANSACTION_TYPE_LABELS } from '@/lib/constants';
import { HStack } from '@/lib/gluestack-ui/hstack';
import { AddIcon, TrashIcon } from '@/lib/gluestack-ui/icon';
import { Text } from '@/lib/gluestack-ui/text';
import { getChildren, getChildTotals, getTransaction, ledgerStore, remainingFrom } from '@/lib/db';
import { useLedger, useLedgerQuery } from '@/lib/hooks';
import { AmountText, Button, Card, EmptyState, ListRow, ScreenContainer, SectionHeader, useDialog } from '@/lib/ui';
import { deleteTransactionMessage, formatFullDate, nameLookup } from '@/lib/utils';

export function TransactionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { status, error, accounts, categories } = useLedger();
  const nameOf = useMemo(() => nameLookup(accounts, categories), [accounts, categories]);
  const dialog = useDialog();
  // The entry, where its money came from, what was paid from it, and how much is left of each.
  const detail = useLedgerQuery(
    (database) => {
      const found = getTransaction(database, id);
      if (!found) return null;
      const parentTx = found.parentId ? getTransaction(database, found.parentId) : null;
      return {
        tx: found,
        parent: parentTx,
        children: getChildren(database, found.id),
        used: getChildTotals(database, parentTx ? [found.id, parentTx.id] : [found.id]),
      };
    },
    [id]
  );
  const tx = detail?.tx;

  if (status !== 'ready') {
    return (
      <ScreenContainer>
        <Stack.Screen options={{ title: 'Transaction' }} />
        <LedgerPending status={status} error={error} />
      </ScreenContainer>
    );
  }

  if (!tx) {
    return (
      <ScreenContainer>
        <EmptyState title="Transaction not found" message="It may have been deleted." />
      </ScreenContainer>
    );
  }

  const parent = detail?.parent ?? undefined;
  const children = detail?.children ?? [];
  const used = detail?.used ?? new Map<string, number>();
  const remaining = remainingFrom(tx, used);
  // Money that landed in an account can be spent from — that's what gets linked (the tree).
  const canHaveChildren = tx.type !== 'expense';
  const labels = TRANSACTION_FIELD_LABELS[tx.type];
  const open = (target: string) => router.push({ pathname: '/transaction/[id]', params: { id: target } });

  const confirmDelete = async () => {
    const deleted = await dialog.confirm({
      title: 'Delete transaction?',
      message: deleteTransactionMessage(children.length),
      tone: 'danger',
      icon: TrashIcon,
      confirmLabel: 'Delete',
      onConfirm: () => ledgerStore.deleteTransaction(tx.id),
    });
    if (deleted) router.back();
  };

  return (
    <ScreenContainer>
      <Stack.Screen
        options={{
          title: TRANSACTION_TYPE_LABELS[tx.type],
          headerRight: () => (
            <Button label="Edit" variant="link" size="md" onPress={() => router.push({ pathname: '/transaction-form', params: { id: tx.id } })} />
          ),
        }}
      />

      <Card className="mb-4 mt-4 items-center gap-2 px-5 py-7">
        <TransactionTypeIcon type={tx.type} />
        <AmountText
          amount={tx.amount}
          outflow={tx.type === 'expense'}
          signed={tx.type === 'income'}
          tone={tx.type === 'income' ? 'income' : 'default'}
          weight="semibold"
          className="text-4xl"
        />
        <Text className="text-center text-base text-muted-foreground">{transactionTitle(tx, nameOf)}</Text>
      </Card>

      <Card>
        <ListRow title={labels.from} trailing={nameOf(tx.fromId)} />
        <ListRow divider title={labels.to} trailing={nameOf(tx.toId)} />
        {tx.type === 'income' && tx.party ? <ListRow divider title="Received from" trailing={tx.party} /> : null}
        <ListRow divider title="Date" trailing={formatFullDate(tx.date)} />
        {tx.note ? <ListRow divider title="Note" subtitle={tx.note} /> : null}
      </Card>

      {parent ? (
        <>
          <SectionHeader title="Money came from" />
          <Card>
            <TransactionRow
              transaction={parent}
              nameOf={nameOf}
              showDate
              remaining={remainingFrom(parent, used)}
              onPress={() => open(parent.id)}
            />
          </Card>
        </>
      ) : null}

      {canHaveChildren ? (
        <>
          <SectionHeader title="Spent from this" right={children.length ? `${children.length} linked` : undefined} />
          <Card>
            {children.map((child, index) => (
              <TransactionRow
                key={child.id}
                transaction={child}
                nameOf={nameOf}
                showDate
                divider={index > 0}
                onPress={() => open(child.id)}
              />
            ))}
            {children.length === 0 ? (
              <Text className="px-4 py-4 text-sm text-muted-foreground">
                Nothing linked yet. Link what you paid with this money to see what&apos;s left.
              </Text>
            ) : null}
            <HStack className="items-center justify-between border-t border-border bg-muted/50 px-4 py-3">
              <Text className="text-sm font-semibold text-foreground">Left from this</Text>
              <AmountText amount={remaining} tone={remaining < 0 ? 'expense' : 'default'} className="text-base" />
            </HStack>
          </Card>
          <Button
            label="Add linked expense"
            variant="outline"
            icon={AddIcon}
            className="mt-3"
            onPress={() => router.push({ pathname: '/transaction-form', params: { parentId: tx.id } })}
          />
        </>
      ) : null}

      <Button label="Delete transaction" variant="ghost" color="danger" className="mt-6" onPress={() => void confirmDelete()} />
    </ScreenContainer>
  );
}
