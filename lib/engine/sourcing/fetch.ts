import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { configuredAdapters, isQuotaError, quotaWords, type SourceAdapter } from "./adapters";
import { cacheFresh, cacheKey, meteredMaxFrom } from "./cache";
import { serpTopUpNeeded } from "./serp";
import { atsBoardApi, atsJobCount, atsOf, type AtsBoard } from "./ats";
import { companyKey, postingDocId, SOURCE_LABELS, type PipelineCountry, type Source, type SourcedPosting } from "./keys";
import { mergePostings, newestFirst, queriesFor, sourcingNote, type SourcingBrief } from "./plan";

// The sourcing step's server half (docs/AGENTIC_PIPELINE_PLAN.md §4 step 2): run the configured adapters for a brief,
// merge, write the shared collections. Zero tokens. A source that fails is reported in the note, never thrown — the
// others still count.

const TIMEOUT_MS = 10_000;
/** Metered sources rate-limit by the second: a pause between requests, and one retry after a longer one on a 429. */
const METERED_SPACING_MS = 1_100;
const RETRY_AFTER_MS = 4_000;
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const URL_TIMEOUT_MS = 8000;

/** Whether a URL opens — a GET that answers under 400 within the timeout. The one verification every job uses. */
export async function opens(url: string): Promise<boolean> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), URL_TIMEOUT_MS);
  try {
    const r = await fetch(url, { method: "GET", redirect: "follow", signal: ctl.signal, headers: { "user-agent": "Mozilla/5.0 (compatible; JobHackerCompass/1.0)", accept: "text/html,*/*" } });
    return r.status < 400;
  } catch { return false; }
  finally { clearTimeout(t); }
}

export async function mapLimit<T, R>(items: readonly T[], limit: number, f: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => { for (;;) { const n = i++; if (n >= items.length) return; out[n] = await f(items[n]); } }));
  return out;
}

/** Any adapter has a key — the postings job sources by API; otherwise it falls back to the model's search. */
export const sourcingConfigured = (env: Record<string, string | undefined> = process.env): boolean => configuredAdapters(env).length > 0;

export const configuredSources = (env: Record<string, string | undefined> = process.env): Source[] => configuredAdapters(env).map((a) => a.source);

async function getJson(url: string, headers: Record<string, string> = {}): Promise<unknown> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(url, { signal: ctl.signal, headers: { accept: "application/json", "user-agent": "JobHackerCompass/1.0", ...headers } });
    if (!r.ok) { const body = (await r.text().catch(() => "")).replace(/\s+/g, " ").trim().slice(0, 120); throw new Error(`HTTP ${r.status}${body ? ` — ${body}` : ""}`); }
    return await r.json();
  } finally { clearTimeout(t); }
}

export interface SourcingRun { rows: SourcedPosting[]; note: string; queries: number; /** Paid searches spent on the top-up. */ metered: number }

/** Enough unique rows from the free sources that the metered top-up is not needed — the target with room for the links that won't open. */
export const ENOUGH_FOR_NO_TOP_UP = 30;

/** Every configured source for the brief's country — free ones for every query, the metered one only to fill a gap, within its cap; merged newest first. */
export interface SourcingOptions {
  /** Queries a run may make in all (the planner's cap). */
  maxQueries?: number;
  /** Queries the metered source may spend — the companies job allows more than the postings top-up. */
  meteredMax?: number;
  /** Run the metered source for every query, not only to fill a gap — when the field is the point. */
  meteredAlways?: boolean;
  /** Rows from the free sources that make the metered top-up unnecessary (default ENOUGH_FOR_NO_TOP_UP; the companies job wants more). */
  enough?: number;
}

