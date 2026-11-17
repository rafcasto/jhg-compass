import "server-only";
import { adminDb } from "@/lib/firebase/admin";
import { profileFromSetup } from "@/lib/careerops/profile-file";
import type { CareerOpsSetupV2 } from "@/lib/careerops/types";
import type { Profile } from "@/lib/types";
import { ClaudeRefusal, call, callJson, sourcesOf, usageLine } from "../claude";
import { resolvePrompt } from "../config";
import { getPromptOverride } from "../config-server";
import { applyCoachPatch } from "../coach/write";
import { COMPANIES_PROMPT, COMPANIES_PROMPT_VERSION } from "../prompts/companies";
import { COMPANIES_ENOUGH_ROWS, COMPANIES_MAX_BOARD_QUERIES, COMPANIES_MAX_SEARCHES, COMPANIES_MAX_URL_CHECKS, COMPANIES_TARGET, CompaniesSchema, companiesPayload, companiesPayloadEmpty, companiesSummary, companiesTask, fromPostings, mergeCandidates, toProfileCompanies, type Candidate, type CompaniesAnswer, type CompaniesResult, type VerifiedCandidate } from "../research/companies";
import { urlWasFound } from "../research/postings";
import { companyKey, countryOf, domainOf } from "../sourcing/keys";
import { confirmCareersUrl, mapLimit, opens, sourcePostings, sourcingConfigured } from "../sourcing/fetch";
import type { Handler } from "../run";

// Target companies Part A as a job (docs/SEARCH_TO_API_ASSESSMENT_2026-11-17.md §2 row 5, §4 PR 3). Two passes, one
// rule: the job boards' APIs grouped by employer (code, zero tokens) and the model's industry-led proposal (one call
// with search, its results never in a transcript) — then code opens every growth source and careers page, drops what
// doesn't open, leaves out the never-join list, caps at forty, writes jhg.targetCompanies.companies through the
// coach's own path and hands the coach the table.

export const COMPANIES_PROMPT_KEY = "job:companies";

function parseLoose(text: string): CompaniesAnswer | null {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { const r = CompaniesSchema.safeParse(JSON.parse(m[0])); return r.success ? r.data : null; } catch { return null; }
}

