import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert } from 'react-native';

import { LedgerPending, TransactionRow, TransactionTypeIcon, transactionTitle } from '@/lib/components';
import { TRANSACTION_FIELD_LABELS, TRANSACTION_TYPE_LABELS } from '@/lib/constants';
import { Button, ButtonIcon, ButtonText } from '@/lib/gluestack-ui/button';
import { HStack } from '@/lib/gluestack-ui/hstack';
import { AddIcon } from '@/lib/gluestack-ui/icon';
import { Pressable } from '@/lib/gluestack-ui/pressable';
import { Text } from '@/lib/gluestack-ui/text';
import { useLedger } from '@/lib/hooks';
import { ledgerStore } from '@/lib/mocks';
import { AmountText, ButtonLoader, Card, EmptyState, ListRow, ScreenContainer, SectionHeader } from '@/lib/ui';
import { childrenOf, formatFullDate, nameLookup, remainingOf } from '@/lib/utils';

export function TransactionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { status, error, accounts, categories, transactions } = useLedger();
  const nameOf = useMemo(() => nameLookup(accounts, categories), [accounts, categories]);
  const [deleting, setDeleting] = useState(false);
  const tx = transactions.find((t) => t.id === id);

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

  const parent = tx.parentId ? transactions.find((t) => t.id === tx.parentId) : undefined;
  const children = childrenOf(tx.id, transactions);
  const remaining = remainingOf(tx, transactions);
  // Money that landed in an account can be spent from — that's what gets linked (the tree).
  const canHaveChildren = tx.type !== 'expense';
  const labels = TRANSACTION_FIELD_LABELS[tx.type];
  const open = (target: string) => router.push({ pathname: '/transaction/[id]', params: { id: target } });

  const confirmDelete = () =>
    Alert.alert('Delete transaction?', 'Entries linked to it stay, but lose the link.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setDeleting(true);
          try {
            await ledgerStore.deleteTransaction(tx.id);
            router.back();
          } catch {
            setDeleting(false);
            Alert.alert('Could not delete', 'Please try again.');
          }
        },
      },
    ]);

  return (
    <ScreenContainer>
      <Stack.Screen
        options={{
          title: TRANSACTION_TYPE_LABELS[tx.type],
          headerRight: () => (
            <Pressable
              onPress={() => router.push({ pathname: '/transaction-form', params: { id: tx.id } })}
              hitSlop={8}
              accessibilityRole="button">
              <Text className="text-base font-semibold text-primary">Edit</Text>
            </Pressable>
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
              remaining={remainingOf(parent, transactions)}
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
            variant="outline"
            size="lg"
            className="mt-3 h-12 rounded-xl"
            onPress={() => router.push({ pathname: '/transaction-form', params: { parentId: tx.id } })}>
            <ButtonIcon as={AddIcon} />
            <ButtonText className="text-base font-semibold">Add linked expense</ButtonText>
          </Button>
        </>
      ) : null}

      <Button variant="ghost" size="lg" className="mt-6 h-12 rounded-xl" onPress={confirmDelete} isDisabled={deleting}>
        {deleting ? <ButtonLoader tone="destructive" /> : null}
        <ButtonText className="text-base font-semibold text-destructive">Delete transaction</ButtonText>
      </Button>
    </ScreenContainer>
  );
}
