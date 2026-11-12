import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { LedgerPending } from '@/lib/components';
import { ACCOUNT_TYPE_LABELS, CATEGORY_KIND_LABELS, TRANSACTION_TYPE_LABELS } from '@/lib/constants';
import { db, getTransactionsBetween, ledgerStore, newId } from '@/lib/db';
import { Box } from '@/lib/gluestack-ui/box';
import { HStack } from '@/lib/gluestack-ui/hstack';
import { AlertCircleIcon, CheckCircleIcon, ChevronLeftIcon, InfoIcon } from '@/lib/gluestack-ui/icon';
import { Text } from '@/lib/gluestack-ui/text';
import { VStack } from '@/lib/gluestack-ui/vstack';
import { useLedger } from '@/lib/hooks';
import {
  assignColumn,
  buildImport,
  type ColumnMap,
  DATE_ORDER_LABELS,
  type DateOrder,
  defaultChoice,
  type Draft,
  draftRowCount,
  findDuplicates,
  guessColumns,
  guessDateOrder,
  guessHeaderRow,
  IMPORT_FIELD_INFO,
  type ImportField,
  type ImportOptions,
  importQuestions,
  type ImportQuestions,
  isConfident,
  type NameChoice,
  type NameNeed,
  neededNames,
  notATableReason,
  parseTable,
  readRows,
  sheetColumns,
  type Table,
  unreadableFileReason,
  withoutDuplicates,
} from '@/lib/spreadsheet';
import { pickSpreadsheetFile } from '@/lib/storage';
import { ACCOUNT_TYPES, type AccountType, type TransactionType } from '@/lib/types';
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
 * Excel, Google Sheets or Word) → a summary of what was read (or, when the columns are unclear,
 * which column is what, asking only what this sheet needs) → new names, only if there are any →
 * check every row and import. Nothing is saved until the last step.
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
  // Decided once per file: a summary when the columns were read with confidence, else the mapping.
  const [columnsView, setColumnsView] = useState<'summary' | 'mapping'>('mapping');
  const [choices, setChoices] = useState<Record<string, NameChoice>>({});

  const accountNames = useMemo(() => accounts.map((a) => a.name), [accounts]);
  const draft = useMemo(
    () => (source && options ? readRows(source.table, options, accountNames) : null),
    [source, options, accountNames]
  );
  const needs = useMemo(() => (draft ? neededNames(draft.rows, accounts, categories) : []), [draft, accounts, categories]);
  const ambiguousDates = useMemo(
    () => (source && options ? guessDateOrder(dateCells(source.table, options.headerRow, options.columns)).ambiguous : false),
    [source, options]
  );

  // "New names" only when the sheet has names the app doesn't.
  const steps: Step[] = needs.some((need) => !need.existingId) ? STEPS : STEPS.filter((s) => s !== 'names');
  const go = (by: 1 | -1) => setStep(steps[Math.min(steps.length - 1, Math.max(0, steps.indexOf(step) + by))]);

  const start = (next: Source) => {
    const headerRow = guessHeaderRow(next.table);
    const columns = guessColumns(next.table, headerRow);
    const dates = guessDateOrder(dateCells(next.table, headerRow, columns));
    const guessed: ImportOptions = {
      headerRow,
      columns,
      dateOrder: dates.order,
      defaultType: 'expense',
      defaultAccount: accounts.length === 1 ? accounts[0].name : null,
      today: todayKey(),
    };
    const questions = importQuestions(next.table, guessed, dates.ambiguous);
    const confident = isConfident(readRows(next.table, guessed, accountNames), guessed, questions);
    setSource(next);
    setOptions(guessed);
    setColumnsView(confident ? 'summary' : 'mapping');
    setChoices({});
    setStep('columns');
  };

  const changeOptions = (next: Partial<ImportOptions>) => {
    if (!source || !options) return;
    const merged = { ...options, ...next };
    // A different date column (or header row) may write dates the other way round.
    const dateColumnChanged = next.columns !== undefined && next.columns.date !== options.columns.date;
    if (next.dateOrder === undefined && (dateColumnChanged || next.headerRow !== undefined)) {
      merged.dateOrder = guessDateOrder(dateCells(source.table, merged.headerRow, merged.columns)).order;
    }
    setOptions(merged);
  };

  return (
    <ScreenContainer>
      {step !== 'source' ? <StepHeader step={step} steps={steps} onBack={() => go(-1)} /> : null}
      {step === 'source' ? <SourceStep onTable={start} /> : null}
      {step === 'columns' && source && options && draft && columnsView === 'summary' ? (
        <SummaryStep source={source} options={options} draft={draft} onChangeColumns={() => setColumnsView('mapping')} onNext={() => go(1)} />
      ) : null}
      {step === 'columns' && source && options && draft && columnsView === 'mapping' ? (
        <ColumnsStep
          source={source}
          options={options}
          questions={importQuestions(source.table, options, ambiguousDates)}
          draft={draft}
          onChange={changeOptions}
          onNext={() => go(1)}
        />
      ) : null}
      {step === 'names' && draft ? (
        <NamesStep
          needs={needs}
          choices={choices}
          onChoose={(key, choice) => setChoices({ ...choices, [key]: choice })}
          onNext={() => go(1)}
        />
      ) : null}
      {step === 'review' && draft ? <ReviewStep draft={draft} needs={needs} choices={choices} /> : null}
    </ScreenContainer>
  );
}

