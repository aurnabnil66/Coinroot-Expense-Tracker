import { zodResolver } from '@hookform/resolvers/zod';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { Alert, View } from 'react-native';

import { transactionTitle } from '@/lib/components';
import {
  ACCOUNT_TYPE_COLORS,
  CATEGORY_COLORS,
  DEFAULT_CATEGORY_COLOR,
  TRANSACTION_FIELD_LABELS,
  TRANSACTION_TYPE_LABELS,
} from '@/lib/constants';
import { Button, ButtonText } from '@/lib/gluestack-ui/button';
import { Text } from '@/lib/gluestack-ui/text';
import { VStack } from '@/lib/gluestack-ui/vstack';
import { useLedger } from '@/lib/hooks';
import { ledgerStore, type LedgerSnapshot } from '@/lib/mocks';
import {
  type TransactionFormInput,
  type TransactionFormValues,
  transactionFormDefaults,
  transactionFormSchema,
} from '@/lib/schemas';
import { TRANSACTION_TYPES, type CategoryKind, type TransactionType } from '@/lib/types';
import {
  AmountField,
  DateField,
  FormTextField,
  InitialBadge,
  ModalHeader,
  ScreenContainer,
  SegmentedControl,
  type SelectOption,
  SelectField,
} from '@/lib/ui';
import {
  accountBalances,
  formatDayLabel,
  formatTaka,
  formatTakaInput,
  linkableParents,
  nameLookup,
  remainingOf,
} from '@/lib/utils';

const TYPE_OPTIONS = TRANSACTION_TYPES.map((value) => ({ value, label: TRANSACTION_TYPE_LABELS[value] }));
const AMOUNT_TONE: Record<TransactionType, string> = {
  expense: 'text-foreground',
  income: 'text-income',
  transfer: 'text-foreground',
};

type Side = 'from' | 'to';
/** Which list each picker draws from, per transaction type. */
const SOURCES: Record<TransactionType, Record<Side, 'account' | CategoryKind>> = {
  expense: { from: 'account', to: 'expense' },
  income: { from: 'income_source', to: 'account' },
  transfer: { from: 'account', to: 'account' },
};

function initialValues(ledger: LedgerSnapshot, id?: string, parentId?: string): TransactionFormInput {
  const existing = id ? ledger.transactions.find((tx) => tx.id === id) : undefined;
  if (existing) {
    return {
      type: existing.type,
      date: existing.date,
      fromId: existing.fromId,
      toId: existing.toId,
      amount: formatTakaInput(existing.amount),
      note: existing.note,
      parentId: existing.parentId,
    };
  }
  const parent = parentId ? ledger.transactions.find((tx) => tx.id === parentId) : undefined;
  if (parent) {
    // Spending money that came from `parent`: it leaves the account the parent paid into.
    return { ...transactionFormDefaults(), date: parent.date, fromId: parent.toId, parentId: parent.id };
  }
  return transactionFormDefaults();
}

