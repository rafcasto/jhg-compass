// Minimal, dependency-free CSV reader / writer (RFC 4180 flavour).
//
// Handles what real-world exports throw at us: quoted fields, doubled quotes
// inside quotes, newlines inside quotes, CRLF / CR / LF line endings, a UTF-8
// BOM, and — because Excel in many locales saves "CSV" with semicolons — the
// delimiter is sniffed from the header line (`,` / `;` / tab).
//
// Pure module: shared by the client import sheet and the unit tests.

export type Delimiter = "," | ";" | "\t";

// Pick the delimiter that appears most often (outside quotes) on the first line.
export function detectDelimiter(text: string): Delimiter {
  const firstLine = text.split(/\r\n|\r|\n/, 1)[0] ?? "";
  const counts: Record<Delimiter, number> = { ",": 0, ";": 0, "\t": 0 };
  let inQuotes = false;
  for (const ch of firstLine) {
    if (ch === '"') inQuotes = !inQuotes;
    else if (!inQuotes && ch in counts) counts[ch as Delimiter]++;
  }
  return (Object.keys(counts) as Delimiter[]).reduce((best, d) => (counts[d] > counts[best] ? d : best), ",");
}

// One parsed row plus the physical line (1-based) it starts on, so import
// errors can point at the line the user sees in their spreadsheet even when
// blank lines were skipped or a quoted cell spans several lines.
export interface CsvRow { line: number; cells: string[] }

// Parse CSV text into rows. Fully-blank rows are dropped; cell values are
// returned verbatim (callers trim as appropriate).
export function parseCsvRows(input: string, delimiter?: Delimiter): CsvRow[] {
  const text = input.replace(/^\uFEFF/, "");
  const delim = delimiter ?? detectDelimiter(text);
  const rows: CsvRow[] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  let line = 1;
  let rowStart = 1;

  const endCell = () => { row.push(cell); cell = ""; };
  const endRow = () => {
    endCell();
    if (row.some((c) => c.trim() !== "")) rows.push({ line: rowStart, cells: row });
    row = [];
  };
  // consume a line break at i (handles \r\n as one); returns the index of its last char
  const newline = (i: number) => (text[i] === "\r" && text[i + 1] === "\n" ? i + 1 : i);

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; } // escaped quote
        else inQuotes = false;
      } else if (ch === "\r" || ch === "\n") {
        i = newline(i); cell += "\n"; line++;
      } else cell += ch;
      continue;
    }
    if (ch === '"') { inQuotes = true; continue; }
    if (ch === delim) { endCell(); continue; }
    if (ch === "\r" || ch === "\n") { i = newline(i); endRow(); line++; rowStart = line; continue; }
    cell += ch;
  }
  // flush the last row (files without a trailing newline)
  if (cell !== "" || row.length) endRow();
  return rows;
}

// Cells only — convenience for callers that don't need line numbers.
export function parseCsv(input: string, delimiter?: Delimiter): string[][] {
  return parseCsvRows(input, delimiter).map((r) => r.cells);
}

// Serialise rows to CSV. Cells are quoted only when they need to be.
export function toCsv(rows: (string | number | null | undefined)[][], delimiter: Delimiter = ","): string {
  const needsQuote = new RegExp(`[${delimiter === "\t" ? "\\t" : delimiter}"\\r\\n]`);
  const esc = (v: string | number | null | undefined) => {
    const s = v == null ? "" : String(v);
    return needsQuote.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return rows.map((r) => r.map(esc).join(delimiter)).join("\r\n") + "\r\n";
}