const dateCells = (table: Table, headerRow: number | null, columns: ColumnMap) =>
  columns.date === undefined ? [] : table.slice((headerRow ?? -1) + 1).map((row) => row[columns.date!] ?? '');

const STEP_LABELS: Record<Step, string> = { source: 'Source', columns: 'Your sheet', names: 'New names', review: 'Import' };

function StepHeader({ step, steps, onBack }: { step: Step; steps: Step[]; onBack: () => void }) {
  const total = steps.length - 1;
  const current = steps.indexOf(step);
  return (
    <HStack className="items-center justify-between pb-2 pt-3">
      <IconButton icon={ChevronLeftIcon} variant="ghost" onPress={onBack} accessibilityLabel="Back" />
      <VStack className="items-center gap-1.5">
        <HStack className="gap-1.5">
          {Array.from({ length: total }, (_, i) => i + 1).map((n) => (
            <Box key={n} className={`h-1.5 rounded-full ${n === current ? 'w-6 bg-primary' : n < current ? 'w-1.5 bg-primary/50' : 'w-1.5 bg-border'}`} />
          ))}
        </HStack>
        <Text className="text-xs font-medium text-muted-foreground">
          Step {current} of {total} · {STEP_LABELS[step]}
        </Text>
      </VStack>
      <Box className="w-10" />
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
    const notATable = notATableReason(table);
    if (notATable) {
      await dialog.alert({ title: "This isn't a list of transactions", message: notATable, tone: 'info' });
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
        subtitle="Any layout works: the columns are read for you. Nothing is saved until you check it and tap Import."
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

// ─── 2. Your sheet: a summary, or which column is what ──────────────────────

const typeCounts = (rows: readonly { type: TransactionType }[]) => {
  const byType = { income: 0, expense: 0, transfer: 0 };
  rows.forEach((row) => (byType[row.type] += 1));
  return byType;
};

/** Shown when the columns were read with confidence: what will come in, with a way to change it. */
function SummaryStep({
  source,
  options,
  draft,
  onChangeColumns,
  onNext,
}: {
  source: Source;
  options: ImportOptions;
  draft: Draft;
  onChangeColumns: () => void;
  onNext: () => void;
}) {
  const columns = sheetColumns(source.table, options.headerRow, options.columns);
  const used = columns.filter((column) => column.field);
  const unused = columns.filter((column) => !column.field);
  const byType = typeCounts(draft.rows);
  const dates = draft.rows.map((row) => row.date).sort();
  const problemRows = draftRowCount(draft) - draft.rows.length;

  return (
    <VStack className="gap-1 pt-2">
      <StepTitle title="Your sheet looks good" subtitle={`${source.name}. Check a few rows; nothing is saved yet.`} />
      <Card>
        <HStack className="items-start gap-3 p-4">
          <IconBadge icon={CheckCircleIcon} tone="income" />
          <VStack className="flex-1 gap-0.5">
            <Text className="text-2xl font-semibold leading-[34px] text-foreground">{count(draft.rows.length, 'entry', 'entries')}</Text>
            {dates.length > 0 ? (
              <Text className="text-sm text-muted-foreground">
                {formatFullDate(dates[0])} – {formatFullDate(dates[dates.length - 1])}
              </Text>
            ) : null}
            <Text className="pt-1 text-sm text-foreground">
              {count(byType.expense, 'expense')} · {count(byType.income, 'income', 'income')} · {count(byType.transfer, 'transfer')}
            </Text>
          </VStack>
        </HStack>
      </Card>

      <SectionHeader title="First rows" className="pb-2" />
      <PreviewRows draft={draft} />

      <SectionHeader title="Columns" className="pb-2" />
      <Card>
        <VStack className="gap-1.5 p-4">
          <Text className="text-sm text-foreground">
            <Text className="text-sm font-semibold text-foreground">Reading: </Text>
            {used.map((column) => column.name).join(' · ')}
          </Text>
          {unused.length > 0 ? (
            <Text className="text-sm text-muted-foreground">
              <Text className="text-sm font-semibold text-muted-foreground">Not used: </Text>
              {unused.map((column) => (column.computed ? `${column.name} (calculated)` : column.name)).join(' · ')}
            </Text>
          ) : null}
        </VStack>
      </Card>

      {problemRows > 0 ? (
        <>
          <SectionHeader title={`${count(problemRows, 'row')} with problems, left out`} className="pb-2" />
          <Problems draft={draft} limit={3} />
        </>
      ) : null}

      <Button label="Continue" size="lg" className="mt-6" onPress={onNext} />
      <Button label="Something wrong? Change columns" variant="link" className="mt-3 self-center" onPress={onChangeColumns} />
    </VStack>
  );
}

const FIELD_ORDER: ImportField[] = ['date', 'amount', 'moneyOut', 'moneyIn', 'type', 'from', 'to', 'account', 'category', 'note', 'party', 'id', 'linkedTo'];

const FIELD_OPTIONS: SelectOption[] = FIELD_ORDER.map((field) => ({
  value: field,
  label: IMPORT_FIELD_INFO[field].label,
  description: IMPORT_FIELD_INFO[field].hint,
}));

const DATE_ORDER_OPTIONS: SelectOption[] = (Object.keys(DATE_ORDER_LABELS) as DateOrder[]).map((value) => ({
  value,
  label: DATE_ORDER_LABELS[value],
}));

/** One card per column of the sheet: its examples and what it holds. Extra questions only when needed. */
function ColumnsStep({
  source,
  options,
  questions,
  draft,
  onChange,
  onNext,
}: {
  source: Source;
  options: ImportOptions;
  questions: ImportQuestions;
  draft: Draft;
  onChange: (next: Partial<ImportOptions>) => void;
  onNext: () => void;
}) {
  const { accounts } = useLedger();
  const { table, name } = source;
  const { headerRow, columns } = options;
  const sheet = sheetColumns(table, headerRow, columns);

  const headerOptions: SelectOption[] = [
    { value: 'none', label: 'No column names', description: 'The first row is already an entry' },
    ...table.slice(0, 10).map((row, i) => ({
      value: String(i),
      label: `Row ${i + 1}`,
      description: row.filter(Boolean).slice(0, 4).join(', '),
    })),
  ];
  const setHeader = (value: string | null) => {
    const row = value === null || value === 'none' ? null : Number(value);
    onChange({ headerRow: row, columns: guessColumns(table, row) });
  };

  const hasAmount = columns.amount !== undefined || columns.moneyIn !== undefined || columns.moneyOut !== undefined;
  const missing =
    columns.date === undefined
      ? 'Which column has the date? Choose “Date” on it.'
      : !hasAmount
        ? 'Which column has the amount? Choose “Amount” on it (or “Money out” / “Money in” for two columns).'
        : null;
  const extraQuestions = questions.dateOrder || questions.account || questions.type;

  return (
    <VStack className="gap-1 pt-2">
      <StepTitle
        title="Which column is what?"
        subtitle={`${name}: ${count(draftRowCount(draft), 'row')}. Check what each column holds; skip the ones you don't need.`}
      />

      {questions.headerRow ? (
        <SelectField
          label="Column names are in"
          hint="Title rows above the column names are skipped"
          value={headerRow === null ? 'none' : String(headerRow)}
          options={headerOptions}
          onChange={setHeader}
        />
      ) : null}

      <VStack className="gap-3 pt-3">
        {sheet.map((column) => (
          <Card key={column.index}>
            <VStack className="gap-2 p-4">
              <VStack className="gap-0.5">
                <Text numberOfLines={1} className="text-base font-semibold text-foreground">
                  {column.name}
                </Text>
                <Text numberOfLines={1} className="text-xs text-muted-foreground">
                  {column.samples.length > 0 ? column.samples.join(' · ') : 'Empty'}
                </Text>
              </VStack>
              <SelectField
                label="This is"
                value={column.field}
                options={FIELD_OPTIONS}
                sheetTitle={column.name}
                noneLabel="Skip this column"
                placeholder={column.computed ? 'Skipped (calculated in the sheet)' : 'Skip this column'}
                onChange={(value) => onChange({ columns: assignColumn(columns, column.index, value as ImportField | null) })}
              />
            </VStack>
          </Card>
        ))}
      </VStack>

      {extraQuestions ? (
        <>
          <SectionHeader title="A few more questions" className="pb-2" />
          <VStack className="gap-3">
            {questions.dateOrder ? (
              <SelectField
                label="Dates are written as"
                value={options.dateOrder}
                options={DATE_ORDER_OPTIONS}
                hint="Dates like 05/03 could be 5 March or 3 May"
                onChange={(value) => value && onChange({ dateOrder: value as DateOrder })}
              />
            ) : null}
            {questions.account ? (
              <SelectField
                label="Which account are these from?"
                value={options.defaultAccount}
                options={accounts.filter((a) => !a.archived).map((a) => ({ value: a.name, label: a.name }))}
                noneLabel="None"
                placeholder="Choose an account"
                hint="The sheet doesn't say, e.g. a statement from one bank"
                onChange={(value) => onChange({ defaultAccount: value })}
              />
            ) : null}
            {questions.type ? (
              <VStack className="gap-2">
                <Text className="text-sm font-medium text-foreground">The sheet doesn’t say; these rows are</Text>
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
        </>
      ) : null}

      <SectionHeader title="Preview" className="pb-0" />
      {missing ? <Notice tone="warning" text={missing} /> : <Preview draft={draft} />}

      <Button label="Continue" size="lg" className="mt-6" disabled={missing !== null || draft.rows.length === 0} onPress={onNext} />
    </VStack>
  );
}

function Preview({ draft }: { draft: Draft }) {
  const problemRows = draftRowCount(draft) - draft.rows.length;
  return (
    <VStack className="gap-3 pt-2">
      <Text className="text-sm text-muted-foreground">
        {count(draft.rows.length, 'row')} ready
        {problemRows > 0 ? `, ${count(problemRows, 'row')} with problems` : ''}
        {draft.skipped > 0 ? `, ${count(draft.skipped, 'total row')} left out` : ''}.
      </Text>
      <PreviewRows draft={draft} />
      {draft.problems.length > 0 ? <Problems draft={draft} limit={5} /> : null}
    </VStack>
  );
}

/** The first rows as they will be saved. */
function PreviewRows({ draft }: { draft: Draft }) {
  if (draft.rows.length === 0) return null;
  return (
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
  const [showMatched, setShowMatched] = useState(false);
  const unknown = needs.filter((need) => !need.existingId);
  const newAccounts = unknown.filter((need) => need.role === 'account');
  const newCategories = unknown.filter((need) => need.role !== 'account');
  const matched = needs.filter((need) => need.existingId);
  const row = (need: NameNeed) => (
    <NameRow key={need.key} need={need} choice={choices[need.key] ?? defaultChoice(need)} onChoose={(c) => onChoose(need.key, c)} />
  );

  return (
    <VStack className="gap-1 pt-2">
      <StepTitle
        title="New names"
        subtitle={`${count(unknown.length, 'name')} in the sheet ${unknown.length === 1 ? "isn't" : "aren't"} in the app yet. Each is created, or pick one you have.`}
      />

      {newAccounts.length > 0 ? (
        <>
          <SectionHeader title={`New accounts · ${newAccounts.length}`} className="pb-1" />
          <Text className="pb-3 text-sm text-muted-foreground">Check the type and enter the balance it had before its first entry.</Text>
          <VStack className="gap-3">{newAccounts.map(row)}</VStack>
        </>
      ) : null}

      {newCategories.length > 0 ? (
        <>
          <SectionHeader title={`New categories · ${newCategories.length}`} className="pb-3" />
          <VStack className="gap-3">{newCategories.map(row)}</VStack>
        </>
      ) : null}

      {matched.length > 0 ? (
        <Card className="mt-6">
          <VStack className="gap-2 p-4">
            <HStack className="items-center gap-3">
              <IconBadge icon={CheckCircleIcon} tone="income" />
              <Text className="flex-1 text-sm font-medium text-foreground">{count(matched.length, 'name')} already in the app</Text>
              <Button label={showMatched ? 'Hide' : 'Show'} variant="link" onPress={() => setShowMatched(!showMatched)} />
            </HStack>
            {showMatched ? <Text className="text-sm text-muted-foreground">{matched.map((need) => need.name).join(', ')}</Text> : null}
          </VStack>
        </Card>
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