export function TransactionFormScreen() {
  const { id, parentId } = useLocalSearchParams<{ id?: string; parentId?: string }>();
  const ledger = useLedger();
  const { accounts, categories, transactions } = ledger;
  const isEdit = Boolean(id);

  const {
    control,
    handleSubmit,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<TransactionFormInput, unknown, TransactionFormValues>({
    resolver: zodResolver(transactionFormSchema),
    defaultValues: initialValues(ledger, id, parentId),
    mode: 'onTouched',
  });
  const [type, fromId, toId, linkedId] = useWatch({ control, name: ['type', 'fromId', 'toId', 'parentId'] });

  const nameOf = useMemo(() => nameLookup(accounts, categories), [accounts, categories]);
  const balances = useMemo(() => accountBalances(accounts, transactions), [accounts, transactions]);

  const optionsFor = (side: Side): SelectOption[] => {
    const source = SOURCES[type][side];
    const current = side === 'from' ? fromId : toId;
    const other = side === 'from' ? toId : fromId;
    if (source === 'account') {
      return accounts
        .filter((a) => (!a.archived || a.id === current) && !(type === 'transfer' && a.id === other))
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((a) => ({
          value: a.id,
          label: a.name,
          trailing: formatTaka(balances.get(a.id) ?? 0),
          leading: <InitialBadge label={a.name} color={CATEGORY_COLORS[ACCOUNT_TYPE_COLORS[a.type]]} size="sm" />,
        }));
    }
    return categories
      .filter((c) => c.kind === source && (!c.archived || c.id === current))
      .map((c) => ({
        value: c.id,
        label: c.name,
        leading: <InitialBadge label={c.name} color={CATEGORY_COLORS[c.color ?? DEFAULT_CATEGORY_COLOR]} size="sm" />,
      }));
  };

  const createFor = (side: Side) => (name: string) => {
    const source = SOURCES[type][side];
    const field = side === 'from' ? 'fromId' : 'toId';
    if (source === 'account') {
      // Accounts need a type and opening balance, so they get the full form.
      router.push({ pathname: '/account-form', params: name ? { name } : {} });
      return;
    }
    if (!name) {
      router.push({ pathname: '/category-form', params: { kind: source } });
      return;
    }
    const used = new Set(categories.map((c) => c.color));
    const color = Object.keys(CATEGORY_COLORS).find((key) => !used.has(key)) ?? DEFAULT_CATEGORY_COLOR;
    const created = ledgerStore.addCategory({ name, kind: source, color, icon: null, archived: false });
    setValue(field, created.id, { shouldValidate: true });
  };

  // "Linked to": money that went into the account this entry spends from (Design B: ATM → Cash → expenses).
  const parentOptions: SelectOption[] =
    type === 'income' || !fromId
      ? []
      : linkableParents(fromId, transactions, id).map((tx) => ({
          value: tx.id,
          label: transactionTitle(tx, nameOf),
          description: [formatDayLabel(tx.date), formatTaka(tx.amount), tx.note].filter(Boolean).join(' · '),
          trailing: `${formatTaka(remainingOf(tx, transactions))} left`,
        }));

  const changeType = (next: TransactionType) => {
    if (next === type) return;
    setValue('type', next);
    setValue('fromId', '');
    setValue('toId', '');
    setValue('parentId', null);
  };

  const onSubmit = (values: TransactionFormValues) => {
    try {
      const input = { ...values, parentId: values.type === 'income' ? null : values.parentId };
      if (id) ledgerStore.updateTransaction(id, input);
      else ledgerStore.addTransaction(input);
      router.back();
    } catch {
      setError('root', { message: 'Could not save. Please try again.' });
    }
  };

  const confirmDelete = () => {
    if (!id) return;
    Alert.alert('Delete transaction?', 'Entries linked to it stay, but lose the link.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          ledgerStore.deleteTransaction(id);
          router.dismissAll();
        },
      },
    ]);
  };

  const labels = TRANSACTION_FIELD_LABELS[type];
  const showLink = type !== 'income' && (parentOptions.length > 0 || linkedId !== null);

  return (
    <View className="flex-1 bg-background">
      <ModalHeader title={isEdit ? 'Edit transaction' : 'New transaction'} onClose={() => router.back()} />
      <ScreenContainer>
        <VStack className="gap-5 pt-5">
          <SegmentedControl
            options={TYPE_OPTIONS}
            value={type}
            onChange={changeType}
            selectedClass={{ income: 'bg-income', expense: 'bg-expense', transfer: 'bg-transfer' }}
          />

          <Controller
            control={control}
            name="amount"
            render={({ field, fieldState }) => (
              <AmountField
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                error={fieldState.error?.message}
                toneClass={AMOUNT_TONE[type]}
                autoFocus={!isEdit}
              />
            )}
          />

          <Controller
            control={control}
            name="fromId"
            render={({ field, fieldState }) => (
              <SelectField
                label={labels.from}
                value={field.value || null}
                options={optionsFor('from')}
                onChange={(value) => {
                  field.onChange(value ?? '');
                  setValue('parentId', null);
                }}
                onBlur={field.onBlur}
                error={fieldState.error?.message}
                onCreate={createFor('from')}
                createLabel={SOURCES[type].from === 'account' ? 'New account' : 'New income source'}
              />
            )}
          />

          <Controller
            control={control}
            name="toId"
            render={({ field, fieldState }) => (
              <SelectField
                label={labels.to}
                value={field.value || null}
                options={optionsFor('to')}
                onChange={(value) => field.onChange(value ?? '')}
                onBlur={field.onBlur}
                error={fieldState.error?.message}
                onCreate={createFor('to')}
                createLabel={SOURCES[type].to === 'account' ? 'New account' : 'New category'}
              />
            )}
          />

          <Controller
            control={control}
            name="date"
            render={({ field, fieldState }) => (
              <DateField label="Date" value={field.value} onChange={field.onChange} error={fieldState.error?.message} />
            )}
          />

          <Controller
            control={control}
            name="note"
            render={({ field, fieldState }) => (
              <FormTextField
                label="Note"
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                error={fieldState.error?.message}
                placeholder="Shop, place or details (optional)"
                maxLength={200}
              />
            )}
          />

          {showLink ? (
            <Controller
              control={control}
              name="parentId"
              render={({ field }) => (
                <SelectField
                  label="Linked to"
                  sheetTitle="Where did this money come from?"
                  value={field.value}
                  options={parentOptions}
                  onChange={field.onChange}
                  placeholder="Not linked"
                  noneLabel="Not linked"
                  hint="e.g. the ATM withdrawal this was paid from. Optional."
                />
              )}
            />
          ) : null}

          {errors.root ? <Text className="text-sm text-destructive">{errors.root.message}</Text> : null}

          <Button size="lg" className="h-12 rounded-xl" onPress={() => void handleSubmit(onSubmit)()} isDisabled={isSubmitting}>
            <ButtonText className="text-base font-semibold">{isEdit ? 'Save changes' : 'Add transaction'}</ButtonText>
          </Button>

          {isEdit ? (
            <Button variant="ghost" size="lg" className="h-12 rounded-xl" onPress={confirmDelete}>
              <ButtonText className="text-base font-semibold text-destructive">Delete transaction</ButtonText>
            </Button>
          ) : null}
        </VStack>
      </ScreenContainer>
    </View>
  );
}
