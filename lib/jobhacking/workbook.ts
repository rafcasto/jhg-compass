// The JobHackers workbook — profile.yml `jhg`, as the four Packer files write
// it (docs/UX_JOBHACKING.md §5, 2026-11-07). The coach's working data behind
// the fields the portal edits: the titles and clusters behind the target
// roles, the boundaries behind the policy, the scores and theses behind the
// ranked lists, the facts behind the stories. Read-only everywhere; shown
// beside the field it explains, never as a page of its own. Nothing here
// invents a field. Pure — no React. Tested.

import type { CompanyScores, JhgBlock, JhgBoundaries, JhgCompany, JhgFileKey, JhgStoryFact, JhgTop10, JhgTop3, RankedCompany } from "../careerops/types";

const text = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
const list = (v: readonly string[] | null | undefined): string[] => (Array.isArray(v) ? v.map((x) => text(x)).filter(Boolean) : []);
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** "identity · narrative · true north · target companies · artefacts" — which working blocks the workbook carries; "" when none. */
export function workbookSummary(j: JhgBlock | null | undefined): string {
  if (!j) return "";
  const parts: string[] = [];
  if (j.identity && Object.keys(j.identity).length) parts.push("identity");
  if (j.narrative && Object.keys(j.narrative).length) parts.push("narrative");
  if (j.trueNorth && Object.keys(j.trueNorth).length) parts.push("true north");
  if (j.targetCompanies && Object.keys(j.targetCompanies).length) parts.push("target companies");
  if (j.artefacts && Object.keys(j.artefacts).length) parts.push("artefacts");
  return parts.join(" · ");
}

/** The file's own progress stamp — "complete · 6 Nov 2026" — or "" when the file has not been uploaded. */
export function progressLine(j: JhgBlock | null | undefined, file: JhgFileKey): string {
  const p = j?.progress?.[file];
  if (!p) return "";
  return [text(p.status), p.updated ? isoDate(p.updated) : ""].filter(Boolean).join(" · ");
}

