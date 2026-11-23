/**
 * Turns a CSV file, or a table copied from Excel / Google Sheets / Word and pasted as text
 * (tab-separated), into rows of trimmed cells.
 */
import Papa from 'papaparse';

export type Table = string[][];

/** File types people may pick that aren't text tables, with what to do instead. */
const NOT_A_TABLE: { pattern: RegExp; message: string }[] = [
  {
    pattern: /\.(xlsx|xlsm|xls|ods|numbers)$/i,
    message:
      "This is a spreadsheet file, which can't be read directly. Save it as CSV (Excel: File → Save as → CSV; Google Sheets: File → Download → CSV), or select the cells, copy them and use Paste a table.",
  },
  {
    pattern: /\.(docx|doc|odt|rtf|pages)$/i,
    message:
      "Word files can't be read directly. Open it, select the table, copy it, then come back and use Paste a table.",
  },
  {
    pattern: /\.pdf$/i,
    message: "PDF files can't be read. If the table came from a spreadsheet, export that as CSV instead.",
  },
];

/** Why a picked file can't be imported (by name or binary content), or `null` if it looks like text. */
export function unreadableFileReason(name: string, text: string): string | null {
  const known = NOT_A_TABLE.find((entry) => entry.pattern.test(name));
  if (known) return known.message;
  // Zip-based files (xlsx, docx) start with "PK"; binary files contain NUL characters.
  if (text.startsWith('PK') || text.includes('\u0000')) {
    return "This file isn't a text table. Save your spreadsheet as CSV, or copy the table and use Paste a table.";
  }
  return null;
}

/**
 * Splits text into rows and cells. The separator (comma, semicolon or tab) is detected,
 * quotes are handled, cells trimmed and a formula-guarding apostrophe ("'=…") removed. Empty rows stay (so "Row 14" matches the sheet's row
 * numbers) except at the end; every row gets the same number of cells.
 */
export function parseTable(text: string): Table {
  const clean = text.replace(/^\uFEFF/, '');
  const result = Papa.parse<string[]>(clean, { delimitersToGuess: ['\t', ',', ';', '|'] });
  // "'=…": text the export (or the user) kept from being read as a formula; the apostrophe isn't part of it.
  const rows = result.data.map((row) => row.map((cell) => (cell ?? '').trim().replace(/^'(?=[=+\-@])/, '')));
  while (rows.length > 0 && rows[rows.length - 1].every((cell) => cell === '')) rows.pop();
  const width = rows.reduce((max, row) => Math.max(max, row.length), 0);
  return rows.map((row) => [...row, ...Array<string>(width - row.length).fill('')]);
}

/** A row with nothing in it. */
export const isEmptyRow = (row: readonly string[]) => row.every((cell) => cell === '');

/** "A", "B", … "Z", "AA" — how spreadsheets name columns. */
export function columnLetter(index: number): string {
  let n = index + 1;
  let letters = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    letters = String.fromCharCode(65 + rem) + letters;
    n = Math.floor((n - 1) / 26);
  }
  return letters;
}

/** Writes rows as CSV (quoting where needed), for the export. */
export function toCsv(rows: readonly (readonly (string | number)[])[]): string {
  return Papa.unparse(rows.map((row) => row.map(String)), { newline: '\r\n' });
}
