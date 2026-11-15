// The hand-over checks, in code (docs/COACH_ASSESSMENT_2026-11-16.md §1.3, docs/UX_COACH_AGENTIC.md §4;
// the prompt audit's #7). Each coach's prompt names its checks — N1–N6, T1–T7, C1–C7, S1–S4, M1–M4,
// L1–L4. The ones code can decide from the stored profile are decided here, in the check's own words,
// and returned in the tool result; the model never recounts forty totals or re-measures a headline.
// A check code cannot decide (M1: every figure traces to a story; M2's banned phrases) stays the
// model's and is not listed. Pure — tested.

import type { ProfileFile } from "../../careerops/profile-file";
import { LINKEDIN_LIMITS, TEXT_CAPS } from "../../careerops/profile-schema";
import type { JhgCompany } from "../../careerops/types";
import type { CoachKey } from "./keys";

export interface Check {
  /** The prompt's own id: N2, T3, C1… */
  id: string;
  /** The check in a few words, as the prompt names it. */
  label: string;
  pass: boolean;
  /** What to fix, in one line — present when the check fails. */
  fix?: string;
}

const isUrl = (v: unknown): boolean => typeof v === "string" && /^https?:\/\/\S+$/i.test(v.trim());
const words = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const lower = (s: string) => s.trim().toLowerCase();
const sameSet = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((x) => b.some((y) => lower(x) === lower(y)));
const num = (s: unknown): number | null => {
  if (typeof s === "number") return s;
  if (typeof s !== "string") return null;
  const m = s.replace(/[^\d.]/g, "");
  return m ? Number(m) : null;
};

const check = (id: string, label: string, pass: boolean, fix: string): Check => (pass ? { id, label, pass } : { id, label, pass, fix });

// ---- Narrative ----
function narrativeChecks(p: ProfileFile): Check[] {
  const id = p.jhg?.identity ?? {};
  const n = p.narrative ?? {};
  const missing = (["fullName", "email", "city", "country", "timezone"] as const).filter((k) => !id[k]?.trim());
  const tz = !!id.timezone && /^[A-Za-z_]+\/[A-Za-z_+-]+$/.test(id.timezone.trim());
  const headline = n.headline?.trim() ?? "";
  const sentences = headline.split(/[.!?](\s|$)/).filter((s) => s.trim()).length;
  const story = p.personalization?.exitNarrative?.trim() ?? "";
  const lead = p.jhg?.narrative?.leadSkills ?? [];
  return [
    check("N1", "identity complete", missing.length === 0 && tz, missing.length ? `Missing: ${missing.join(", ")}` : "Timezone must be Area/City (e.g. Pacific/Auckland)"),
    check("N2", "headline one sentence ≤ 220, no final full stop", !!headline && headline.length <= 220 && sentences <= 1 && !/[.]$/.test(headline),
      !headline ? "No headline yet" : headline.length > 220 ? `Headline is ${headline.length} characters` : /[.]$/.test(headline) ? "Drop the final full stop" : "More than one sentence"),
    check("N3", "3–5 superpowers", (n.superpowers?.length ?? 0) >= 3 && (n.superpowers?.length ?? 0) <= 5, `${words(n.superpowers?.length ?? 0, "superpower")} — need 3 to 5`),
    check("N4", "bridge story ≤ 1,200, its one-line version, 3 lead skills", !!story && story.length <= TEXT_CAPS.exitNarrative && !!p.jhg?.narrative?.bridgeStoryOneLine?.trim() && lead.length === 3,
      !story ? "No bridge story yet" : story.length > TEXT_CAPS.exitNarrative ? `Bridge story is ${story.length} characters` : !p.jhg?.narrative?.bridgeStoryOneLine?.trim() ? "No one-line version" : `${words(lead.length, "lead skill")} — need exactly 3`),
    check("N5", "portfolio absolute or absent", !p.contact?.portfolio || isUrl(p.contact.portfolio), "Portfolio must be an absolute URL or left out"),
    check("N6", "preferred channel set", !!id.preferredChannel?.trim(), "No preferred channel"),
  ];
}

