import { zodResolver } from '@hookform/resolvers/zod';
import { router, useLocalSearchParams } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { View } from 'react-native';

import { Button, ButtonText } from '@/lib/gluestack-ui/button';
import { Text } from '@/lib/gluestack-ui/text';
import { VStack } from '@/lib/gluestack-ui/vstack';
import { LedgerPending } from '@/lib/components';
import { useLedger } from '@/lib/hooks';
import { ledgerStore } from '@/lib/mocks';
import { type AccountFormInput, type AccountFormValues, accountFormDefaults, accountFormSchema } from '@/lib/schemas';
import type { AccountType } from '@/lib/types';
import { ButtonLoader, DateField, FieldShell, FormTextField, ModalHeader, ScreenContainer, SegmentedControl, SwitchRow } from '@/lib/ui';
import { formatTakaInput } from '@/lib/utils';

const TYPE_OPTIONS: { value: AccountType; label: string }[] = [
  { value: 'bank', label: 'Bank' },
  { value: 'cash', label: 'Cash' },
  { value: 'mobile_wallet', label: 'Wallet' },
  { value: 'savings', label: 'Savings' },
];

export function AccountFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { status, error } = useLedger();
  if (status === 'ready') return <AccountForm />;
  return (
    <View className="flex-1 bg-background">
      <ModalHeader title={id ? 'Edit account' : 'New account'} onClose={() => router.back()} />
      <LedgerPending status={status} error={error} />
    </View>
  );
}

/** Mounted once the ledger is loaded, so the default values come from real data. */
function AccountForm() {
  const { id, name } = useLocalSearchParams<{ id?: string; name?: string }>();
  const { accounts } = useLedger();
  const existing = id ? accounts.find((a) => a.id === id) : undefined;

  const {
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<AccountFormInput, unknown, AccountFormValues>({
    resolver: zodResolver(accountFormSchema),
    defaultValues: existing
      ? {
          name: existing.name,
          type: existing.type,
          openingBalance: formatTakaInput(existing.openingBalance),
          openingDate: existing.openingDate,
          archived: existing.archived,
        }
      : { ...accountFormDefaults(), name: name ?? '' },
    mode: 'onTouched',
  });

  const onSubmit = async (values: AccountFormValues) => {
    try {
      const input = { ...values, savings: existing?.savings ?? null };
      if (existing) await ledgerStore.updateAccount(existing.id, input);
      else await ledgerStore.addAccount(input);
      router.back();
    } catch {
      setError('root', { message: 'Could not save. Please try again.' });
    }
  };

  return (
    <View className="flex-1 bg-background">
      <ModalHeader title={existing ? 'Edit account' : 'New account'} onClose={() => router.back()} />
      <ScreenContainer>
        <VStack className="gap-5 pt-5">
          <Controller
            control={control}
            name="name"
            render={({ field, fieldState }) => (
              <FormTextField
                label="Name"
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                error={fieldState.error?.message}
                placeholder="e.g. Main Bank, Cash, Mobile Wallet"
                autoFocus={!existing && !name}
                maxLength={40}
              />
            )}
          />

          <Controller
            control={control}
            name="type"
            render={({ field }) => (
              <FieldShell label="Type" hint={field.value === 'savings' ? 'DPS and other savings. Deposits show as “moved to savings”, not spending.' : undefined}>
                <SegmentedControl options={TYPE_OPTIONS} value={field.value} onChange={field.onChange} />
              </FieldShell>
            )}
          />

          <Controller
            control={control}
            name="openingBalance"
            render={({ field, fieldState }) => (
              <FormTextField
                label="Opening balance (৳)"
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                error={fieldState.error?.message}
                hint="Money in the account at the start of the date below. Not counted as income."
                placeholder="0"
                keyboardType="decimal-pad"
              />
            )}
          />

          <Controller
            control={control}
            name="openingDate"
            render={({ field, fieldState }) => (
              <DateField label="As of" value={field.value} onChange={field.onChange} error={fieldState.error?.message} />
            )}
          />

          {existing ? (
            <Controller
              control={control}
              name="archived"
              render={({ field }) => (
                <SwitchRow
                  label="Archived"
                  description="Hidden from pickers and totals. History stays."
                  value={field.value}
                  onValueChange={field.onChange}
                />
              )}
            />
          ) : null}

          {errors.root ? <Text className="text-sm text-destructive">{errors.root.message}</Text> : null}

          <Button size="lg" className="h-12 rounded-xl" onPress={() => void handleSubmit(onSubmit)()} isDisabled={isSubmitting}>
            {isSubmitting ? <ButtonLoader /> : null}
            <ButtonText className="text-base font-semibold">{existing ? 'Save changes' : 'Add account'}</ButtonText>
          </Button>
        </VStack>
      </ScreenContainer>
    </View>
  );
}
