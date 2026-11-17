import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { configuredAdapters } from "./adapters";
import { serpTopUpNeeded } from "./serp";
import { atsBoardApi, atsJobCount, atsOf, type AtsBoard } from "./ats";
import { companyKey, postingDocId, SOURCE_LABELS, type PipelineCountry, type Source, type SourcedPosting } from "./keys";
import { mergePostings, newestFirst, queriesFor, sourcingNote, type SourcingBrief } from "./plan";

// The sourcing step's server half (docs/AGENTIC_PIPELINE_PLAN.md §4 step 2): run the configured adapters for a brief,
// merge, write the shared collections. Zero tokens. A source that fails is reported in the note, never thrown — the
// others still count.

const TIMEOUT_MS = 10_000;
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

async function getJson(url: string): Promise<unknown> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(url, { signal: ctl.signal, headers: { accept: "application/json", "user-agent": "JobHackerCompass/1.0" } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally { clearTimeout(t); }
}

export interface SourcingRun { rows: SourcedPosting[]; note: string; queries: number; /** Paid searches spent on the top-up. */ metered: number }

/** Enough unique rows from the free sources that the metered top-up is not needed — the target with room for the links that won't open. */
export const ENOUGH_FOR_NO_TOP_UP = 30;

/** Every configured source for the brief's country — free ones for every query, the metered one only to fill a gap, within its cap; merged newest first. */
export async function sourcePostings(brief: SourcingBrief, log: (line: string) => Promise<void> = async () => {}, today = new Date().toISOString().slice(0, 10)): Promise<SourcingRun> {
  const queries = queriesFor(brief);
  const parts: { source: string; country: PipelineCountry; queries: number; rows: number; error?: string }[] = [];
  const lists: SourcedPosting[][] = [];
  let metered = 0;
  let freeRan = false;
  for (const a of configuredAdapters()) {
    if (a.metered && !serpTopUpNeeded(mergePostings(lists).length, freeRan, ENOUGH_FOR_NO_TOP_UP)) { await log(`${SOURCE_LABELS[a.source]} skipped — the free sources were enough`); continue; }
    const got: SourcedPosting[] = [];
    let error: string | undefined;
    const mine = queries.slice(0, a.maxQueries);
    for (const q of mine) {
      try {
        const json = await getJson(a.url(q, brief.country, process.env));
        const rows = a.parse(json, brief.country, today);
        got.push(...rows);
        if (a.metered) metered++;
        await log(`${SOURCE_LABELS[a.source]} · "${q.what}" in ${q.where || brief.country} · ${rows.length} rows`);
      } catch (e) {
        error = e instanceof Error ? e.message : String(e);
        if (a.metered) metered++;
        await log(`${SOURCE_LABELS[a.source]} · "${q.what}" failed: ${error}`);
      }
    }
    if (!a.metered) freeRan = true;
    parts.push({ source: SOURCE_LABELS[a.source], country: brief.country, queries: mine.length, rows: got.length, ...(error && !got.length ? { error } : {}) });
    lists.push(got);
  }
  const rows = newestFirst(mergePostings(lists));
  return { rows, note: sourcingNote(parts, rows.length), queries: queries.length, metered };
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
    batch.set(db.doc(`companies/${key}`), { key, name: p.company, country: p.country, location: p.location, lastSeenAt: now, postingsSeen: FieldValue.increment(1) }, { merge: true });
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
