import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { LedgerPending } from '@/lib/components';
import { ACCOUNT_TYPE_LABELS, CATEGORY_KIND_LABELS, TRANSACTION_TYPE_LABELS } from '@/lib/constants';
import { db, getTransactionsBetween, ledgerStore, newId } from '@/lib/db';
import { Box } from '@/lib/gluestack-ui/box';
import { HStack } from '@/lib/gluestack-ui/hstack';
import { AlertCircleIcon, ChevronLeftIcon, InfoIcon } from '@/lib/gluestack-ui/icon';
import { Text } from '@/lib/gluestack-ui/text';
import { VStack } from '@/lib/gluestack-ui/vstack';
import { useLedger } from '@/lib/hooks';
import {
  buildImport,
  columnLabel,
  columnLetter,
  type ColumnMap,
  DATE_ORDER_LABELS,
  type DateOrder,
  defaultChoice,
  type Draft,
  findDuplicates,
  guessColumns,
  guessDateOrder,
  guessHeaderRow,
  IMPORT_FIELD_INFO,
  type ImportField,
  type ImportOptions,
  type NameChoice,
  type NameNeed,
  neededNames,
  parseTable,
  readRows,
  type Table,
  unreadableFileReason,
  withoutDuplicates,
} from '@/lib/spreadsheet';
import { pickSpreadsheetFile } from '@/lib/storage';
import { ACCOUNT_TYPES, type AccountType } from '@/lib/types';
import {
  AmountText,
  Button,
  Card,
  IconBadge,
  IconButton,
  ModalHeader,
  ScreenContainer,
  SectionHeader,
  SegmentedControl,
  SelectField,
  type SelectOption,
  SpreadsheetIcon,
  SwitchRow,
  TextField,
  UploadIcon,
  useDialog,
} from '@/lib/ui';
import { formatFullDate, parseTaka, todayKey } from '@/lib/utils';

type Source = { name: string; table: Table };
type Step = 'source' | 'columns' | 'names' | 'review';

const STEPS: Step[] = ['source', 'columns', 'names', 'review'];

