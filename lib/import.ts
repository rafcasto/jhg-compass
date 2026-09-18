// CSV import for the Progress tab: contacts and opportunities (jobs).
//
// Pure module — no Firestore here. It turns CSV text into the exact documents
// the tracker already writes (users/{uid}/contacts, users/{uid}/opportunities),
// with per-row errors / warnings and duplicate detection, so the UI can show a
// preview before anything is saved. The same column specs generate the
// downloadable templates (public/templates/*.csv are committed copies — a test
// keeps them in sync).
//
// Header matching is forgiving: "Full name", "full_name", "fullName" and
// "FULL-NAME" are all the same column, and each column has a few aliases.

import { parseCsvRows, toCsv } from "./csv";
import { CONTACT_TYPES, DEFAULT_CONTACT_TYPE, normalizeContactType, type ContactType } from "./contacts";
import type { Market } from "./categories";
import type { Contact, NoteEntry, Opportunity, Stage } from "./types";

export const MAX_IMPORT_ROWS = 1000;

// ---- column specs -----------------------------------------------------------
export interface ColumnSpec {
  key: string;        // property on the parsed row
  header: string;     // header used in the template
  required?: boolean;
  aliases?: string[]; // other accepted header names
  help: string;       // shown in the import sheet's column guide
  example: string;    // template sample value
}

export const CONTACT_COLUMNS: ColumnSpec[] = [
  { key: "fullName", header: "Full name", required: true, aliases: ["name", "contact", "contact name"],
    help: "The person's name.", example: "Jane Doe" },
  { key: "company", header: "Company", aliases: ["organisation", "organization", "employer"],
    help: "Where they work.", example: "Acme Corp" },
  { key: "role", header: "Role", aliases: ["title", "job title", "position"],
    help: "Their job title.", example: "Head of Engineering" },
  { key: "type", header: "Type", aliases: ["contact type"],
    help: "hiring_manager · peer · influencer · referrer (blank = hiring_manager).", example: "hiring_manager" },
  { key: "email", header: "Email", aliases: ["email address", "e-mail"],
    help: "Used to link jobs to this contact.", example: "jane.doe@acme.com" },
  { key: "phone", header: "Phone", aliases: ["phone number", "mobile", "tel", "telephone"],
    help: "Any format.", example: "+1 555 010 1234" },
  { key: "linkedinUrl", header: "LinkedIn URL", aliases: ["linkedin", "linkedin profile", "linkedin url"],
    help: "Profile link.", example: "https://www.linkedin.com/in/janedoe" },
  { key: "notes", header: "Notes", aliases: ["note", "comments", "comment"],
    help: "Saved as the first entry in the contact's conversation notes.", example: "Met at the March meetup — warm intro via Sam" },
];

export const OPPORTUNITY_COLUMNS: ColumnSpec[] = [
  { key: "company", header: "Company", required: true, aliases: ["organisation", "organization", "employer"],
    help: "The company you're targeting.", example: "Acme Corp" },
  { key: "role", header: "Role", aliases: ["title", "job title", "position"],
    help: "The role / job title.", example: "Senior Product Manager" },
  { key: "market", header: "Market", aliases: ["job market"],
    help: "hidden or visible (blank = hidden).", example: "hidden" },
  { key: "stage", header: "Stage", aliases: ["status", "column", "pipeline stage", "pipeline"],
    help: "A board column name, e.g. Wishlist, Outreach, Application (blank = first column).", example: "Outreach" },
  { key: "source", header: "Source", aliases: ["job source", "found via"],
    help: "Where the lead came from.", example: "Referral from Jane" },
  { key: "url", header: "URL", aliases: ["link", "job link", "job url", "posting"],
    help: "Link to the posting or company page.", example: "https://acme.com/careers/123" },
  { key: "contacts", header: "Contacts", aliases: ["contact", "contact emails", "contact names", "people"],
    help: "Existing contacts to attach — emails or full names, separated by ; (import contacts first).", example: "jane.doe@acme.com; John Smith" },
  { key: "notes", header: "Notes", aliases: ["note", "comments", "comment"],
    help: "Free text, shown on the job card.", example: "Reached out on LinkedIn, waiting for reply" },
];