// ---- True North ----
const CURRENCIES = ["NZD", "AUD", "USD", "CAD", "JPY", "GBP", "EUR", "SGD"];
function trueNorthChecks(p: ProfileFile): Check[] {
  const tn = p.jhg?.trueNorth ?? {};
  const b = tn.boundaries ?? {};
  const clusters = tn.clusters ?? [];
  const primaries = clusters.filter((c) => c.fit === "primary");
  const primary = primaries[0];
  const goal = p.goal ?? {};
  const expectRole = primary ? `${primary.level ?? ""} ${primary.titles?.[0] ?? ""}`.trim() : "";
  const floor = num(b.salaryFloor), lo = num(b.salaryLower);
  const expectSalary = b.currency && b.salaryLower && b.salaryUpper ? `${b.currency} ${b.salaryLower}–${b.salaryUpper}` : "";
  const postings = tn.postings ?? [];
  const opened = postings.filter((x) => isUrl(x.url)).length;
  const roles = p.personalization?.targetRoles ?? [];
  const rolesOk = roles.length === clusters.length && roles.length <= 8 && roles.every((r) => (r.archetype?.length ?? 0) <= 80 && (r.axes?.length ?? 0) <= 200 && (r.buys?.length ?? 0) <= 200);
  const subs = (tn.industries ?? []).flatMap((i) => i.subSectors ?? []);
  const badSub = subs.filter((s) => s.outlook && (!s.growthSignal?.trim() || !isUrl(s.source) || s.confirmed !== "Y"));
  const firstSub = tn.industries?.[0]?.subSectors?.[0]?.name ?? "";
  const titles = tn.titles ?? {};
  const w = p.watchlist ?? { companies: [], positive: [], negative: [] };
  const pers = p.personalization ?? {};
  return [
    check("T1", "goal.role and seniority from the primary cluster", !!primary && lower(goal.role ?? "") === lower(expectRole) && lower(goal.seniority ?? "") === lower(primary.level ?? ""),
      !primary ? "No primary cluster" : `Expected role "${expectRole}", seniority "${primary.level ?? ""}"; stored "${goal.role ?? ""}", "${goal.seniority ?? ""}"`),
    check("T2", "currency in the list; floor ≤ lower; goal.salary as the rule", CURRENCIES.includes(b.currency ?? "") && floor !== null && lo !== null && floor <= lo && lower(goal.salary ?? "") === lower(expectSalary),
      !CURRENCIES.includes(b.currency ?? "") ? `Currency "${b.currency ?? ""}" not in ${CURRENCIES.join(" ")}` : floor === null || lo === null ? "Salary floor and lower end must be numbers" : floor > lo ? "Floor is above the lower end" : `goal.salary should read "${expectSalary}"`),
    check("T3", "≥ 15 postings with opened URLs", opened >= 15, `${words(opened, "posting")} with a URL — need 15 (fewer only if results were thin: say so)`),
    check("T4", "exactly one primary cluster; targetRoles from the clusters, within caps", primaries.length === 1 && rolesOk,
      primaries.length !== 1 ? `${words(primaries.length, "primary cluster")} — need exactly one` : `${words(roles.length, "target role")} for ${words(clusters.length, "cluster")}, or a cap exceeded (archetype 80, axes 200, buys 200)`),
    check("T5", "every sub-sector with an outlook has a signal, an absolute source and confirmed Y; goal.subsector is the first", badSub.length === 0 && !!firstSub && lower(goal.subsector ?? "") === lower(firstSub),
      badSub.length ? `Sub-sectors to fix: ${badSub.map((s) => s.name).join(", ")}` : !firstSub ? "No industry with a sub-sector yet" : `goal.subsector should be "${firstSub}"`),
    check("T6", "watchlist.positive = target titles; negative = exclude + excludeLevels", sameSet(w.positive ?? [], titles.target ?? []) && sameSet(w.negative ?? [], [...(titles.exclude ?? []), ...(b.excludeLevels ?? [])]),
      "Write watchlist.positive from titles.target and watchlist.negative from titles.exclude + excludeLevels"),
    check("T7", "caps on locationPolicy (8), negotiationScripts (6), compTargets (800)", (pers.locationPolicy?.length ?? 0) <= 8 && (pers.negotiationScripts?.length ?? 0) <= 6 && (pers.compTargets?.length ?? 0) <= TEXT_CAPS.compTargets,
      "A cap is exceeded — cut the list or the text"),
  ];
}

