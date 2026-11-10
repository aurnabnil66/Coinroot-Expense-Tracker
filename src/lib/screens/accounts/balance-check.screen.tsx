import { zodResolver } from '@hookform/resolvers/zod';
import { router, useLocalSearchParams } from 'expo-router';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { View } from 'react-native';

import { LedgerPending } from '@/lib/components';
import { BALANCE_ADJUSTMENT_CATEGORY } from '@/lib/constants';
import { Box } from '@/lib/gluestack-ui/box';
import { HStack } from '@/lib/gluestack-ui/hstack';
import { Text } from '@/lib/gluestack-ui/text';
import { VStack } from '@/lib/gluestack-ui/vstack';
import { useLedger } from '@/lib/hooks';
import { ledgerStore } from '@/lib/db';
import {
  type BalanceCheckFormInput,
  type BalanceCheckFormValues,
  balanceCheckFormDefaults,
  balanceCheckFormSchema,
} from '@/lib/schemas';
import type { Account } from '@/lib/types';
import { AmountField, AmountText, Button, Card, EmptyState, ModalHeader, ScreenContainer } from '@/lib/ui';
import { accountBalance, balanceAdjustment, findCategoryByName, formatTaka, parseTaka, todayKey } from '@/lib/utils';

const titleFor = (account?: Account) => (account?.type === 'cash' ? 'Count cash' : 'Check balance');

/**
 * Compare what's really in an account with what the app has recorded. A difference is
 * saved as a "Balance adjustment" expense (money missing) or income (extra money).
 */
export function BalanceCheckScreen() {
  const { status, error } = useLedger();
  if (status === 'ready') return <BalanceCheckForm />;
  return (
    <View className="flex-1 bg-background">
      <ModalHeader title="Check balance" onClose={() => router.back()} />
      <LedgerPending status={status} error={error} />
    </View>
  );
}

function BalanceCheckForm() {
  const { accountId } = useLocalSearchParams<{ accountId?: string }>();
  const { accounts, categories, transactions } = useLedger();
  const account = accounts.find((a) => a.id === accountId);

  const {
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<BalanceCheckFormInput, unknown, BalanceCheckFormValues>({
    resolver: zodResolver(balanceCheckFormSchema),
    defaultValues: balanceCheckFormDefaults(),
    mode: 'onTouched',
  });
  const actualText = useWatch({ control, name: 'actual' });

  if (!account) {
    return (
      <View className="flex-1 bg-background">
        <ModalHeader title="Check balance" onClose={() => router.back()} />
        <EmptyState title="Account not found" />
      </View>
    );
  }

  const recorded = accountBalance(account, transactions);
  const actual = actualText.trim() ? parseTaka(actualText) : null;
  const adjustment = actual === null ? null : balanceAdjustment(recorded, actual);
  const isCash = account.type === 'cash';

  const onSubmit = async (values: BalanceCheckFormValues) => {
    const change = balanceAdjustment(recorded, values.actual);
    if (!change) {
      router.back();
      return;
    }
    try {
      const kind = change.type === 'expense' ? 'expense' : 'income_source';
      const category =
        findCategoryByName(categories, kind, BALANCE_ADJUSTMENT_CATEGORY) ??
        (await ledgerStore.addCategory({ name: BALANCE_ADJUSTMENT_CATEGORY, kind, icon: null, color: 'slate', archived: false }));
      await ledgerStore.addTransaction({
        type: change.type,
        date: todayKey(),
        fromId: change.type === 'expense' ? account.id : category.id,
        toId: change.type === 'expense' ? category.id : account.id,
        amount: change.amount,
        note: isCash ? 'Cash count' : 'Balance check',
        parentId: null,
        party: null,
      });
      router.back();
    } catch {
      setError('root', { message: 'Could not update the balance. Please try again.' });
    }
  };

  return (
    <View className="flex-1 bg-background">
      <ModalHeader title={titleFor(account)} onClose={() => router.back()} />
      <ScreenContainer>
        <VStack className="gap-5 pt-5">
          <Card className="flex-row items-center justify-between gap-3 p-4">
            <VStack className="flex-1">
              <Text className="text-sm font-medium text-muted-foreground">Recorded in Coinroot</Text>
              <Text className="text-xs text-muted-foreground">{account.name}</Text>
            </VStack>
            <AmountText amount={recorded} className="text-xl" />
          </Card>

          <VStack className="items-center">
            <Text className="text-sm font-medium text-muted-foreground">
              {isCash ? 'Count your cash. How much do you have?' : 'How much is in it right now?'}
            </Text>
            <Controller
              control={control}
              name="actual"
              render={({ field, fieldState }) => (
                <AmountField
                  value={field.value}
                  onChangeText={field.onChange}
                  onBlur={field.onBlur}
                  error={fieldState.error?.message}
                  signClass="text-primary"
                  autoFocus
                />
              )}
            />
          </VStack>

          {adjustment ? (
            <Box className={`gap-1 rounded-xl p-4 ${adjustment.type === 'expense' ? 'bg-expense/20 dark:bg-expense/25' : 'bg-income/20 dark:bg-income/25'}`}>
              <Text className={`text-base font-semibold ${adjustment.type === 'expense' ? 'text-expense' : 'text-income'}`}>
                {formatTaka(adjustment.amount)} {adjustment.type === 'expense' ? 'less' : 'more'} than recorded
              </Text>
              <Text className="text-sm text-foreground">
                {adjustment.type === 'expense'
                  ? `Saved as spending in “${BALANCE_ADJUSTMENT_CATEGORY}”, so the balance matches what you have.`
                  : `Saved as income in “${BALANCE_ADJUSTMENT_CATEGORY}”, so the balance matches what you have.`}
              </Text>
            </Box>
          ) : actual !== null ? (
            <HStack className="items-center gap-2 rounded-xl bg-income/20 p-4 dark:bg-income/25">
              <Text className="text-base font-semibold text-income">Matches the app. Nothing to change.</Text>
            </HStack>
          ) : (
            <Text className="text-center text-sm text-muted-foreground">
              If it doesn&apos;t match, the difference is recorded so the balance is right again.
            </Text>
          )}

          {errors.root ? <Text className="text-sm text-destructive">{errors.root.message}</Text> : null}

          <Button
            label={adjustment ? 'Update balance' : 'Done'}
            loading={isSubmitting}
            disabled={actual === null}
            onPress={() => void handleSubmit(onSubmit)()}
          />
        </VStack>
      </ScreenContainer>
    </View>
  );
}
