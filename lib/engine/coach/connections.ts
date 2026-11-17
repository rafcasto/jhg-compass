// The member's LinkedIn connections (docs/UX_COACH_COMPANY_SCORING.md §3): LinkedIn → Settings → Data privacy → Get a
// copy of your data → Connections → Connections.csv. Parsed by code on the turn route — never a model call, never in a
// transcript; the email column is dropped at parse. Matched to the Top 40 by company name so Access can be suggested
// with a person beside it. Pure. Tested.

export interface Connection { name: string; url: string; company: string; position: string; connectedOn: string }

/** The header LinkedIn writes (after up to three note lines). */
export const CONNECTIONS_HEADER = ["First Name", "Last Name", "URL", "Email Address", "Company", "Position", "Connected On"] as const;
/** A CSV that large is not a connections export (LinkedIn caps at 30,000 rows ≈ 3 MB). */
export const MAX_CONNECTIONS_CHARS = 6_000_000;
/** Rows per stored chunk — users/{uid}/connections/{n}; a chunk stays far under the 1 MiB document. */
export const CONNECTIONS_CHUNK = 500;
/** Named in the evidence line; the rest is a count. */
export const MAX_NAMED_CONTACTS = 3;

export const isConnectionsFileName = (name: string): boolean => /\.csv$/i.test(name.trim());

/** One CSV line → cells, RFC-4180 quotes honoured ("a, b" and doubled quotes). */
export function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "", inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else inQ = false; }
      else cur += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === ",") { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

/** Lines, with quoted line breaks inside a cell kept in the cell. */
function csvRecords(text: string): string[] {
  const records: string[] = [];
  let cur = "", inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') inQ = !inQ;
    if ((ch === "\n" || ch === "\r") && !inQ) { if (cur.trim()) records.push(cur); cur = ""; if (ch === "\r" && text[i + 1] === "\n") i++; continue; }
    cur += ch;
  }
  if (cur.trim()) records.push(cur);
  return records;
}

const headerIndex = (records: readonly string[]): number => records.findIndex((r) => { const cells = splitCsvLine(r).map((c) => c.toLowerCase()); return cells.includes("first name") && cells.includes("company") && cells.includes("position"); });

/** Whether a text is LinkedIn's connections export — its header within the first lines. */
export const isConnectionsCsv = (text: string): boolean => text.length <= MAX_CONNECTIONS_CHARS && headerIndex(csvRecords(text.slice(0, 4000))) >= 0;

/** The rows, the email column dropped, rows without a name skipped. */
export function parseConnections(text: string): Connection[] {
  const records = csvRecords(text);
  const h = headerIndex(records);
  if (h < 0) return [];
  const cols = splitCsvLine(records[h]).map((c) => c.toLowerCase());
  const ix = (name: string) => cols.indexOf(name);
  const iFirst = ix("first name"), iLast = ix("last name"), iUrl = ix("url"), iCompany = ix("company"), iPosition = ix("position"), iOn = ix("connected on");
  const out: Connection[] = [];
  for (const r of records.slice(h + 1)) {
    const c = splitCsvLine(r);
    const name = [c[iFirst], c[iLast]].filter(Boolean).join(" ").trim();
    if (!name) continue;
    out.push({ name, url: iUrl >= 0 ? c[iUrl] ?? "" : "", company: iCompany >= 0 ? c[iCompany] ?? "" : "", position: iPosition >= 0 ? c[iPosition] ?? "" : "", connectedOn: iOn >= 0 ? c[iOn] ?? "" : "" });
  }
  return out;
}

const STOP = new Set(["ltd", "limited", "pty", "inc", "llc", "plc", "co", "corp", "corporation", "company", "group", "holdings", "nz", "new", "zealand", "australia", "the", "and", "&"]);

/** A company name as a set of tokens worth comparing — "Fisher & Paykel Healthcare Ltd" → fisher paykel healthcare. */
export function companyTokens(name: string): string[] {
  return name.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").split(" ").filter((t) => t && !STOP.has(t));
}

/** Exact after normalisation, else every token of the shorter name inside the longer — two tokens at least, so "Halter" ≠ "Halter Marine" by one word alone. */
export function companyMatches(a: string, b: string): boolean {
  const ta = companyTokens(a), tb = companyTokens(b);
  if (!ta.length || !tb.length) return false;
  if (ta.join(" ") === tb.join(" ")) return true;
  const [short, long] = ta.length <= tb.length ? [ta, tb] : [tb, ta];
  if (short.length === 1) return false;
  return short.every((t) => long.includes(t));
}

/** The connections at each named company, in the order given. */
export function matchConnections(connections: readonly Connection[], companies: readonly string[]): Map<string, Connection[]> {
  const out = new Map<string, Connection[]>();
  for (const name of companies) {
    const at = connections.filter((c) => c.company && companyMatches(c.company, name));
    if (at.length) out.set(name, at);
  }
  return out;
}

export const chunkConnections = (rows: readonly Connection[], size = CONNECTIONS_CHUNK): Connection[][] => Array.from({ length: Math.ceil(rows.length / size) }, (_, i) => rows.slice(i * size, (i + 1) * size));
