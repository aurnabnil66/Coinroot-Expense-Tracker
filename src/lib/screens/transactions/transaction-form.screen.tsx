import { zodResolver } from '@hookform/resolvers/zod';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { View } from 'react-native';

import { LedgerPending, transactionTitle } from '@/lib/components';
import {
  ACCOUNT_TYPE_COLORS,
  CATEGORY_COLORS,
  DEFAULT_CATEGORY_COLOR,
  TRANSACTION_FIELD_LABELS,
  TRANSACTION_TYPE_LABELS,
  TRANSFER_FEE_CATEGORY,
} from '@/lib/constants';
import { Button, ButtonText } from '@/lib/gluestack-ui/button';
import { TrashIcon } from '@/lib/gluestack-ui/icon';
import { Text } from '@/lib/gluestack-ui/text';
import { VStack } from '@/lib/gluestack-ui/vstack';
import { useCategoryColors, useLedger, useSimpleMode } from '@/lib/hooks';
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
  ButtonLoader,
  DateField,
  FormTextField,
  InitialBadge,
  ModalHeader,
  ScreenContainer,
  SegmentedControl,
  type SelectOption,
  SelectField,
  SuggestTextField,
  useDialog,
} from '@/lib/ui';
import {
  accountBalances,
  childrenOf,
  deleteTransactionMessage,
  findCategoryByName,
  formatDayLabel,
  formatTaka,
  formatTakaInput,
  linkableParents,
  nameLookup,
  partySuggestions,
  remainingOf,
} from '@/lib/utils';

const TYPE_OPTIONS = TRANSACTION_TYPES.map((value) => ({ value, label: TRANSACTION_TYPE_LABELS[value] }));
/** The ৳ sign takes the type's colour (as in the type switch); the number stays neutral. */
const SIGN_TONE: Record<TransactionType, string> = {
  expense: 'text-expense',
  income: 'text-income',
  transfer: 'text-transfer',
};

type Side = 'from' | 'to';
/** Which list each picker draws from, per transaction type. */
const SOURCES: Record<TransactionType, Record<Side, 'account' | CategoryKind>> = {
  expense: { from: 'account', to: 'expense' },
  income: { from: 'income_source', to: 'account' },
  transfer: { from: 'account', to: 'account' },
};

type FormParams = {
  id?: string;
  parentId?: string;
  /** Quick-add preset: prefilled type and from / to. */
  type?: string;
  fromId?: string;
  toId?: string;
};

function initialValues(ledger: LedgerSnapshot, params: FormParams): TransactionFormInput {
  const defaults: TransactionFormInput = {
    ...transactionFormDefaults(),
    // Transfer charges default to the user's "Bank Charges" category, if they have one.
    feeCategoryId: findCategoryByName(ledger.categories, 'expense', TRANSFER_FEE_CATEGORY)?.id ?? null,
  };
  const existing = params.id ? ledger.transactions.find((tx) => tx.id === params.id) : undefined;
  if (existing) {
    return {
      ...defaults,
      type: existing.type,
      date: existing.date,
      fromId: existing.fromId,
      toId: existing.toId,
      amount: formatTakaInput(existing.amount),
      note: existing.note,
      parentId: existing.parentId,
      party: existing.party ?? '',
    };
  }
  const parent = params.parentId ? ledger.transactions.find((tx) => tx.id === params.parentId) : undefined;
  if (parent) {
    // Spending money that came from `parent`: it leaves the account the parent paid into.
    return { ...defaults, date: parent.date, fromId: parent.toId, parentId: parent.id };
  }
  const presetType = TRANSACTION_TYPES.find((t) => t === params.type);
  if (presetType) {
    return { ...defaults, type: presetType, fromId: params.fromId ?? '', toId: params.toId ?? '' };
  }
  return defaults;
}

export function TransactionFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { status, error } = useLedger();
  if (status === 'ready') return <TransactionForm />;
  return (
    <View className="flex-1 bg-background">
      <ModalHeader title={id ? 'Edit transaction' : 'New transaction'} onClose={() => router.back()} />
      <LedgerPending status={status} error={error} />
    </View>
  );
}

