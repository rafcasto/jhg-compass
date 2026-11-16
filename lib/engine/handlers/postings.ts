import "server-only";
import { adminDb } from "@/lib/firebase/admin";
import { profileFromSetup } from "@/lib/careerops/profile-file";
import type { CareerOpsSetupV2 } from "@/lib/careerops/types";
import type { Profile } from "@/lib/types";
import { ClaudeRefusal, call, callJson, sourcesOf, usageLine } from "../claude";
import { resolvePrompt } from "../config";
import { getPromptOverride } from "../config-server";
import { applyCoachPatch } from "../coach/write";
import { POSTINGS_PROMPT, POSTINGS_PROMPT_VERSION } from "../prompts/postings";
import { POSTINGS_MAX_SEARCHES, POSTINGS_MAX_URL_CHECKS, PostingsSchema, dedupePostings, postingsPayload, postingsPayloadEmpty, postingsSummary, postingsTask, toProfilePostings, urlWasFound, type PostingsAnswer, type PostingsResult, type RawPosting } from "../research/postings";
import type { Handler } from "../run";

// True North Part B as a job (docs/COACH_ASSESSMENT_2026-11-16.md §1.2): one structured call with web
// search, then code — de-duplicate, keep only URLs search returned or a GET can open, write them to
// jhg.trueNorth.postings through the same path the coach writes, hand the coach a 20-row table.
// The search results never enter the conversation.

export const POSTINGS_PROMPT_KEY = "job:postings";
const URL_TIMEOUT_MS = 8000;
const CONCURRENCY = 5;

/** Whether a posting URL opens — a GET that answers under 400 within the timeout. */
async function opens(url: string): Promise<boolean> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), URL_TIMEOUT_MS);
  try {
    const r = await fetch(url, { method: "GET", redirect: "follow", signal: ctl.signal, headers: { "user-agent": "Mozilla/5.0 (compatible; JobHackerCompass/1.0)", accept: "text/html,*/*" } });
    return r.status < 400;
  } catch { return false; }
  finally { clearTimeout(t); }
}

async function mapLimit<T, R>(items: readonly T[], limit: number, f: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => { for (;;) { const n = i++; if (n >= items.length) return; out[n] = await f(items[n]); } }));
  return out;
}

/** The first JSON object in a text answer — the fallback when structured output is not available with search. */
function parseLoose(text: string): PostingsAnswer | null {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { const r = PostingsSchema.safeParse(JSON.parse(m[0])); return r.success ? r.data : null; } catch { return null; }
}

export const postings: Handler = async ({ uid, job, config, agent, log, progress, meter, cancelled }) => {
  const db = adminDb();
  const [profileSnap, setupSnap, override] = await Promise.all([db.doc(`users/${uid}`).get(), db.doc(`users/${uid}/careerOps/setup`).get(), getPromptOverride(POSTINGS_PROMPT_KEY)]);
  const current = profileFromSetup({ profile: profileSnap.exists ? (profileSnap.data() as Profile) : null, setup: setupSnap.exists ? (setupSnap.data() as CareerOpsSetupV2) : null });
  const payload = postingsPayload(current, job.payload);
  if (postingsPayloadEmpty(payload)) throw new Error("Nothing to search from — the Narrative's core competencies are empty and no title was given.");
  const cfg = config.agents[agent ?? "researcher"];
  const prompt = resolvePrompt(POSTINGS_PROMPT, POSTINGS_PROMPT_VERSION, override);
  const today = new Date().toISOString().slice(0, 10);
  const task = postingsTask(payload, today);
  await log(`searching from: ${payload.competencies.join(" · ")}${payload.titles.length ? ` · titles ${payload.titles.join(" · ")}` : ""} · ${payload.region || "no region"}`);
  await progress("Searching postings");

  const base = { model: cfg.model, effort: cfg.effort, maxTokens: cfg.maxTokens, system: prompt.text, messages: [{ role: "user" as const, content: task }], maxSearches: POSTINGS_MAX_SEARCHES };
  let answer: PostingsAnswer;
  let sources: { url: string }[];
  try {
    const r = await callJson({ ...base, schema: PostingsSchema });
    await meter(r.model, r.usage); await log(usageLine(r));
    answer = r.data; sources = sourcesOf(r.message.content);
  } catch (e) {
    if (e instanceof ClaudeRefusal) throw e;
    // Structured output and server search may not combine on every model: ask for JSON in text and parse it.
    await log(`structured call failed (${e instanceof Error ? e.message : String(e)}) — retrying as text`);
    const r = await call({ ...base, system: `${prompt.text}\n\nAnswer with one JSON object only: { "postings": [{ "title", "company", "location", "url", "phrases": [] }], "note": "" }.` });
    await meter(r.model, r.usage); await log(usageLine(r));
    const parsed = parseLoose(r.text);
    if (!parsed) throw new Error("The model's answer was not a list of postings");
    answer = parsed; sources = r.sources;
  }
  if (await cancelled()) return null;

  const unique = dedupePostings(answer.postings);
  await log(`${answer.postings.length} rows returned, ${unique.length} unique, ${sources.length} sources`);
  await progress(`Opening links · 0 of ${unique.length}`);
  let checked = 0;
  const kept: RawPosting[] = [];
  const results = await mapLimit(unique.slice(0, POSTINGS_MAX_URL_CHECKS), CONCURRENCY, async (p) => {
    const ok = urlWasFound(p.url, sources) || (await opens(p.url));
    checked++;
    if (checked % 5 === 0 || checked === unique.length) await progress(`Opening links · ${checked} of ${unique.length}`);
    if (!ok) await log(`dropped (did not open): ${p.url}`);
    return ok;
  });
  results.forEach((ok, i) => { if (ok) kept.push(unique[i]); });
  if (await cancelled()) return null;
  if (!kept.length) throw new Error("No posting could be opened — try again, or the coach can search by hand.");

  const rows = toProfilePostings(kept, today);
  await applyCoachPatch({ uid, coach: "trueNorth", patch: { jhg: { trueNorth: { postings: rows } } }, portal: payload.portal });
  const result: PostingsResult = { count: rows.length, dropped: unique.length - rows.length, summary: postingsSummary(rows, unique.length - rows.length, answer.note?.trim() ?? ""), searches: 0 };
  await progress(`${rows.length} postings on your True North page`);
  return result;
};
