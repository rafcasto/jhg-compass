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
import { PHRASES_PROMPT, POSTINGS_MAX_SEARCHES, POSTINGS_MAX_URL_CHECKS, POSTINGS_TARGET, PhrasesSchema, PostingsSchema, dedupePostings, phrasesTask, postingsPayload, postingsPayloadEmpty, postingsSummary, postingsTask, toProfilePostings, urlWasFound, withPhrases, type PostingsAnswer, type PostingsPayload, type PostingsResult, type RawPosting } from "../research/postings";
import { countryOf } from "../sourcing/keys";
import { toRawPosting } from "../sourcing/plan";
import { mapLimit, opens, sourcePostings, sourcingConfigured, upsertSourced } from "../sourcing/fetch";
import type { Handler, RunContext } from "../run";

// True North Part B as a job (docs/COACH_ASSESSMENT_2026-11-16.md §1.2). Two ways to the list, one way to count:
//   sources — the aggregators' APIs (docs/SEARCH_TO_API_ASSESSMENT_2026-11-17.md §2 row 2): code queries, merges and
//             writes the shared collections; the model only quotes each description. Zero searches.
//   search  — the model's web search in one structured call, while no adapter key is configured or the region is one
//             no source covers.
// Then code: de-duplicate, keep only URLs that open, write jhg.trueNorth.postings through the coach's own path, hand
// the coach a 20-row table. The search results never enter the conversation.

export const POSTINGS_PROMPT_KEY = "job:postings";
const CONCURRENCY = 5;
/** The first JSON object in a text answer — the fallback when structured output is not available with search. */
function parseLoose(text: string): PostingsAnswer | null {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { const r = PostingsSchema.safeParse(JSON.parse(m[0])); return r.success ? r.data : null; } catch { return null; }
}

interface Found { unique: RawPosting[]; sources: { url: string }[]; note: string; descriptions: string[]; via: "sources" | "search" }
type Ctx = Pick<RunContext, "config" | "agent" | "log" | "progress" | "meter">;

/** The list by API: the configured aggregators for the brief's country, the shared collections written, phrases quoted by one call without search. */
async function viaSources(payload: PostingsPayload, country: NonNullable<ReturnType<typeof countryOf>>, { config, agent, log, progress, meter }: Ctx): Promise<Found> {
  await progress("Reading the job boards");
  const run = await sourcePostings({ titles: payload.titles, competencies: payload.competencies, region: payload.region, country }, log);
  await log(run.note);
  await upsertSourced(run.rows);
  const candidates = run.rows.slice(0, POSTINGS_MAX_URL_CHECKS);
  let unique = dedupePostings(candidates.map(toRawPosting));
  const descriptions = candidates.map((r) => r.description);
  if (unique.length) {
    await progress("Quoting the postings");
    const cfg = config.agents[agent ?? "researcher"];
    try {
      const r = await callJson({ model: cfg.model, effort: "low", maxTokens: Math.min(cfg.maxTokens, 8000), system: PHRASES_PROMPT, messages: [{ role: "user", content: phrasesTask(candidates) }], schema: PhrasesSchema });
      await meter(r.model, r.usage); await log(usageLine(r));
      unique = withPhrases(unique, descriptions, r.data);
    } catch (e) {
      if (e instanceof ClaudeRefusal) throw e;
      await log(`phrases call failed (${e instanceof Error ? e.message : String(e)}) — postings kept without phrases`);
    }
  }
  return { unique, sources: [], note: run.note, descriptions, via: "sources" };
}

/** The list by the model's search — one structured call, the URLs it returned as the evidence. */
async function viaSearch(payload: PostingsPayload, override: Awaited<ReturnType<typeof getPromptOverride>>, { config, agent, log, progress, meter }: Ctx): Promise<Found> {
  const cfg = config.agents[agent ?? "researcher"];
  const prompt = resolvePrompt(POSTINGS_PROMPT, POSTINGS_PROMPT_VERSION, override);
  const today = new Date().toISOString().slice(0, 10);
  const task = postingsTask(payload, today);
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
  const unique = dedupePostings(answer.postings);
  await log(`${answer.postings.length} rows returned, ${unique.length} unique, ${sources.length} sources`);
  return { unique, sources, note: answer.note?.trim() ?? "", descriptions: [], via: "search" };
}

export const postings: Handler = async ({ uid, job, config, agent, log, progress, meter, cancelled }) => {
  const db = adminDb();
  const [profileSnap, setupSnap, override] = await Promise.all([db.doc(`users/${uid}`).get(), db.doc(`users/${uid}/careerOps/setup`).get(), getPromptOverride(POSTINGS_PROMPT_KEY)]);
  const current = profileFromSetup({ profile: profileSnap.exists ? (profileSnap.data() as Profile) : null, setup: setupSnap.exists ? (setupSnap.data() as CareerOpsSetupV2) : null });
  const payload = postingsPayload(current, job.payload);
  if (postingsPayloadEmpty(payload)) throw new Error("Nothing to search from — the Narrative's core competencies are empty and no title was given.");
  const today = new Date().toISOString().slice(0, 10);
  await log(`searching from: ${payload.competencies.join(" · ")}${payload.titles.length ? ` · titles ${payload.titles.join(" · ")}` : ""} · ${payload.region || "no region"}`);

  const country = countryOf(payload.region);
  const ctx: Ctx = { config, agent, log, progress, meter };
  const bySources = sourcingConfigured() && country !== null;
  await log(bySources ? `via the job boards' APIs (${country})` : `via the model's search${country ? "" : " — no source covers the region"}${sourcingConfigured() ? "" : " — no adapter key configured"}`);
  const found = bySources ? await viaSources(payload, country!, ctx) : await viaSearch(payload, override, ctx);
  if (await cancelled()) return null;

  const { unique, sources } = found;
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
  if (!kept.length) throw new Error(found.via === "sources" ? "No posting from the job boards could be opened — try again, or the coach can search by hand." : "No posting could be opened — try again, or the coach can search by hand.");

  const rows = toProfilePostings(kept, today, POSTINGS_TARGET.max);
  await applyCoachPatch({ uid, coach: "trueNorth", patch: { jhg: { trueNorth: { postings: rows } } }, portal: payload.portal });
  const dropped = unique.length - kept.length;
  const result: PostingsResult = { count: rows.length, dropped, summary: postingsSummary(rows, dropped, found.note), searches: 0, via: found.via };
  await progress(`${rows.length} postings on your True North page`);
  return result;
};