/** Mounted once the ledger is loaded, so the default values come from real data. */
function TransactionForm() {
  const params = useLocalSearchParams<FormParams>();
  const { id } = params;
  const ledger = useLedger();
  const simpleMode = useSimpleMode();
  const palette = useCategoryColors();
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
    defaultValues: initialValues(ledger, params),
    mode: 'onTouched',
  });
  const [creatingCategory, setCreatingCategory] = useState(false);
  const dialog = useDialog();
  const [type, fromId, toId, linkedId, fee] = useWatch({ control, name: ['type', 'fromId', 'toId', 'parentId', 'fee'] });

  const nameOf = useMemo(() => nameLookup(accounts, categories), [accounts, categories]);
  const parties = useMemo(() => partySuggestions(transactions), [transactions]);
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
          leading: <InitialBadge label={a.name} color={palette[ACCOUNT_TYPE_COLORS[a.type]]} size="sm" />,
        }));
    }
    return categories
      .filter((c) => c.kind === source && (!c.archived || c.id === current))
      .map((c) => ({
        value: c.id,
        label: c.name,
        leading: <InitialBadge label={c.name} color={palette[c.color ?? DEFAULT_CATEGORY_COLOR]} size="sm" />,
      }));
  };

  const createFor = (side: Side) => async (name: string) => {
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
    setCreatingCategory(true);
    try {
      const created = await ledgerStore.addCategory({ name, kind: source, color, icon: null, archived: false });
      setValue(field, created.id, { shouldValidate: true });
    } catch {
      setError('root', { message: `Could not create “${name}”. Please try again.` });
    } finally {
      setCreatingCategory(false);
    }
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

  const onSubmit = async ({ fee: charge, feeCategoryId, ...values }: TransactionFormValues) => {
    try {
      const input = {
        ...values,
        parentId: values.type === 'income' ? null : values.parentId,
        party: values.type === 'income' ? values.party : null,
      };
      if (id) await ledgerStore.updateTransaction(id, input);
      else await ledgerStore.addTransaction(input);
      // A transfer charge (e.g. a cash-out fee) is its own expense from the same account.
      if (!id && values.type === 'transfer' && charge && feeCategoryId) {
        await ledgerStore.addTransaction({
          type: 'expense',
          date: values.date,
          fromId: values.fromId,
          toId: feeCategoryId,
          amount: charge,
          note: `Charge for transfer to ${nameOf(values.toId)}`,
          parentId: null,
          party: null,
        });
      }
      router.back();
    } catch {
      setError('root', { message: 'Could not save. Please try again.' });
    }
  };

  const confirmDelete = async () => {
    if (!id) return;
    const deleted = await dialog.confirm({
      title: 'Delete transaction?',
      message: deleteTransactionMessage(childrenOf(id, transactions).length),
      tone: 'danger',
      icon: TrashIcon,
      confirmLabel: 'Delete',
      onConfirm: () => ledgerStore.deleteTransaction(id),
    });
    if (deleted) router.dismissAll();
  };

  const labels = TRANSACTION_FIELD_LABELS[type];
  // Simple mode hides the money-tree link (unless this entry already has one).
  const showLink = type !== 'income' && (linkedId !== null || (!simpleMode && parentOptions.length > 0));
  const showFee = type === 'transfer' && !isEdit;
  const expenseCategoryOptions: SelectOption[] = categories
    .filter((c) => c.kind === 'expense' && !c.archived)
    .map((c) => ({
      value: c.id,
      label: c.name,
      leading: <InitialBadge label={c.name} color={palette[c.color ?? DEFAULT_CATEGORY_COLOR]} size="sm" />,
    }));

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
                signClass={SIGN_TONE[type]}
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

          {type === 'income' ? (
            <Controller
              control={control}
              name="party"
              render={({ field, fieldState }) => (
                <SuggestTextField
                  label="Received from"
                  value={field.value}
                  onChangeText={field.onChange}
                  onBlur={field.onBlur}
                  error={fieldState.error?.message}
                  placeholder="Client or person (optional)"
                  maxLength={60}
                  suggestions={parties}
                />
              )}
            />
          ) : null}

          {showFee ? (
            <Controller
              control={control}
              name="fee"
              render={({ field, fieldState }) => (
                <FormTextField
                  label="Charge"
                  value={field.value}
                  onChangeText={field.onChange}
                  onBlur={field.onBlur}
                  error={fieldState.error?.message}
                  placeholder="৳ 0 (optional)"
                  hint="e.g. a cash-out or transfer fee. Saved as a separate expense."
                  keyboardType="decimal-pad"
                />
              )}
            />
          ) : null}

          {showFee && fee.trim() ? (
            <Controller
              control={control}
              name="feeCategoryId"
              render={({ field, fieldState }) => (
                <SelectField
                  label="Charge category"
                  value={field.value}
                  options={expenseCategoryOptions}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  error={fieldState.error?.message}
                />
              )}
            />
          ) : null}

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

          <Button size="lg" className="h-12 rounded-xl" onPress={() => void handleSubmit(onSubmit)()} isDisabled={isSubmitting || creatingCategory}>
            {isSubmitting ? <ButtonLoader /> : null}
            <ButtonText className="text-base font-semibold">{isEdit ? 'Save changes' : 'Add transaction'}</ButtonText>
          </Button>

          {isEdit ? (
            <Button
              variant="ghost"
              size="lg"
              className="h-12 rounded-xl"
              onPress={() => void confirmDelete()}
              isDisabled={isSubmitting}>
              <ButtonText className="text-base font-semibold text-destructive">Delete transaction</ButtonText>
            </Button>
          ) : null}
        </VStack>
      </ScreenContainer>
    </View>
  );
}