/** "2026-11-06" → "6 Nov 2026"; anything else as written. */
export function isoDate(v: string | null | undefined): string {
  const t = text(v);
  const m = t.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return t;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return Number.isNaN(d.getTime()) ? t : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

// ---- a fact as a label · value pair, for the read-only blocks ----

export interface Fact { label: string; value: string; url?: string }
export interface FactList { label: string; items: string[] }

const fact = (label: string, value: string | number | null | undefined, url?: string): Fact | null =>
  value === undefined || value === null || text(String(value)) === "" ? null : { label, value: String(value).trim(), url: text(url) || undefined };
const facts = (xs: (Fact | null)[]): Fact[] => xs.filter((f): f is Fact => !!f);
const lists = (xs: (FactList | null)[]): FactList[] => xs.filter((l): l is FactList => !!l && l.items.length > 0);
const factList = (label: string, items: readonly string[] | null | undefined): FactList | null => (list(items).length ? { label, items: list(items) } : null);

/**
 * Identity as the coach has it — only what the contact editor does not already show. The name is
 * written to the account on upload; the email is shown here when it is not the sign-in one, since
 * the sign-in email is the account's and the file cannot change it.
 */
export const identityFacts = (j: JhgBlock | null | undefined, signInEmail = ""): Fact[] => {
  const i = j?.identity;
  if (!i) return [];
  const email = text(i.email);
  return facts([
    email && email.toLowerCase() !== signInEmail.trim().toLowerCase() ? fact("Email in the file", email) : null,
    fact("Location", i.location || [i.city, i.country].filter(Boolean).join(", ")),
    fact("Time zone", i.timezone),
    fact("Preferred channel", i.preferredChannel),
    fact("Other emails", list(i.alternateEmails).join(", ")),
    fact("Contact note", i.contactNote),
    fact("Output language", i.outputLanguage),
  ]);
};

// ---- true north ----

const yesNo = (v: string | undefined): string => {
  const t = text(v);
  if (/^y(es)?$/i.test(t)) return "Yes";
  if (/^n(o)?$/i.test(t)) return "No";
  return t;
};

/** The salary boundaries — range and floor, with the currency. */
export const salaryFacts = (b: JhgBoundaries | null | undefined): Fact[] => {
  if (!b) return [];
  const cur = text(b.currency);
  const money = (v: string | undefined) => (text(v) ? [cur, text(v)].filter(Boolean).join(" ") : "");
  return facts([
    fact("Range", b.salaryLower && b.salaryUpper ? `${money(b.salaryLower)} – ${text(b.salaryUpper)}` : money(b.salaryLower) || money(b.salaryUpper)),
    fact("Floor", money(b.salaryFloor)),
  ]);
};

/** Where the member will and won't work, as the coach recorded it. */
export const locationFacts = (b: JhgBoundaries | null | undefined): Fact[] => {
  if (!b) return [];
  return facts([
    fact("Will work in", b.willWorkIn),
    fact("Exclude", b.exclude),
    fact("Remote", yesNo(b.remote)),
    fact("Local hybrid", yesNo(b.localHybrid)),
    fact("Relocate", yesNo(b.relocate)),
    fact("Travel for a remote role", b.remoteTravel),
    fact("Work rights", b.visaStatus),
    fact("Authorised in", list(b.authorizedIn).join(", ")),
    fact("Needs sponsorship", yesNo(b.needsSponsorship)),
  ]);
};

/** Hard no's, culture must-haves, soft dislikes, notice period, levels and companies to never apply to. */
export const boundaryLists = (b: JhgBoundaries | null | undefined): FactList[] => {
  if (!b) return [];
  return lists([
    factList("Hard no's — do not apply", b.hardNos),
    factList(`Culture must-haves${yesNo(b.deprioritizeIfAbsent) === "Yes" ? " — deprioritise when absent" : ""}`, b.cultureMustHaves),
    factList("Soft dislikes — lower, not a no", b.softDislikes),
    factList("Levels to exclude", b.excludeLevels),
    factList("Never apply", b.neverApply),
  ]);
};

export const boundaryFacts = (b: JhgBoundaries | null | undefined): Fact[] =>
  b ? facts([fact("Notice period", b.noticePeriodDays !== undefined ? plural(b.noticePeriodDays, "day") : "")]) : [];

/** True when the True North workbook has any boundary at all. */
export const hasBoundaries = (j: JhgBlock | null | undefined): boolean => {
  const b = j?.trueNorth?.boundaries;
  return !!b && (boundaryLists(b).length > 0 || boundaryFacts(b).length > 0 || salaryFacts(b).length > 0 || locationFacts(b).length > 0 || list(b.negotiationLines).length > 0);
};

/** "3 hard no's · 3 must-haves · 2 never apply · 28 days' notice" — the Boundaries row. */
export function boundariesSummary(j: JhgBlock | null | undefined): string {
  const b = j?.trueNorth?.boundaries;
  if (!b) return "";
  return [
    list(b.hardNos).length ? `${plural(list(b.hardNos).length, "hard no", "hard no's")}` : "",
    list(b.cultureMustHaves).length ? plural(list(b.cultureMustHaves).length, "must-have") : "",
    list(b.neverApply).length ? `${list(b.neverApply).length} never apply` : "",
    b.noticePeriodDays !== undefined ? `${b.noticePeriodDays} days' notice` : "",
  ].filter(Boolean).join(" · ");
}

/** The cluster's fit word as a label: primary → Primary. */
export const fitLabel = (v: string | null | undefined): string => { const t = text(v); return t ? t.charAt(0).toUpperCase() + t.slice(1) : ""; };

/** "sunrise" → Sunrise, "sunset" → Sunset — the sub-sector's outlook as a word. */
export const outlookLabel = fitLabel;

// ---- target companies ----

const norm = (s: string | null | undefined): string => text(s).toLowerCase().replace(/\s+/g, " ");

/** The researched company behind a ranked row, by name. */
export const companyByName = (j: JhgBlock | null | undefined): Map<string, JhgCompany> =>
  new Map((j?.targetCompanies?.companies ?? []).filter((c) => text(c.name)).map((c) => [norm(c.name), c]));
export const top10ByName = (j: JhgBlock | null | undefined): Map<string, JhgTop10> =>
  new Map((j?.targetCompanies?.top10 ?? []).filter((c) => text(c.name)).map((c) => [norm(c.name), c]));
export const top3ByName = (j: JhgBlock | null | undefined): Map<string, JhgTop3> =>
  new Map((j?.targetCompanies?.top3 ?? []).filter((c) => text(c.name)).map((c) => [norm(c.name), c]));

/** "19 · G5 I5 A4 P5" — the Packer's scores on one line; "" when none. */
export function scoresLine(s: CompanyScores | null | undefined): string {
  if (!s) return "";
  const parts = [s.growth !== undefined ? `G${s.growth}` : "", s.interest !== undefined ? `I${s.interest}` : "", s.access !== undefined ? `A${s.access}` : "", s.proof !== undefined ? `P${s.proof}` : ""].filter(Boolean);
  const total = s.total !== undefined ? String(s.total) : "";
  return [total, parts.join(" ")].filter(Boolean).join(" · ");
}

export const SCORE_LEGEND = "Scores: total · Growth · Interest · Access · Proof, each 1–5.";

/** The reason a company was shortlisted, as a word: "press_or_funding" → Press or funding. */
export const inspiredByLabel = (v: string | null | undefined): string => { const t = text(v).replace(/_/g, " "); return t ? t.charAt(0).toUpperCase() + t.slice(1) : ""; };

/** What a Top 40 row shows under its name — the growth signal, where it is, who the member knows. */
export function companyFacts(c: RankedCompany, j: JhgBlock | null | undefined): Fact[] {
  const r = companyByName(j).get(norm(c.name));
  if (!r) return [];
  return facts([
    fact("Growth signal", r.growthSignal, r.growthSource),
    fact("Location", r.location),
    fact("Known contact", r.knownContact),
    fact("Found via", inspiredByLabel(r.inspiredBy)),
    fact("Website", r.website, r.website),
  ]);
}

/** What a Top 10 row shows — who hires, who the member knows, the thesis and the problem it answers. */
export function top10Facts(c: RankedCompany, j: JhgBlock | null | undefined): Fact[] {
  const r = top10ByName(j).get(norm(c.name));
  if (!r) return [];
  return facts([
    fact("Business problem", r.businessProblem),
    fact("Thesis", r.thesis),
    fact("Hiring authority", r.hiringAuthorityTitle),
    fact("Known person", r.knownPerson),
    fact("Careers page", r.careersUrlNote),
    fact("Say it loud", yesNo(r.sayItLoud)),
  ]);
}

/** What a Top 3 row shows — why now, the first move, and the date to make it by. */
export function top3Facts(c: RankedCompany, j: JhgBlock | null | undefined): Fact[] {
  const r = top3ByName(j).get(norm(c.name));
  if (!r) return [];
  return facts([
    fact("Why now", r.whyNow),
    fact("First move", r.firstMove),
    fact("By", isoDate(r.byDate)),
  ]);
}

// ---- artefacts ----

/** The fact behind a story, by the story's id (S1 → its fact), then by title. */
export function storyFact(j: JhgBlock | null | undefined, story: { id?: string; title?: string }): JhgStoryFact | undefined {
  const all = j?.artefacts?.storyFacts ?? [];
  const id = text(story.id), title = norm(story.title);
  return (id ? all.find((f) => text(f.id) === id) : undefined) ?? (title ? all.find((f) => norm(f.title) === title) : undefined);
}

/** "Release dashboard, Q2 2023" and how sure: "verified" → Verified, "user_cannot_confirm" → Can't confirm. */
export const sourceLabel = (v: string | null | undefined): string => {
  const t = text(v);
  if (!t) return "";
  if (t === "user_cannot_confirm") return "Can't confirm";
  return t.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
};

export function storyFactFacts(f: JhgStoryFact | undefined): Fact[] {
  if (!f) return [];
  return facts([
    fact("Where", f.role),
    fact("Lead skill", f.leadSkill),
    fact("Numbers", list(f.numbers).join(" · ")),
    fact("Source", [sourceLabel(f.sourceStatus), text(f.sourceNote)].filter(Boolean).join(" — ")),
  ]);
}

/** The CV's house rules, locked sections and current domain, for the Master CV section. */
export const cvRuleLists = (j: JhgBlock | null | undefined): FactList[] => {
  const a = j?.artefacts;
  if (!a) return [];
  return lists([factList("CV house rules", a.cvHouseRules), factList("Locked sections — never rewritten", a.lockedSections)]);
};
export const cvRuleFacts = (j: JhgBlock | null | undefined): Fact[] => {
  const a = j?.artefacts;
  if (!a) return [];
  return facts([fact("Current domain", a.currentDomain)]);
};

/** "te reo Māori — beginner → conversational by end of 2027" — one line per language the member is learning. */
export const languageLines = (j: JhgBlock | null | undefined): string[] =>
  (j?.artefacts?.languageLearning ?? []).filter((l) => text(l.language)).map((l) => {
    const levels = [text(l.currentLevel), text(l.targetLevel)].filter(Boolean).join(" → ");
    return [text(l.language), levels ? `— ${levels}` : "", text(l.targetDate) ? `by ${l.targetDate}` : "", list(l.countries).length ? `(${list(l.countries).join(", ")})` : ""].filter(Boolean).join(" ");
  });