// ---- Target companies ----
const COMPANY_TYPES = ["startup", "scaleup", "established", "public_sector"];
const INSPIRED = ["industry_growth", "competitor", "customer_or_supplier", "network_or_alumni", "press_or_funding", "job_posting", "event_or_community", "other"];
const DAY = 86_400_000;

/**
 * Totals and ranks in code (audit #7): total = growth + interest + access + proof; ranked by total, then
 * interest, then proof; ranks 1…n. Applied to the coach's patch before validation, so the model only explains.
 * Companies without all four scores keep their place after the scored ones, unranked.
 */
export function rankCompanies(companies: readonly JhgCompany[]): JhgCompany[] {
  const scored = (c: JhgCompany) => c.scores && [c.scores.growth, c.scores.interest, c.scores.access, c.scores.proof].every((n) => typeof n === "number");
  const withTotal = companies.map((c) => scored(c) ? { ...c, scores: { ...c.scores!, total: c.scores!.growth! + c.scores!.interest! + c.scores!.access! + c.scores!.proof! } } : { ...c });
  const ranked = withTotal.filter(scored).sort((a, b) => (b.scores!.total! - a.scores!.total!) || (b.scores!.interest! - a.scores!.interest!) || (b.scores!.proof! - a.scores!.proof!)).map((c, i) => ({ ...c, rank: i + 1 }));
  const rest = withTotal.filter((c) => !scored(c)).map(({ rank: _rank, ...c }) => c);
  return [...ranked, ...rest];
}

function targetCompaniesChecks(p: ProfileFile, now: number): Check[] {
  const tc = p.jhg?.targetCompanies ?? {};
  const cs = tc.companies ?? [];
  const inRange = (n: unknown) => typeof n === "number" && n >= 1 && n <= 5;
  const badScores = cs.filter((c) => !c.scores || !inRange(c.scores.growth) || !inRange(c.scores.interest) || !inRange(c.scores.access) || !inRange(c.scores.proof));
  const ranks = cs.map((c) => c.rank);
  const ranksOk = cs.length > 0 && new Set(ranks).size === cs.length && ranks.every((r) => typeof r === "number" && r >= 1 && r <= cs.length);
  const badUrls = cs.filter((c) => !isUrl(c.growthSource) || (c.careersUrlStatus !== "none" && !isUrl(c.careersUrl)));
  const subRows = new Map<string, string>();
  for (const s of (p.jhg?.trueNorth?.industries ?? []).flatMap((i) => i.subSectors ?? [])) subRows.set(lower(s.name), s.outlook ?? "");
  for (const s of tc.extraSubSectors ?? []) subRows.set(lower(s.name), s.outlook ?? "");
  const badOutlook = cs.filter((c) => c.subSector && subRows.has(lower(c.subSector)) && (c.outlook ?? "") !== subRows.get(lower(c.subSector)));
  const badEnum = cs.filter((c) => !COMPANY_TYPES.includes(c.companyType ?? "") || !INSPIRED.includes(c.inspiredBy ?? ""));
  const byRank = [...cs].sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99));
  const top10Names = byRank.slice(0, 10).map((c) => lower(c.name));
  const top10 = tc.top10 ?? [];
  const top10Ok = top10.length === 10 && sameSet(top10.map((t) => t.name), byRank.slice(0, 10).map((c) => c.name)) && top10.every((t) => ["confirmed", "corrected", "none"].includes(t.careersUrlStatus ?? ""));
  const restOk = byRank.slice(10).every((c) => ["opened_by_coach", "none"].includes(c.careersUrlStatus ?? ""));
  const top3 = tc.top3 ?? [];
  const top3Ok = top3.length === 3 && top3.every((t) => top10Names.includes(lower(t.name)));
  const dateOk = top3.every((t) => { const d = Date.parse(t.byDate ?? ""); return Number.isFinite(d) && d >= now - DAY && d <= now + 7 * DAY; });
  const wl = p.watchlist?.companies ?? [];
  const wlOk = wl.length === top10.length && wl.every((c, i) => lower(c.name) === lower(top10[i]?.name ?? ""));
  const listCount = (l: Partial<Record<string, unknown[]>> | undefined) => Object.values(l ?? {}).reduce((n, arr) => n + (Array.isArray(arr) ? arr.length : 0), 0);
  const lists = p.companyLists ?? {};
  const listsOk = listCount(lists.all) === cs.length && listCount(lists.top10) === 10 && listCount(lists.top3) === 3;
  const never = (p.jhg?.trueNorth?.boundaries?.neverApply ?? []).map(lower);
  const onNever = cs.filter((c) => never.includes(lower(c.name)));
  return [
    check("C1", "exactly 40, ranks 1–40 unique, every score 1–5 (totals and ranks are the portal's)", cs.length === 40 && ranksOk && badScores.length === 0,
      cs.length !== 40 ? `${words(cs.length, "company", "companies")} — need exactly 40` : badScores.length ? `Scores missing or outside 1–5: ${badScores.map((c) => c.name).join(", ")}` : "Ranks are not 1–40 — write the list again and the portal ranks it"),
    check("C2", "every growthSource and careers URL absolute", badUrls.length === 0, `URLs to fix: ${badUrls.map((c) => c.name).join(", ")}`),
    check("C3", "outlook equals its sub-sector row; companyType and inspiredBy in their lists", badOutlook.length === 0 && badEnum.length === 0,
      badOutlook.length ? `Outlook differs from the sub-sector row: ${badOutlook.map((c) => c.name).join(", ")}` : `Type or source not in the list: ${badEnum.map((c) => c.name).join(", ")}`),
    check("C4", "Top 10 = ranks 1–10 with statuses confirmed/corrected/none; ranks 11–40 opened_by_coach/none", top10Ok && restOk,
      !top10Ok ? `top10 must be the ten highest-ranked companies (${words(top10.length, "entry", "entries")} now) with careersUrlStatus confirmed, corrected or none` : "A company ranked 11–40 has a Top-10 status"),
    check("C5", "Top 3 ⊂ Top 10, byDate within 7 days", top3Ok && dateOk, !top3Ok ? `top3 must be three of the Top 10 (${words(top3.length, "entry", "entries")} now)` : "A byDate is not within the next 7 days"),
    check("C6", "watchlist.companies = the Top 10 in rank order; companyLists all / top10 / top3 complete", wlOk && listsOk,
      !wlOk ? "watchlist.companies must be the Top 10 in rank order" : `companyLists must hold ${cs.length} / 10 / 3 entries`),
    check("C7", "no neverApply company", onNever.length === 0, `On the never-apply list: ${onNever.map((c) => c.name).join(", ")}`),
  ];
}