// ---- templates ---------------------------------------------------------------
// Prefix a UTF-8 BOM so Excel opens accents / em dashes correctly. Used for the
// downloaded templates and the committed copies in public/templates.
export const templateFile = (csv: string) => "\uFEFF" + csv;

export function contactsCsvTemplate(): string {
  const rows: string[][] = [
    CONTACT_COLUMNS.map((c) => c.header),
    CONTACT_COLUMNS.map((c) => c.example),
    ["John Smith", "Acme Corp", "Staff Engineer", "peer", "john.smith@acme.com", "", "https://www.linkedin.com/in/johnsmith", "Ex-colleague, happy to refer me"],
    ["Priya Patel", "Northwind", "Talent Partner", "referrer", "priya@northwind.io", "+44 20 7946 0000", "", ""],
  ];
  return toCsv(rows);
}

export function opportunitiesCsvTemplate(stages: Stage[]): string {
  const label = (i: number) => stages[Math.min(i, stages.length - 1)]?.label ?? "";
  const rows: string[][] = [
    OPPORTUNITY_COLUMNS.map((c) => c.header),
    ["Acme Corp", "Senior Product Manager", "hidden", label(1), "Referral from Jane", "https://acme.com/careers/123", "jane.doe@acme.com; John Smith", "Reached out on LinkedIn, waiting for reply"],
    ["Northwind", "Product Lead", "visible", label(3), "LinkedIn Jobs", "https://www.linkedin.com/jobs/view/123", "Priya Patel", "Applied via the careers page"],
    ["Globex", "Director of Product", "hidden", label(0), "", "", "", ""],
  ];
  return toCsv(rows);
}

// ---- parse result ------------------------------------------------------------
export interface ImportIssue { line: number; message: string }

export interface ImportRow<T> {
  line: number;          // 1-based line in the CSV (header is line 1)
  data: T;               // the document to write (minus createdAt)
  duplicate: boolean;    // already exists (or repeats an earlier row)
  warnings: string[];
}

export interface ImportResult<T> {
  rows: ImportRow<T>[];
  errors: ImportIssue[];       // rows that will be skipped
  missingColumns: string[];    // required headers not found → nothing importable
  unknownColumns: string[];    // ignored headers (informational)
  totalRows: number;           // data rows found in the file
  tooMany: boolean;            // over MAX_IMPORT_ROWS (rows truncated)
}

export type ContactDoc = Omit<Contact, "id" | "createdAt">;
export type OpportunityDoc = Omit<Opportunity, "id" | "createdAt">;

// ---- helpers -----------------------------------------------------------------
// "Full Name" / "full_name" / "fullName" / "FULL-NAME" → "fullname"
export const compact = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

function mapHeaders(header: string[], specs: ColumnSpec[]) {
  const index: Record<string, number> = {};
  const unknown: string[] = [];
  for (let i = 0; i < header.length; i++) {
    const h = compact(header[i]);
    if (!h) continue;
    const spec = specs.find((s) => compact(s.header) === h || compact(s.key) === h || (s.aliases ?? []).some((a) => compact(a) === h));
    if (spec && !(spec.key in index)) index[spec.key] = i;
    else if (!spec) unknown.push(header[i].trim());
  }
  const missing = specs.filter((s) => s.required && !(s.key in index)).map((s) => s.header);
  return { index, unknown, missing };
}

const cellOf = (row: string[], index: Record<string, number>, key: string) => {
  const i = index[key];
  return i == null ? "" : (row[i] ?? "").trim();
};

// Add https:// to bare domains so links open (linkedin.com/in/x → https://linkedin.com/in/x).
export function normalizeUrl(u: string): string {
  const s = u.trim();
  if (!s) return "";
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(s) ? s : `https://${s}`;
}