export const companies: Handler = async ({ uid, job, config, agent, log, progress, meter, cancelled }) => {
  const db = adminDb();
  const [profileSnap, setupSnap, override] = await Promise.all([db.doc(`users/${uid}`).get(), db.doc(`users/${uid}/careerOps/setup`).get(), getPromptOverride(COMPANIES_PROMPT_KEY)]);
  const current = profileFromSetup({ profile: profileSnap.exists ? (profileSnap.data() as Profile) : null, setup: setupSnap.exists ? (setupSnap.data() as CareerOpsSetupV2) : null });
  const payload = companiesPayload(current, job.payload, countryOf);
  if (companiesPayloadEmpty(payload)) throw new Error("Nothing to source from — True North has no industries and no titles, and no company was named.");
  const cfg = config.agents[agent ?? "researcher"];
  const today = new Date().toISOString().slice(0, 10);
  await log(`sourcing from: ${payload.industries.map((i) => i.name).join(" · ") || "no industries"} · titles ${payload.titles.join(" · ") || "none"} · ${payload.region || "no region"} · ${payload.stored.length} stored`);

  // Pass 1 — the job boards, grouped by employer (an API; zero tokens): titles and industries, city and country-wide; the
  // industry a query named rides on the employers it found; a posting link on an ATS board is the careers page.
  let posted: Candidate[] = [];
  let boardsNote = "";
  const industryNames = payload.industries.map((i) => i.name);
  const boardsSkipped = !sourcingConfigured() ? "no job-board API key is configured (JSEARCH_API_KEY, SERPAPI_KEY or ADZUNA_APP_ID/KEY on the host)" : !payload.country ? `no source covers the region "${payload.region || "(empty)"}" — the pipeline runs for NZ · AU · US · CA; fix the location on True North` : !(payload.titles.length || industryNames.length || payload.names.length) ? "True North has no target titles and no industries to search by" : null;
  if (!boardsSkipped) {
    await progress("Reading the job boards");
    const run = await sourcePostings({ titles: payload.titles, competencies: [], industries: industryNames, names: payload.names, broaden: true, region: payload.region, country: payload.country! }, log, today, { maxQueries: COMPANIES_MAX_BOARD_QUERIES, enough: COMPANIES_ENOUGH_ROWS });
    posted = fromPostings(run.rows, payload.titles);
    boardsNote = run.note;
    await log(`${run.note} → ${posted.length} employers${run.metered ? ` · ${run.metered} paid searches` : ""}`);
  } else await log(`job boards skipped — ${boardsSkipped}`);
  if (await cancelled()) return null;
  // API only and nothing from the boards: say why, loudly — a quiet "0 added" sends the coach back to searching by hand.
  if (payload.proposal === "off" && !posted.length) throw new Error(boardsSkipped ? `The job boards were not read — ${boardsSkipped}.` : `The job boards returned no employers — ${boardsNote}${/HTTP 403/.test(boardsNote) ? " (an HTTP 403 means the RapidAPI subscription to JSearch is not active)" : ""}${/HTTP 429/.test(boardsNote) ? " (a 429 is the source's quota or rate limit — wait for the month to reset, raise the plan, or set the other Google key as the fallback)" : ""}.`);

  // Pass 2 — the industry-led proposal: one call with search; the pages never enter a transcript. Only to fill a gap the
  // boards left ("auto"), or never ("off" — API only); names the member added always go through it, since a name is not a query.
  const fromBoards = mergeCandidates(payload.stored, [posted], payload.neverApply).kept.length;
  const short = payload.stored.length + fromBoards < COMPANIES_TARGET;
  // API only ("off"): never a model call — a name the member added was asked of the boards above. "auto": the proposal fills a gap, and takes the names with it.
  const propose = payload.proposal === "auto" && ((short && payload.industries.length > 0) || payload.names.length > 0);
  const prompt = resolvePrompt(COMPANIES_PROMPT, COMPANIES_PROMPT_VERSION, override);
  const base = { model: cfg.model, effort: cfg.effort, maxTokens: cfg.maxTokens, system: prompt.text, messages: [{ role: "user" as const, content: companiesTask(payload, today) }], maxSearches: COMPANIES_MAX_SEARCHES };
  let answer: CompaniesAnswer = { companies: [], note: "" };
  let sources: { url: string }[] = [];
  if (!propose) await log(`proposal skipped — ${payload.proposal === "off" ? "switched off (API only)" : `the boards found ${fromBoards}, enough with ${payload.stored.length} stored`}`);
  else {
    await progress("Researching the industries");
    try {
      const r = await callJson({ ...base, schema: CompaniesSchema });
      await meter(r.model, r.usage); await log(usageLine(r));
      answer = r.data; sources = sourcesOf(r.message.content);
    } catch (e) {
      if (e instanceof ClaudeRefusal) throw e;
      await log(`structured call failed (${e instanceof Error ? e.message : String(e)}) — retrying as text`);
      const r = await call({ ...base, system: `${prompt.text}\n\nAnswer with one JSON object only: { "companies": [{ "name", "companyType", "inspiredBy", "industry", "subSector", "location", "website", "growthSignal", "growthSource", "careersUrl" }], "note": "" }.` });
      await meter(r.model, r.usage); await log(usageLine(r));
      const parsed = parseLoose(r.text);
      if (!parsed) throw new Error("The model's answer was not a list of companies");
      answer = parsed; sources = r.sources;
    }
    await log(`${answer.companies.length} proposed, ${sources.length} sources`);
  }
  if (await cancelled()) return null;

  // Merge: stored first, then the member's names, the boards, the proposal — never the never-join list, at most forty.
  const named = answer.companies.filter((c) => payload.names.some((n) => n.toLowerCase() === c.name.toLowerCase()));
  const rest = answer.companies.filter((c) => !named.includes(c));
  const { kept, excluded } = mergeCandidates(payload.stored, [named, posted, rest], payload.neverApply);
  if (excluded.length) await log(`left out as never-join: ${excluded.join(", ")}`);

  // Verify by code: the growth source must open; the careers page is confirmed by its ATS board, else by opening, else "none".
  await progress(`Opening links · 0 of ${kept.length}`);
  let checked = 0;
  const verified = await mapLimit(kept.slice(0, COMPANIES_MAX_URL_CHECKS), 5, async (c): Promise<VerifiedCandidate> => {
    const sourceOpened = /^https?:\/\//i.test(c.growthSource) && (urlWasFound(c.growthSource, sources) || (await opens(c.growthSource)));
    let careersUrl = c.careersUrl.trim();
    let status: VerifiedCandidate["careersUrlStatus"] = "none";
    if (careersUrl) {
      const board = await confirmCareersUrl(careersUrl);
      if (board) { status = "opened_by_coach"; await log(`${c.name}: careers page confirmed — ${board.board.provider} board, ${board.jobs} jobs`); }
      else if (await opens(careersUrl)) status = "opened_by_coach";
    }
    if (status === "none") {
      const d = domainOf(c.website);
      if (d) for (const path of ["/careers", "/jobs"]) { const u = `https://${d}${path}`; if (await opens(u)) { careersUrl = u; status = "opened_by_coach"; break; } }
    }
    checked++;
    if (checked % 5 === 0 || checked === kept.length) await progress(`Opening links · ${checked} of ${kept.length}`);
    if (!sourceOpened) await log(`dropped (source did not open): ${c.name} — ${c.growthSource || "no source"}`);
    return { ...c, careersUrl, sourceOpened, careersUrlStatus: status };
  });
  if (await cancelled()) return null;

  const rows = toProfileCompanies(payload.stored, verified, payload);
  const added = rows.length - payload.stored.length;
  if (!added && !payload.stored.length) throw new Error("No company's growth source could be opened — try again; the step stays the portal's.");
  await applyCoachPatch({ uid, coach: "targetCompanies", patch: { jhg: { targetCompanies: { companies: rows } } }, portal: payload.portal });

  // The shared half (plan §6): what every member can reuse about a company — never the member's scores.
  const batch = db.batch();
  for (const r of verified.filter((v) => v.sourceOpened)) {
    batch.set(db.doc(`companies/${companyKey(r.name, r.website)}`), { key: companyKey(r.name, r.website), name: r.name, ...(payload.country ? { country: payload.country } : {}), location: r.location, ...(r.industry ? { industry: r.industry } : {}), ...(r.subSector ? { subSector: r.subSector } : {}), ...(r.website ? { website: r.website } : {}), ...(r.careersUrlStatus === "opened_by_coach" ? { careersUrl: r.careersUrl, careersUrlStatus: "opened" } : {}), growthSignal: r.growthSignal, growthSource: r.growthSource, lastSeenAt: Date.now() }, { merge: true });
  }
  await batch.commit();

  const result: CompaniesResult = { count: rows.length, added, excluded: excluded.length, summary: companiesSummary(rows, added, excluded, answer.note?.trim() ?? ""), searches: 0 };
  await progress(`${rows.length} companies on your Target companies page`);
  return result;
};