// ---- Story Bank ----
function storyBankChecks(p: ProfileFile): Check[] {
  const facts = p.jhg?.artefacts?.storyFacts ?? [];
  const stories = p.stories ?? [];
  const ids = facts.map((f) => f.id ?? "");
  const factTitles = facts.map((f) => lower(f.title));
  const titlesOk = stories.every((s) => factTitles.includes(lower(s.title))) && (p.narrative?.proofPoints ?? []).every((pp) => stories.some((s) => lower(s.title) === lower(pp.name)));
  const unconfirmed = facts.filter((f) => f.sourceStatus === "user_cannot_confirm");
  const uIds = unconfirmed.map((f) => f.id ?? "\u0000"), uTitles = unconfirmed.map((f) => lower(f.title));
  const leaked = [
    ...stories.filter((s) => uIds.includes(s.id ?? "\u0001") || uTitles.includes(lower(s.title))).map((s) => s.title),
    ...(p.narrative?.proofPoints ?? []).filter((pp) => uTitles.includes(lower(pp.name))).map((pp) => pp.name),
    ...(p.snapshots ?? []).filter((s) => uIds.includes(s.storyId ?? "\u0001")).map((s) => s.title ?? s.company),
  ];
  const longMetric = (p.narrative?.proofPoints ?? []).filter((pp) => (pp.heroMetric?.length ?? 0) > 60);
  const badUrl = (p.narrative?.proofPoints ?? []).filter((pp) => pp.url && !isUrl(pp.url)).map((pp) => pp.name);
  const portfolio = p.personalization?.portfolio?.url;
  const framing = p.personalization?.adaptiveFraming ?? [];
  const clusters = p.jhg?.trueNorth?.clusters?.length ?? 0;
  const framingOk = framing.length === clusters && framing.every((f) => (f.emphasize?.length ?? 0) <= 200 && (f.proof?.length ?? 0) <= 160);
  const cca = p.personalization?.crossCuttingAdvantage ?? "";
  return [
    check("S1", "8–10 stories in storyFacts, ids unique, titles identical everywhere", facts.length >= 8 && facts.length <= 10 && new Set(ids).size === facts.length && ids.every(Boolean) && titlesOk,
      facts.length < 8 || facts.length > 10 ? `${words(facts.length, "story fact")} — need 8 to 10` : new Set(ids).size !== facts.length || !ids.every(Boolean) ? "Story ids must be unique (S1, S2…)" : "A story or proof point title does not match its storyFacts title"),
    check("S2", "no user_cannot_confirm story in stories, proofPoints or snapshots", leaked.length === 0, `Unconfirmed stories used as claims: ${leaked.join(", ")}`),
    check("S3", "every heroMetric ≤ 60; every proof URL and the portfolio URL absolute", longMetric.length === 0 && badUrl.length === 0 && (!portfolio || isUrl(portfolio)),
      longMetric.length ? `Hero metric over 60: ${longMetric.map((pp) => pp.name).join(", ")}` : badUrl.length ? `Proof URL not absolute: ${badUrl.join(", ")}` : "Portfolio URL must be absolute"),
    check("S4", "adaptiveFraming one per cluster within caps; crossCuttingAdvantage ≤ 600", framingOk && cca.length <= TEXT_CAPS.crossCuttingAdvantage,
      !framingOk ? `${words(framing.length, "framing row")} for ${words(clusters, "cluster")}, or a cap exceeded (emphasize 200, proof 160)` : `crossCuttingAdvantage is ${cca.length} characters`),
  ];
}