export async function sourcePostings(brief: SourcingBrief, log: (line: string) => Promise<void> = async () => {}, today = new Date().toISOString().slice(0, 10), opts: SourcingOptions = {}): Promise<SourcingRun> {
  const queries = queriesFor(brief, opts.maxQueries);
  const parts: { source: string; country: PipelineCountry; queries: number; rows: number; error?: string }[] = [];
  const lists: SourcedPosting[][] = [];
  let metered = 0;
  let freeRan = false;
  let meteredUsed = false;
  for (const a of configuredAdapters()) {
    if (a.metered && meteredUsed) continue; // one metered source a run; the next is the fallback below
    if (a.metered && !opts.meteredAlways && !serpTopUpNeeded(mergePostings(lists).length, freeRan, opts.enough ?? ENOUGH_FOR_NO_TOP_UP)) { await log(`${SOURCE_LABELS[a.source]} skipped — the free sources were enough`); break; }
    const got: SourcedPosting[] = [];
    let error: string | undefined;
    let quotaOut = false;
    const meteredCap = Math.min(opts.meteredMax ?? a.maxQueries, meteredMaxFrom());
    if (a.metered && meteredCap === 0) { await log(`${SOURCE_LABELS[a.source]} switched off (SOURCING_METERED_MAX=0)`); continue; }
    const mine = queries.slice(0, a.metered ? meteredCap : a.maxQueries);
    let spent = 0;
    for (const q of mine) {
      try {
        // Asked today already — by anyone: the shared cache answers and nothing is spent.
        const cached = await readCache(a, q, brief.country);
        if (cached) { got.push(...cached.map((r) => ({ ...r, foundBy: { what: q.what, from: q.from, ...(q.industry ? { industry: q.industry } : {}) } }))); await log(`${SOURCE_LABELS[a.source]} · "${q.what}" in ${q.where || brief.country} · ${cached.length} rows (cached)`); continue; }
        if (a.metered && spent > 0) await sleep(METERED_SPACING_MS);
        const rows = await fetchQuery(a, q, brief.country, today);
        spent++;
        await writeCache(a, q, brief.country, rows);
        got.push(...rows);
        if (a.metered) metered++;
        await log(`${SOURCE_LABELS[a.source]} · "${q.what}" in ${q.where || brief.country} · ${rows.length} rows`);
      } catch (e) {
        error = e instanceof Error ? e.message : String(e);
        if (a.metered) metered++;
        await log(`${SOURCE_LABELS[a.source]} · "${q.what}" failed: ${error}`);
        // Out for the month: every further query would fail the same way — stop spending and let the next metered source take over.
        if (a.metered && isQuotaError(error)) { quotaOut = true; error = `${error} — ${quotaWords(a.source)}`; break; }
      }
    }
    if (!a.metered) freeRan = true;
    parts.push({ source: SOURCE_LABELS[a.source], country: brief.country, queries: mine.length, rows: got.length, ...(error && !got.length ? { error } : {}) });
    lists.push(got);
    if (a.metered) { if (quotaOut && !got.length) { await log(`${SOURCE_LABELS[a.source]} is out — trying the next source`); continue; } meteredUsed = true; }
  }
  const rows = newestFirst(mergePostings(lists));
  return { rows, note: sourcingNote(parts, rows.length), queries: queries.length, metered };
}

// The shared query cache — sourcingCache/{source_country_what_where}: the rows and when they were fetched; 24 h.
interface CacheDoc { rows: SourcedPosting[]; fetchedAt: number }
async function readCache(a: SourceAdapter, q: { what: string; where: string }, country: PipelineCountry): Promise<SourcedPosting[] | null> {
  try {
    const snap = await adminDb().doc(`sourcingCache/${cacheKey(a.source, country, q.what, q.where)}`).get();
    const d = snap.exists ? (snap.data() as CacheDoc) : null;
    return d && cacheFresh(d.fetchedAt) && Array.isArray(d.rows) ? d.rows.map(({ foundBy: _f, ...r }) => r as SourcedPosting) : null;
  } catch { return null; }
}
async function writeCache(a: SourceAdapter, q: { what: string; where: string }, country: PipelineCountry, rows: readonly SourcedPosting[]): Promise<void> {
  try { await adminDb().doc(`sourcingCache/${cacheKey(a.source, country, q.what, q.where)}`).set({ source: a.source, country, what: q.what, where: q.where, rows: rows.map(({ foundBy: _f, ...r }) => r), fetchedAt: Date.now() }); } catch { /* a cache miss next time is the only cost */ }
}

/** One query against one source — a 429 is retried once after a pause (a burst limit clears; a monthly quota does not, and the caller stops). */
async function fetchQuery(a: SourceAdapter, q: { what: string; where: string; from: "title" | "competency" | "industry"; industry?: string }, country: PipelineCountry, today: string): Promise<SourcedPosting[]> {
  const once = async () => a.parse(await getJson(a.url(q, country, process.env), a.headers?.(process.env)), country, today).map((r) => ({ ...r, foundBy: { what: q.what, from: q.from, ...(q.industry ? { industry: q.industry } : {}) } }));
  try { return await once(); }
  catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (!a.metered || !isQuotaError(message)) throw e;
    await sleep(RETRY_AFTER_MS);
    return once();
  }
}

/** jobPostings/{source}_{externalId} and companies/{key} upserts (plan §6) — shared, server-written; a company never accumulates its postings. */
export async function upsertSourced(rows: readonly SourcedPosting[]): Promise<void> {
  if (!rows.length) return;
  const db = adminDb();
  const now = Date.now();
  let batch = db.batch(); let n = 0;
  const flush = async () => { if (n) { await batch.commit(); batch = db.batch(); n = 0; } };
  const companies = new Map<string, SourcedPosting>();
  for (const p of rows) {
    const key = companyKey(p.company);
    companies.set(key, p);
    batch.set(db.doc(`jobPostings/${postingDocId(p)}`), { ...p, companyKey: key, isLive: true, fetchedAt: now }, { merge: true });
    if (++n >= 400) await flush();
  }
  for (const [key, p] of companies) {
    batch.set(db.doc(`companies/${key}`), { key, name: p.company, country: p.country, location: p.location, ...(p.companyWebsite ? { website: p.companyWebsite } : {}), lastSeenAt: now, postingsSeen: FieldValue.increment(1) }, { merge: true });
    if (++n >= 400) await flush();
  }
  await flush();
}

/** A careers URL confirmed by code: the ATS board answers with a job list (plan §5). null when the URL is no known board. */
export async function confirmCareersUrl(url: string): Promise<{ board: AtsBoard; jobs: number } | null> {
  const board = atsOf(url);
  if (!board) return null;
  try {
    const json = await getJson(atsBoardApi(board));
    const jobs = atsJobCount(board.provider, json);
    return jobs === null ? null : { board, jobs };
  } catch { return null; }
}