// Accept ids ("hiring_manager"), labels ("Hiring manager"), admin-renamed labels,
// and legacy values ("recruiter"). Returns null for an unrecognised non-blank value.
export function parseContactType(raw: string, labels?: Partial<Record<ContactType, string>>): ContactType | null {
  const v = compact(raw);
  if (!v) return DEFAULT_CONTACT_TYPE;
  for (const ct of CONTACT_TYPES) {
    if (compact(ct) === v) return ct;
    if (labels?.[ct] && compact(labels[ct]!) === v) return ct;
  }
  const builtIn: Record<string, ContactType> = { hiringmanager: "hiring_manager", manager: "hiring_manager", peer: "peer", influencer: "influencer", referrer: "referrer" };
  if (builtIn[v]) return builtIn[v];
  const legacy = ["prospect", "referral", "recruiter", "coach"];
  if (legacy.includes(v)) return normalizeContactType(v);
  return null;
}

export function parseMarket(raw: string): Market | null {
  const v = compact(raw);
  if (!v) return "hidden";
  if (v === "hidden" || v === "h") return "hidden";
  if (v === "visible" || v === "v") return "visible";
  return null;
}

// Match a stage by id or label (case / punctuation / emoji-insensitive).
export function parseStage(raw: string, stages: Stage[]): string | null {
  const v = compact(raw);
  if (!v) return stages[0]?.id ?? null;
  const hit = stages.find((s) => compact(s.id) === v || compact(s.label) === v);
  return hit ? hit.id : null;
}

interface ContactRef { id: string; fullName?: string; email?: string }

// Resolve "jane@acme.com; John Smith" against the member's contacts.
export function resolveContactRefs(raw: string, contacts: ContactRef[]): { ids: string[]; unmatched: string[] } {
  const ids: string[] = [];
  const unmatched: string[] = [];
  for (const token of raw.split(/[;|]/).map((s) => s.trim()).filter(Boolean)) {
    const t = token.toLowerCase();
    const hit = contacts.find((c) => (c.email ?? "").trim().toLowerCase() === t)
      ?? contacts.find((c) => compact(c.fullName ?? "") === compact(token));
    if (hit) { if (!ids.includes(hit.id)) ids.push(hit.id); }
    else unmatched.push(token);
  }
  return { ids, unmatched };
}

function emptyResult<T>(missingColumns: string[] = [], unknownColumns: string[] = []): ImportResult<T> {
  return { rows: [], errors: [], missingColumns, unknownColumns, totalRows: 0, tooMany: false };
}

// ---- contacts ----------------------------------------------------------------
export interface ParseContactsOptions {
  existing?: Pick<Contact, "id" | "fullName" | "company" | "email">[];
  typeLabels?: Partial<Record<ContactType, string>>; // admin-renamed option labels
  now?: number;
}