const count = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`;

/**
 * Import transactions from a spreadsheet in any layout: pick a CSV or paste a table (copied from
 * Excel, Google Sheets or Word) → say which column is what → match names to accounts and
 * categories → check every row and import. Nothing is saved until the last step.
 */
export function ImportScreen() {
  const { status, error } = useLedger();
  return (
    <View className="flex-1 bg-background">
      <ModalHeader title="Import from spreadsheet" onClose={() => router.back()} />
      {status === 'ready' ? <ImportFlow /> : <LedgerPending status={status} error={error} />}
    </View>
  );
}

function ImportFlow() {
  const { accounts, categories } = useLedger();
  const [step, setStep] = useState<Step>('source');
  const [source, setSource] = useState<Source | null>(null);
  const [options, setOptions] = useState<ImportOptions | null>(null);
  const [ambiguousDates, setAmbiguousDates] = useState(false);
  const [choices, setChoices] = useState<Record<string, NameChoice>>({});

  const draft = useMemo(
    () => (source && options ? readRows(source.table, options, accounts.map((a) => a.name)) : null),
    [source, options, accounts]
  );
  const needs = useMemo(() => (draft ? neededNames(draft.rows, accounts, categories) : []), [draft, accounts, categories]);

  const start = (next: Source) => {
    const headerRow = guessHeaderRow(next.table);
    const columns = guessColumns(next.table, headerRow);
    const dates = guessDateOrder(dateCells(next.table, headerRow, columns));
    setSource(next);
    setAmbiguousDates(dates.ambiguous);
    setOptions({
      headerRow,
      columns,
      dateOrder: dates.order,
      defaultType: 'expense',
      defaultAccount: accounts.length === 1 ? accounts[0].name : null,
      today: todayKey(),
    });
    setChoices({});
    setStep('columns');
  };

  const back = () => setStep(STEPS[Math.max(0, STEPS.indexOf(step) - 1)]);

  return (
    <ScreenContainer>
      {step !== 'source' ? <StepHeader step={STEPS.indexOf(step)} onBack={back} /> : null}
      {step === 'source' ? <SourceStep onTable={start} /> : null}
      {step === 'columns' && source && options && draft ? (
        <ColumnsStep
          source={source}
          options={options}
          ambiguousDates={ambiguousDates}
          draft={draft}
          onChange={(next) => setOptions({ ...options, ...next })}
          onNext={() => setStep('names')}
        />
      ) : null}
      {step === 'names' && draft ? (
        <NamesStep
          needs={needs}
          choices={choices}
          onChoose={(key, choice) => setChoices({ ...choices, [key]: choice })}
          onNext={() => setStep('review')}
        />
      ) : null}
      {step === 'review' && draft ? <ReviewStep draft={draft} needs={needs} choices={choices} /> : null}
    </ScreenContainer>
  );
}

const dateCells = (table: Table, headerRow: number | null, columns: ColumnMap) =>
  columns.date === undefined ? [] : table.slice((headerRow ?? -1) + 1).map((row) => row[columns.date!] ?? '');

function StepHeader({ step, onBack }: { step: number; onBack: () => void }) {
  const total = STEPS.length - 1;
  return (
    <HStack className="items-center justify-between pb-2 pt-3">
      <IconButton icon={ChevronLeftIcon} variant="ghost" onPress={onBack} accessibilityLabel="Back" />
      <HStack className="gap-1.5">
        {Array.from({ length: total }, (_, i) => i + 1).map((n) => (
          <Box key={n} className={`h-1.5 rounded-full ${n === step ? 'w-6 bg-primary' : 'w-1.5 bg-border'}`} />
        ))}
      </HStack>
      <Text className="w-10 text-right text-xs font-medium text-muted-foreground">
        {step}/{total}
      </Text>
    </HStack>
  );
}

function StepTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <VStack className="gap-1 pb-2">
      <Text className="text-2xl font-semibold text-foreground">{title}</Text>
      {subtitle ? <Text className="text-sm text-muted-foreground">{subtitle}</Text> : null}
    </VStack>
  );
}

// ─── 1. Source ──────────────────────────────────────────────────────────────

function SourceStep({ onTable }: { onTable: (source: Source) => void }) {
  const dialog = useDialog();
  const [picking, setPicking] = useState(false);
  const [pasting, setPasting] = useState(false);
  const [pasted, setPasted] = useState('');

  const readTable = async (name: string, text: string) => {
    const reason = unreadableFileReason(name, text);
    if (reason) {
      await dialog.alert({ title: "Can't read this file", message: reason, tone: 'info' });
      return;
    }
    const table = parseTable(text);
    if (table.length === 0) {
      await dialog.alert({ title: 'No rows found', message: 'The file or text is empty.', tone: 'info' });
      return;
    }
    onTable({ name, table });
  };

  const pick = async () => {
    setPicking(true);
    try {
      const file = await pickSpreadsheetFile();
      if (file) await readTable(file.name, file.text);
    } catch {
      await dialog.alert({ title: "Couldn't open the file", message: 'Please try again, or pick another file.', tone: 'danger' });
    } finally {
      setPicking(false);
    }
  };

  return (
    <VStack className="gap-4 pt-4">
      <StepTitle
        title="Bring in your history"
        subtitle="Any layout works: you'll say which column is what. Nothing is saved until you check it and tap Import."
      />
      <Button label="Choose a CSV file" icon={UploadIcon} size="lg" loading={picking} onPress={() => void pick()} />
      <Button label="Paste a table" variant="outline" size="lg" onPress={() => setPasting(true)} />
      {pasting ? (
        <VStack className="gap-3">
          <TextField
            label="Pasted table"
            multiline
            autoFocus
            value={pasted}
            onChangeText={setPasted}
            placeholder="Copy the rows (with the header row) and paste them here"
          />
          <Button label="Use this table" disabled={pasted.trim() === ''} onPress={() => void readTable('Pasted table', pasted)} />
        </VStack>
      ) : null}

      <Card className="mt-2">
        <HStack className="items-start gap-3 p-4">
          <IconBadge icon={SpreadsheetIcon} tone="sky" />
          <VStack className="flex-1 gap-2">
            <Text className="text-base font-medium text-foreground">Excel, Google Sheets or Word?</Text>
            <Help label="Excel" text="File → Save as → CSV, then choose that file." />
            <Help label="Google Sheets" text="File → Download → Comma-separated values (.csv)." />
            <Help label="Word, a PDF table, notes" text="Select the table, copy it, then use Paste a table." />
            <Text className="text-sm text-muted-foreground">
              One table per import. Rows already in the app are found and can be skipped, so importing again is safe.
            </Text>
          </VStack>
        </HStack>
      </Card>
    </VStack>
  );
}

function Help({ label, text }: { label: string; text: string }) {
  return (
    <Text className="text-sm text-muted-foreground">
      <Text className="text-sm font-semibold text-foreground">{label}: </Text>
      {text}
    </Text>
  );
}

// ─── 2. Columns ─────────────────────────────────────────────────────────────

const FIELD_GROUPS: { title: string; fields: ImportField[] }[] = [
  { title: 'Date and amount', fields: ['date', 'amount', 'moneyOut', 'moneyIn'] },
  { title: 'What and where', fields: ['type', 'account', 'category', 'from', 'to'] },
  { title: 'Details', fields: ['note', 'party', 'id', 'linkedTo'] },
];

const DATE_ORDER_OPTIONS: SelectOption[] = (Object.keys(DATE_ORDER_LABELS) as DateOrder[]).map((value) => ({
  value,
  label: DATE_ORDER_LABELS[value],
}));

function ColumnsStep({
  source,
  options,
  ambiguousDates,
  draft,
  onChange,
  onNext,
}: {
  source: Source;
  options: ImportOptions;
  ambiguousDates: boolean;
  draft: Draft;
  onChange: (next: Partial<ImportOptions>) => void;
  onNext: () => void;
}) {
  const { accounts } = useLedger();
  const { table, name } = source;
  const { headerRow, columns } = options;
  const width = table[0]?.length ?? 0;
  const firstData = table.slice((headerRow ?? -1) + 1).find((row) => row.some(Boolean)) ?? [];

  const columnOptions: SelectOption[] = Array.from({ length: width }, (_, i) => ({
    value: String(i),
    label: columnLabel(table, headerRow, i, columnLetter(i)),
    description: firstData[i] ? `e.g. ${firstData[i]}` : undefined,
  }));
  const headerOptions: SelectOption[] = [
    { value: 'none', label: 'No column names', description: 'The first row is data' },
    ...table.slice(0, 10).map((row, i) => ({
      value: String(i),
      label: `Row ${i + 1}`,
      description: row.filter(Boolean).slice(0, 4).join(', '),
    })),
  ];

  const setColumn = (field: ImportField, value: string | null) => {
    const next: ColumnMap = { ...columns };
    if (value === null) delete next[field];
    else {
      const index = Number(value);
      // One column, one meaning.
      (Object.keys(next) as ImportField[]).forEach((other) => {
        if (next[other] === index) delete next[other];
      });
      next[field] = index;
    }
    onChange({ columns: next });
  };

  const setHeader = (value: string | null) => {
    const row = value === null || value === 'none' ? null : Number(value);
    const guessed = guessColumns(table, row);
    onChange({ headerRow: row, columns: guessed, dateOrder: guessDateOrder(dateCells(table, row, guessed)).order });
  };

  const hasAmount = columns.amount !== undefined || columns.moneyIn !== undefined || columns.moneyOut !== undefined;
  const missing = columns.date === undefined ? 'Choose the Date column.' : !hasAmount ? 'Choose the Amount column (or Money in / Money out).' : null;
  const needsType = columns.type === undefined && columns.moneyIn === undefined && columns.moneyOut === undefined;
  const dataRows = draft.rows.length + new Set(draft.problems.map((p) => p.line)).size;

  return (
    <VStack className="gap-1 pt-2">
      <StepTitle title="Which column is what?" subtitle={`${name}: ${count(dataRows, 'row')}. Columns were guessed from their names; check them.`} />

      <SelectField
        label="Column names are in"
        value={headerRow === null ? 'none' : String(headerRow)}
        options={headerOptions}
        onChange={setHeader}
      />

      {FIELD_GROUPS.map((group) => (
        <VStack key={group.title} className="gap-3">
          <SectionHeader title={group.title} className="pb-0" />
          {group.fields.map((field) => (
            <SelectField
              key={field}
              label={IMPORT_FIELD_INFO[field].label}
              hint={IMPORT_FIELD_INFO[field].hint}
              value={columns[field] === undefined ? null : String(columns[field])}
              options={columnOptions}
              noneLabel="Not in the file"
              placeholder="Not in the file"
              onChange={(value) => setColumn(field, value)}
            />
          ))}
        </VStack>
      ))}

      <SectionHeader title="For rows that don't say" className="pb-0" />
      <VStack className="gap-3">
        {columns.date !== undefined ? (
          <SelectField
            label="Dates are written as"
            value={options.dateOrder}
            options={DATE_ORDER_OPTIONS}
            hint={ambiguousDates ? 'Dates like 05/03 could be 5 March or 3 May; check this.' : undefined}
            onChange={(value) => value && onChange({ dateOrder: value as DateOrder })}
          />
        ) : null}
        <SelectField
          label="Account"
          value={options.defaultAccount}
          options={accounts.filter((a) => !a.archived).map((a) => ({ value: a.name, label: a.name }))}
          noneLabel="None"
          placeholder="None"
          hint="Used for rows without an account (e.g. a statement from one bank)"
          onChange={(value) => onChange({ defaultAccount: value })}
        />
        {needsType ? (
          <VStack className="gap-2">
            <Text className="text-sm font-medium text-foreground">Rows without a type or minus sign are</Text>
            <SegmentedControl
              options={[
                { value: 'expense', label: 'Expenses' },
                { value: 'income', label: 'Income' },
              ]}
              value={options.defaultType}
              onChange={(value) => onChange({ defaultType: value })}
            />
          </VStack>
        ) : null}
      </VStack>

      <SectionHeader title="Preview" className="pb-0" />
      {missing ? <Notice tone="warning" text={missing} /> : <Preview draft={draft} />}

      <Button
        label="Continue"
        size="lg"
        className="mt-6"
        disabled={missing !== null || draft.rows.length === 0}
        onPress={onNext}
      />
    </VStack>
  );
}

function Preview({ draft }: { draft: Draft }) {
  const problemRows = new Set(draft.problems.map((p) => p.line)).size;
  return (
    <VStack className="gap-3 pt-2">
      <Text className="text-sm text-muted-foreground">
        {count(draft.rows.length, 'row')} ready
        {problemRows > 0 ? `, ${count(problemRows, 'row')} with problems` : ''}
        {draft.skipped > 0 ? `, ${count(draft.skipped, 'total row')} left out` : ''}.
      </Text>
      {draft.rows.length > 0 ? (
        <Card>
          {draft.rows.slice(0, 3).map((row, i) => (
            <HStack key={row.line} className={`items-center gap-3 px-4 py-3 ${i > 0 ? 'border-t border-border/70' : ''}`}>
              <VStack className="flex-1">
                <Text numberOfLines={1} className="text-sm font-medium text-foreground">
                  {row.fromName} → {row.toName}
                </Text>
                <Text numberOfLines={1} className="text-xs text-muted-foreground">
                  Row {row.line} · {TRANSACTION_TYPE_LABELS[row.type]} · {formatFullDate(row.date)}
                  {row.note ? ` · ${row.note}` : ''}
                </Text>
              </VStack>
              <AmountText
                amount={row.amount}
                tone={row.type === 'income' ? 'income' : 'default'}
                signed={row.type === 'income'}
                outflow={row.type === 'expense'}
                className="text-sm"
              />
            </HStack>
          ))}
        </Card>
      ) : null}
      {draft.problems.length > 0 ? <Problems draft={draft} limit={5} /> : null}
    </VStack>
  );
}

function Problems({ draft, limit }: { draft: Draft; limit: number }) {
  const shown = draft.problems.slice(0, limit);
  return (
    <Card>
      <VStack className="gap-1.5 p-4">
        {shown.map((problem, i) => (
          <Text key={`${problem.line}-${i}`} className="text-sm text-foreground">
            <Text className="text-sm font-semibold text-destructive">Row {problem.line}: </Text>
            {problem.message}
          </Text>
        ))}
        {draft.problems.length > limit ? (
          <Text className="text-sm text-muted-foreground">…and {count(draft.problems.length - limit, 'more problem')}.</Text>
        ) : null}
      </VStack>
    </Card>
  );
}

function Notice({ text, tone }: { text: string; tone: 'warning' | 'info' }) {
  return (
    <HStack className="mt-2 items-start gap-3 rounded-xl bg-warning/10 p-3 dark:bg-warning/20">
      <IconBadge icon={tone === 'warning' ? AlertCircleIcon : InfoIcon} tone="warning" />
      <Text className="flex-1 self-center text-sm text-foreground">{text}</Text>
    </HStack>
  );
}

// ─── 3. Names ───────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<NameNeed['role'], string> = {
  account: 'Account',
  expense: CATEGORY_KIND_LABELS.expense.singular,
  income_source: CATEGORY_KIND_LABELS.income_source.singular,
};

function NamesStep({
  needs,
  choices,
  onChoose,
  onNext,
}: {
  needs: NameNeed[];
  choices: Record<string, NameChoice>;
  onChoose: (key: string, choice: NameChoice) => void;
  onNext: () => void;
}) {
  const unknown = needs.filter((need) => !need.existingId);
  const matched = needs.filter((need) => need.existingId);

  return (
    <VStack className="gap-1 pt-2">
      <StepTitle
        title="New names"
        subtitle={
          unknown.length > 0
            ? `${count(unknown.length, 'name')} in the sheet ${unknown.length === 1 ? "isn't" : "aren't"} in the app yet. Create ${unknown.length === 1 ? 'it' : 'them'}, or use one you have.`
            : 'Every name in the sheet is already in the app.'
        }
      />
      <VStack className="gap-3 pt-2">
        {unknown.map((need) => (
          <NameRow key={need.key} need={need} choice={choices[need.key] ?? defaultChoice(need)} onChoose={(c) => onChoose(need.key, c)} />
        ))}
      </VStack>
      {matched.length > 0 ? (
        <>
          <SectionHeader title="Already in the app" />
          <Text className="text-sm text-muted-foreground">{matched.map((need) => need.name).join(', ')}</Text>
        </>
      ) : null}
      <Button label="Continue" size="lg" className="mt-8" onPress={onNext} />
    </VStack>
  );
}

function NameRow({ need, choice, onChoose }: { need: NameNeed; choice: NameChoice; onChoose: (choice: NameChoice) => void }) {
  const { accounts, categories } = useLedger();
  const [balanceText, setBalanceText] = useState(
    choice.action === 'create' && choice.openingBalance > 0 ? String(choice.openingBalance / 100) : ''
  );
  const isAccount = need.role === 'account';
  const existing = isAccount
    ? accounts.filter((a) => !a.archived).map((a) => ({ id: a.id, name: a.name }))
    : categories.filter((c) => c.kind === need.role && !c.archived).map((c) => ({ id: c.id, name: c.name }));

  const createOptions: SelectOption[] = isAccount
    ? ACCOUNT_TYPES.map((type) => ({ value: `create:${type}`, label: `New account (${ACCOUNT_TYPE_LABELS[type]})` }))
    : [{ value: 'create:', label: `New ${ROLE_LABELS[need.role].toLowerCase()}` }];
  const options = [...createOptions, ...existing.map((item) => ({ value: `use:${item.id}`, label: `Use “${item.name}”` }))];
  const value = choice.action === 'use' ? `use:${choice.id}` : isAccount ? `create:${choice.accountType}` : 'create:';
  const openingBalance = choice.action === 'create' ? choice.openingBalance : 0;

  const choose = (next: string | null) => {
    if (!next) return;
    const [action, rest] = next.split(':');
    if (action === 'use') onChoose({ action: 'use', id: rest });
    else onChoose({ action: 'create', accountType: (rest || 'bank') as AccountType, openingBalance });
  };

  return (
    <Card>
      <VStack className="gap-3 p-4">
        <HStack className="items-center justify-between gap-3">
          <Text numberOfLines={1} className="flex-1 text-base font-semibold text-foreground">
            {need.name}
          </Text>
          <Text className="text-xs text-muted-foreground">
            {ROLE_LABELS[need.role]} · {count(need.count, 'row')}
          </Text>
        </HStack>
        <SelectField label="Becomes" value={value} options={options} sheetTitle={need.name} onChange={choose} />
        {isAccount && choice.action === 'create' ? (
          <TextField
            label={`Balance before ${formatFullDate(need.firstDate)}`}
            type="money"
            value={balanceText}
            placeholder="0"
            hint="Its first row in the sheet is on this day; leave empty for 0"
            error={balanceText.trim() && parseTaka(balanceText) === null ? 'Enter an amount like 1,500 or 1500.50' : undefined}
            onChangeText={(text) => {
              setBalanceText(text);
              onChoose({ ...choice, openingBalance: parseTaka(text) ?? 0 });
            }}
          />
        ) : null}
      </VStack>
    </Card>
  );
}

// ─── 4. Review ──────────────────────────────────────────────────────────────

function ReviewStep({ draft, needs, choices }: { draft: Draft; needs: NameNeed[]; choices: Record<string, NameChoice> }) {
  const dialog = useDialog();
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  // New ids each time the choices change; only the last plan is saved.
  const plan = useMemo(() => buildImport(draft.rows, needs, choices, newId), [draft, needs, choices]);
  const duplicates = useMemo(() => {
    if (plan.transactions.length === 0) return new Map<number, string>();
    const dates = plan.transactions.map((tx) => tx.date).sort();
    return findDuplicates(plan.transactions, getTransactionsBetween(db, dates[0], dates[dates.length - 1]));
  }, [plan]);
  const final = skipDuplicates ? withoutDuplicates(plan, duplicates) : plan;

  const byType = { income: 0, expense: 0, transfer: 0 };
  final.transactions.forEach((tx) => (byType[tx.type] += 1));
  const dates = final.transactions.map((tx) => tx.date).sort();
  const problemRows = new Set(draft.problems.map((p) => p.line)).size;

  const save = async () => {
    setSaving(true);
    setFailed(false);
    try {
      await ledgerStore.importSpreadsheet(final);
      router.back();
      await dialog.alert({
        title: 'Import done',
        message: `${count(final.transactions.length, 'transaction')} added${final.accounts.length > 0 ? `, with ${count(final.accounts.length, 'new account')}` : ''}.`,
        tone: 'success',
      });
    } catch {
      setFailed(true);
      setSaving(false);
    }
  };

  return (
    <VStack className="gap-1 pt-2">
      <StepTitle title="Check and import" />
      <Card>
        <VStack className="gap-1 p-4">
          <Text className="text-3xl font-semibold leading-[44px] text-foreground">{count(final.transactions.length, 'transaction')}</Text>
          {dates.length > 0 ? (
            <Text className="text-sm text-muted-foreground">
              {formatFullDate(dates[0])} – {formatFullDate(dates[dates.length - 1])}
            </Text>
          ) : null}
          <Text className="pt-2 text-sm text-foreground">
            {count(byType.income, 'income', 'income')} · {count(byType.expense, 'expense')} · {count(byType.transfer, 'transfer')}
          </Text>
          {final.accounts.length + final.categories.length > 0 ? (
            <Text className="text-sm text-muted-foreground">
              Creates {[final.accounts.length > 0 ? count(final.accounts.length, 'account') : null, final.categories.length > 0 ? count(final.categories.length, 'category', 'categories') : null]
                .filter(Boolean)
                .join(' and ')}
              .
            </Text>
          ) : null}
        </VStack>
      </Card>

      {duplicates.size > 0 ? (
        <>
          <SectionHeader title="Already in the app" />
          <Card>
            <SwitchRow
              inCard
              label={`Skip ${count(duplicates.size, 'row')}`}
              description="Same date, type, accounts and amount as an entry you already have"
              value={skipDuplicates}
              onValueChange={setSkipDuplicates}
            />
          </Card>
        </>
      ) : null}

      {problemRows > 0 ? (
        <>
          <SectionHeader title={`Left out: ${count(problemRows, 'row')} with problems`} />
          <Problems draft={draft} limit={20} />
          <Text className="px-1 pt-2 text-xs text-muted-foreground">
            Fix them in the sheet and import it again later; rows already imported are found and skipped.
          </Text>
        </>
      ) : null}

      {failed ? <Notice tone="warning" text="Couldn't import. Nothing was changed; please try again." /> : null}

      <Button
        label={
          final.transactions.length === 0
            ? 'Nothing new to import'
            : problemRows > 0
              ? `Import ${count(final.transactions.length, 'row')}, leave out ${problemRows}`
              : 'Import'
        }
        size="lg"
        className="mt-6"
        loading={saving}
        loadingLabel="Importing…"
        disabled={final.transactions.length === 0}
        onPress={() => void save()}
      />
    </VStack>
  );
}

