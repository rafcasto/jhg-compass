import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { adzunaConfigured, adzunaUrl, parseAdzuna } from "./adzuna";
import { careerjetConfigured, careerjetUrl, parseCareerjet } from "./careerjet";
import { atsBoardApi, atsJobCount, atsOf, type AtsBoard } from "./ats";
import { companyKey, postingDocId, SOURCE_LABELS, type PipelineCountry, type Source, type SourcedPosting } from "./keys";
import { mergePostings, newestFirst, queriesFor, sourcingNote, type SourcingBrief } from "./plan";

// The sourcing step's server half (docs/AGENTIC_PIPELINE_PLAN.md §4 step 2): run the configured adapters for a brief,
// merge, write the shared collections. Zero tokens. A source that fails is reported in the note, never thrown — the
// others still count.

const TIMEOUT_MS = 10_000;

/** Any adapter has a key — the postings job sources by API; otherwise it falls back to the model's search. */
export const sourcingConfigured = (env: Record<string, string | undefined> = process.env): boolean => adzunaConfigured(env) || careerjetConfigured(env);

export const configuredSources = (env: Record<string, string | undefined> = process.env): Source[] => [...(adzunaConfigured(env) ? (["adzuna"] as const) : []), ...(careerjetConfigured(env) ? (["careerjet"] as const) : [])];

async function getJson(url: string): Promise<unknown> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(url, { signal: ctl.signal, headers: { accept: "application/json", "user-agent": "JobHackerCompass/1.0" } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally { clearTimeout(t); }
}

export interface SourcingRun { rows: SourcedPosting[]; note: string; queries: number }

/** Every configured source for the brief's country, each query once; merged newest first. */
export async function sourcePostings(brief: SourcingBrief, log: (line: string) => Promise<void> = async () => {}): Promise<SourcingRun> {
  const queries = queriesFor(brief);
  const parts: { source: string; country: PipelineCountry; queries: number; rows: number; error?: string }[] = [];
  const lists: SourcedPosting[][] = [];
  for (const source of configuredSources()) {
    const got: SourcedPosting[] = [];
    let error: string | undefined;
    for (const q of queries) {
      try {
        const url = source === "adzuna" ? adzunaUrl({ country: brief.country, what: q.what, where: q.where }) : careerjetUrl({ country: brief.country, keywords: q.what, location: q.where });
        const json = await getJson(url);
        const rows = source === "adzuna" ? parseAdzuna(json, brief.country) : parseCareerjet(json, brief.country);
        got.push(...rows);
        await log(`${SOURCE_LABELS[source]} · "${q.what}" in ${q.where || brief.country} · ${rows.length} rows`);
      } catch (e) {
        error = e instanceof Error ? e.message : String(e);
        await log(`${SOURCE_LABELS[source]} · "${q.what}" failed: ${error}`);
      }
    }
    parts.push({ source: SOURCE_LABELS[source], country: brief.country, queries: queries.length, rows: got.length, ...(error && !got.length ? { error } : {}) });
    lists.push(got);
  }
  const rows = newestFirst(mergePostings(lists));
  return { rows, note: sourcingNote(parts, rows.length), queries: queries.length };
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