// ---- Master CV ----
const CV_ORDER = ["## Professional Summary", "## Work Experience", "## Projects", "## Education", "## Certifications", "## Awards", "## Skills"];
const cvLine = (cv: string, label: string): string => (cv.match(new RegExp(`\\*\\*${label}:\\*\\*\\s*(.+)`, "i"))?.[1] ?? "").trim();
const cvHeadings = (cv: string): string[] => cv.split("\n").filter((l) => /^## /.test(l)).map((l) => l.trim());

function masterCvChecks(p: ProfileFile): Check[] {
  const cv = p.cv ?? "";
  const heads = cvHeadings(cv);
  const present = CV_ORDER.filter((h) => heads.includes(h));
  const orderOk = present.join("|") === heads.filter((h) => CV_ORDER.includes(h)).join("|") && ["## Professional Summary", "## Work Experience", "## Education", "## Skills"].every((h) => heads.includes(h));
  const id = p.jhg?.identity ?? {};
  const email = cvLine(cv, "Email"), linkedin = cvLine(cv, "LinkedIn"), headline = cvLine(cv, "Headline");
  const emailOk = !id.email || lower(email) === lower(id.email);
  const liOk = !p.contact?.linkedin || lower(linkedin) === lower(p.contact.linkedin);
  const firstPart = headline.split("|")[0].trim();
  const titleOk = !!firstPart && lower(p.contact?.title ?? "") === lower(firstPart) && firstPart.length <= 120;
  const unconfirmed = (p.jhg?.artefacts?.storyFacts ?? []).filter((f) => f.sourceStatus === "user_cannot_confirm" && lower(cv).includes(lower(f.title)));
  const locked = p.jhg?.artefacts?.lockedSections ?? [];
  const badLocked = locked.filter((s) => !heads.includes(s.startsWith("## ") ? s.trim() : `## ${s.trim()}`));
  return [
    check("M2", "CV section order", !!cv && orderOk, !cv ? "No CV yet" : `Sections must run ${CV_ORDER.join(" · ")} (optional ones left out)`),
    check("M3", "CV contact lines equal the Narrative; contact.title = the Headline's first part, ≤ 120", emailOk && liOk && titleOk,
      !emailOk ? `CV Email line "${email}" differs from the Narrative's "${id.email}"` : !liOk ? "CV LinkedIn line differs from contact.linkedin" : `contact.title should be "${firstPart.slice(0, 120)}"`),
    check("M4", "no user_cannot_confirm story in the CV; every locked section is a ## heading", unconfirmed.length === 0 && badLocked.length === 0,
      unconfirmed.length ? `Unconfirmed stories in the CV: ${unconfirmed.map((f) => f.title).join(", ")}` : `Locked sections not in the CV: ${badLocked.join(", ")}`),
  ];
}

// ---- LinkedIn ----
const FEATURED_KINDS = ["link", "post", "article", "document"];
function linkedinChecks(p: ProfileFile): Check[] {
  const li = p.linkedin ?? {};
  const skills = (li.skills ?? []).map(lower);
  const exp = li.experience ?? [];
  const badRole = exp.filter((r) => (r.description?.length ?? 0) > LINKEDIN_LIMITS.description || (r.skills?.length ?? 0) > LINKEDIN_LIMITS.roleSkills || (r.skills ?? []).some((s) => !skills.includes(lower(s))));
  const l1 = (li.headline?.length ?? 0) <= LINKEDIN_LIMITS.headline && (li.about?.length ?? 0) <= LINKEDIN_LIMITS.about && skills.length <= LINKEDIN_LIMITS.skills && badRole.length === 0;
  const cv = p.cv ?? "";
  const work = cv.split(/^## Work Experience\s*$/m)[1]?.split(/^## /m)[0] ?? "";
  const roles = work.split("\n").filter((l) => /^### /.test(l)).length;
  const l2 = !!cv && roles === exp.length && exp.every((r) => lower(cv).includes(lower(r.company)));
  const feat = li.featured ?? [];
  const proof = p.personalization?.portfolio?.url || p.contact?.portfolio || "";
  const l3 = feat.every((f) => FEATURED_KINDS.includes(f.kind ?? "") && isUrl(f.url)) && (!proof || !feat.length || lower(feat[0].url ?? "") === lower(proof));
  const text = lower([li.headline, li.about, ...exp.map((r) => r.description)].filter(Boolean).join("\n"));
  const unconfirmed = (p.jhg?.artefacts?.storyFacts ?? []).filter((f) => f.sourceStatus === "user_cannot_confirm" && text.includes(lower(f.title)));
  return [
    check("L1", "within LinkedIn's limits (headline 220, About 2,600, description 2,000, ≤ 5 skills per role each in Skills, ≤ 50 skills)", l1,
      badRole.length ? `Roles over a limit or with a skill not in Skills: ${badRole.map((r) => r.title).join(", ")}` : "Headline, About or Skills over its limit"),
    check("L2", "Experience equal to the CV, role for role", l2, !cv ? "No Master CV to match" : `${words(exp.length, "LinkedIn role")} against ${words(roles, "CV role")}, or a company not in the CV`),
    check("L3", "Featured kinds from the list with absolute URLs; the first is the proof asset", l3, "Fix a Featured kind or URL, or put the proof asset first"),
    check("L4", "no user_cannot_confirm story anywhere", unconfirmed.length === 0, `Unconfirmed stories on LinkedIn: ${unconfirmed.map((f) => f.title).join(", ")}`),
  ];
}

/** The coach's hand-over checks against the stored profile, in the prompt's order. */
export function coachChecks(coach: CoachKey, profile: ProfileFile, now = Date.now()): Check[] {
  switch (coach) {
    case "narrative": return narrativeChecks(profile);
    case "trueNorth": return trueNorthChecks(profile);
    case "targetCompanies": return targetCompaniesChecks(profile, now);
    case "storyBank": return storyBankChecks(profile);
    case "masterCv": return masterCvChecks(profile);
    case "linkedin": return linkedinChecks(profile);
  }
}

export const failedChecks = (checks: readonly Check[]): Check[] => checks.filter((c) => !c.pass);

/**
 * Readiness for CareerOps (docs/UX_COACH.md §12): a CV, a goal with a role, and a watched company with a
 * careers page. One mute sentence; zero tokens to compute.
 */
export function readinessLine(profile: ProfileFile): { ready: boolean; line: string } {
  const missing: string[] = [];
  if (!profile.cv?.trim()) missing.push("your Master CV");
  if (!profile.goal?.role?.trim()) missing.push("your True North goal");
  if (!(profile.watchlist?.companies ?? []).some((c) => isUrl(c.careersUrl))) missing.push("a Top-10 careers page");
  if (!missing.length) return { ready: true, line: "CareerOps can run from here." };
  return { ready: false, line: `CareerOps can run once ${missing.length === 1 ? missing[0] : `${missing.slice(0, -1).join(", ")} and ${missing[missing.length - 1]}`} ${missing.length === 1 ? "is" : "are"} in.` };
}