export function parseContactsCsv(text: string, opts: ParseContactsOptions = {}): ImportResult<ContactDoc> {
  const table = parseCsvRows(text);
  if (table.length === 0) return emptyResult();
  const [header, ...body] = table;
  const { index, unknown, missing } = mapHeaders(header.cells, CONTACT_COLUMNS);
  if (missing.length) return { ...emptyResult<ContactDoc>(missing, unknown), totalRows: body.length };

  const tooMany = body.length > MAX_IMPORT_ROWS;
  const data = tooMany ? body.slice(0, MAX_IMPORT_ROWS) : body;
  const now = opts.now ?? Date.now();

  const seenEmails = new Set((opts.existing ?? []).map((c) => (c.email ?? "").trim().toLowerCase()).filter(Boolean));
  const seenNames = new Set((opts.existing ?? []).map((c) => compact(c.fullName) + "|" + compact(c.company ?? "")));

  const rows: ImportRow<ContactDoc>[] = [];
  const errors: ImportIssue[] = [];

  for (const { line, cells } of data) {
    const get = (k: string) => cellOf(cells, index, k);
    const fullName = get("fullName");
    if (!fullName) { errors.push({ line, message: "Missing full name" }); continue; }

    const warnings: string[] = [];
    const typeRaw = get("type");
    let type = parseContactType(typeRaw, opts.typeLabels);
    if (type === null) { warnings.push(`Unknown type "${typeRaw}" — set to ${DEFAULT_CONTACT_TYPE}`); type = DEFAULT_CONTACT_TYPE; }

    const email = get("email");
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) warnings.push(`"${email}" doesn't look like an email`);

    const company = get("company");
    const emailKey = email.toLowerCase();
    const nameKey = compact(fullName) + "|" + compact(company);
    const duplicate = (!!emailKey && seenEmails.has(emailKey)) || seenNames.has(nameKey);
    if (emailKey) seenEmails.add(emailKey);
    seenNames.add(nameKey);

    const notes = get("notes");
    const log: NoteEntry[] = notes ? [{ at: now, text: notes }] : [];

    const doc: ContactDoc = {
      fullName, company, role: get("role"), type, email, phone: get("phone"),
      linkedinUrl: normalizeUrl(get("linkedinUrl")), log,
    };
    rows.push({ line, data: doc, duplicate, warnings });
  }

  return { rows, errors, missingColumns: [], unknownColumns: unknown, totalRows: body.length, tooMany };
}

// ---- opportunities -----------------------------------------------------------
export interface ParseOpportunitiesOptions {
  stages: Stage[];
  contacts?: Pick<Contact, "id" | "fullName" | "email">[];
  existing?: Pick<Opportunity, "id" | "company" | "role">[];
}

export function parseOpportunitiesCsv(text: string, opts: ParseOpportunitiesOptions): ImportResult<OpportunityDoc> {
  const table = parseCsvRows(text);
  if (table.length === 0) return emptyResult();
  const [header, ...body] = table;
  const { index, unknown, missing } = mapHeaders(header.cells, OPPORTUNITY_COLUMNS);
  if (missing.length) return { ...emptyResult<OpportunityDoc>(missing, unknown), totalRows: body.length };

  const tooMany = body.length > MAX_IMPORT_ROWS;
  const data = tooMany ? body.slice(0, MAX_IMPORT_ROWS) : body;
  const firstStage = opts.stages[0]?.id ?? "";

  const seen = new Set((opts.existing ?? []).map((o) => compact(o.company) + "|" + compact(o.role ?? "")));
  const rows: ImportRow<OpportunityDoc>[] = [];
  const errors: ImportIssue[] = [];

  for (const { line, cells } of data) {
    const get = (k: string) => cellOf(cells, index, k);
    const company = get("company");
    if (!company) { errors.push({ line, message: "Missing company" }); continue; }

    const warnings: string[] = [];
    const marketRaw = get("market");
    let market = parseMarket(marketRaw);
    if (market === null) { warnings.push(`Unknown market "${marketRaw}" — set to hidden`); market = "hidden"; }

    const stageRaw = get("stage");
    let stage = parseStage(stageRaw, opts.stages);
    if (stage === null) { warnings.push(`Unknown stage "${stageRaw}" — placed in ${opts.stages[0]?.label ?? "the first column"}`); stage = firstStage; }

    const { ids: contactIds, unmatched } = resolveContactRefs(get("contacts"), opts.contacts ?? []);
    for (const u of unmatched) warnings.push(`Contact not found: "${u}"`);

    const role = get("role");
    const key = compact(company) + "|" + compact(role);
    const duplicate = seen.has(key);
    seen.add(key);

    const doc: OpportunityDoc = {
      company, role, market, stage, source: get("source"), url: normalizeUrl(get("url")),
      notes: get("notes"), contactIds, log: [],
    };
    rows.push({ line, data: doc, duplicate, warnings });
  }

  return { rows, errors, missingColumns: [], unknownColumns: unknown, totalRows: body.length, tooMany };
}
