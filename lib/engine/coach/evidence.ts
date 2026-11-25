// The portal's evidence under each company in the scoring matrix (docs/UX_COACH_COMPANY_SCORING.md §2, §7): all four
// numbers suggested from stored facts against the rubric's own anchors — Market signal from the postings and the growth
// source, Fit from the member's target industries, company type and boundaries, Access from their LinkedIn connections,
// Proficiency from their scored skills against what the company posts for (decision 2026-11-25). The member confirms or
// changes any number; every line here is a template over data — the model writes none of it. Pure. Tested.

import type { JhgBoundaries, JhgCompany, JhgPosting } from "../../careerops/types";
import { MAX_NAMED_CONTACTS, type Connection } from "./connections";
import type { SkillScore } from "./skills";

export type Suggested = 1 | 2 | 3 | 4 | 5;
export interface GrowthEvidence { suggested: Suggested; why: string[] }
export interface AccessEvidence { suggested: 1 | 3 | 5; contacts: { name: string; position: string; connectedOn: string }[]; more: number }
export interface FitEvidence { suggested: Suggested; line: string }
export interface ProficiencyEvidence { suggested: Suggested; phrases: string[]; matches: string[]; line: string }
export interface CompanyEvidence { growth: GrowthEvidence; access: AccessEvidence; interest: FitEvidence; proof: ProficiencyEvidence }

/** A posting at the company as the shared collection or the member's True North carries it. */
export interface PostingFact { title: string; postedAt: string; source: string; phrases?: string[] }

/** A dated event this recent is a 5 with hiring; this old is still a signal. */
export const RECENT_DAYS = 90;
export const SIGNAL_DAYS = 365;
/** A posting this old is not "now". */
export const POSTING_DAYS = 30;

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/** The date a growth signal names — "2026-09", "Sep 2026", "September 2026", "(2026)" → ISO month or year start; null when none. */
export function signalDate(text: string): string | null {
  const t = text.toLowerCase();
  const iso = t.match(/\b(20\d\d)-(0[1-9]|1[0-2])(?:-(0[1-9]|[12]\d|3[01]))?\b/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3] ?? "01"}`;
  const mon = t.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(20\d\d)\b/);
  if (mon) return `${mon[2]}-${String(MONTHS.indexOf(mon[1]) + 1).padStart(2, "0")}-01`;
  const fy = t.match(/\b(?:fy|h[12]|q[1-4])\s*(?:20)?(\d\d)\b/);
  if (fy) return `20${fy[1]}-06-30`;
  const year = t.match(/\b(20\d\d)\b/);
  return year ? `${year[1]}-01-01` : null;
}

export const daysBetween = (fromIso: string, toIso: string): number => Math.round((Date.parse(`${toIso}T00:00:00Z`) - Date.parse(`${fromIso}T00:00:00Z`)) / 86_400_000);

const tokens = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").split(" ").filter((t) => t.length > 2);
const SENIORITY = new Set(["senior", "lead", "principal", "head", "chief", "director", "manager", "staff", "junior", "intern", "associate", "vice", "president", "group"]);

/** A posting is for the archetype when its title shares a meaningful word with one of the cluster's titles — "Senior Product Manager" ~ "Product Lead". */
export function titleMatches(postingTitle: string, archetypeTitles: readonly string[]): boolean {
  const p = new Set(tokens(postingTitle).filter((t) => !SENIORITY.has(t)));
  if (!p.size) return false;
  return archetypeTitles.some((a) => tokens(a).filter((t) => !SENIORITY.has(t)).some((t) => p.has(t)));
}

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

/** Growth against the anchors: hiring for the archetype now + a dated event ≤ 90 days → 5; one of them → 4 / 3; undated or old → 2; nothing → 1. */
export function growthSuggestion(company: Pick<JhgCompany, "growthSignal" | "growthSource">, postings: readonly PostingFact[], archetypeTitles: readonly string[], today: string): GrowthEvidence {
  const why: string[] = [];
  const now = postings.filter((p) => !p.postedAt || daysBetween(p.postedAt, today) <= POSTING_DAYS);
  const forYou = now.filter((p) => titleMatches(p.title, archetypeTitles));
  if (forYou.length) {
    const titles = [...new Set(forYou.map((p) => p.title))].slice(0, 2).join(", ");
    const newest = [...forYou].sort((a, b) => (b.postedAt || "").localeCompare(a.postedAt || ""))[0];
    why.push(`hiring ${plural(forYou.length, "role")} for you now — ${titles}${newest.source ? ` (${newest.source}${newest.postedAt ? `, ${newest.postedAt}` : ""})` : ""}`);
  } else if (now.length) why.push(`hiring ${plural(now.length, "role")} now, none for your titles`);
  const signal = company.growthSignal?.trim() ?? "";
  const date = signal ? signalDate(signal) : null;
  const age = date ? daysBetween(date, today) : null;
  if (signal) why.push(`${signal}${company.growthSource ? " ›" : ""}`);
  let suggested: GrowthEvidence["suggested"];
  if (forYou.length && age !== null && age <= RECENT_DAYS) suggested = 5;
  else if (forYou.length || (age !== null && age <= RECENT_DAYS)) suggested = 4;
  else if (age !== null && age <= SIGNAL_DAYS) suggested = 3;
  else if (signal || now.length) suggested = 2;
  else { suggested = 1; why.push("nothing on file"); }
  return { suggested, why };
}

const AUTHORITY = /\b(head|director|vp|vice president|chief|cto|cpo|coo|ceo|founder|general manager|gm|lead)\b/i;

/** Access against the anchors: a first-degree connection → 5 (authority roles named first); a posting now → 3 (a route); nothing → 1. */
export function accessSuggestion(contacts: readonly Connection[], postingsNow: number, archetypeTitles: readonly string[]): AccessEvidence {
  const ranked = [...contacts].sort((a, b) => score(b) - score(a));
  function score(c: Connection): number { return (AUTHORITY.test(c.position) ? 2 : 0) + (titleMatches(c.position, archetypeTitles) ? 1 : 0); }
  const named = ranked.slice(0, MAX_NAMED_CONTACTS).map((c) => ({ name: c.name, position: c.position, connectedOn: c.connectedOn }));
  if (contacts.length) return { suggested: 5, contacts: named, more: Math.max(0, contacts.length - named.length) };
  return { suggested: postingsNow > 0 ? 3 : 1, contacts: [], more: 0 };
}

const inText = (hay: string | undefined, needle: string): boolean => !!hay && hay.toLowerCase().includes(needle.toLowerCase());

/** Interest gets no number: one line on how the company sits against the boundaries that are words. */
export function interestContext(company: Pick<JhgCompany, "location" | "companyType" | "name">, boundaries: JhgBoundaries | undefined, wantedType: string): string {
  const parts: string[] = [];
  const loc = company.location?.trim();
  if (loc) {
    const city = loc.split(",")[0].trim();
    if (boundaries?.exclude && inText(boundaries.exclude, city)) parts.push(`${loc} — on your exclude list${boundaries.remote && /^y/i.test(boundaries.remote) ? "; remote: yes" : ""}`);
    else if (boundaries?.willWorkIn && !inText(boundaries.willWorkIn, city)) parts.push(`${loc} — not in Will work in${boundaries.remote && /^y/i.test(boundaries.remote) ? "; remote: yes" : ""}`);
    else parts.push(loc);
  }
  if (company.companyType) parts.push(wantedType && company.companyType.toLowerCase() === wantedType.toLowerCase() ? `${company.companyType} — the type you aim at` : company.companyType);
  if (boundaries?.neverApply?.some((n) => inText(company.name, n) || inText(n, company.name))) parts.push("on your never-join list");
  return parts.join(" · ") || "no boundary on file speaks to this one";
}

const nameMatches = (a: string, b: string) => { const x = tokens(a), y = new Set(tokens(b)); return x.length > 0 && x.some((t) => y.has(t)); };

/**
 * Fit against the anchors, from the aspiration (decision 2026-11-25): on the never list → 1; outside the boundaries with no
 * remote → 2; open → 3; the member's industry or company type → 4; both, within the boundaries → 5.
 */
export function fitSuggestion(company: Pick<JhgCompany, "location" | "companyType" | "name" | "industry" | "subSector">, boundaries: JhgBoundaries | undefined, wantedType: string, targetIndustries: readonly string[]): FitEvidence {
  const line = interestContext(company, boundaries, wantedType);
  if (boundaries?.neverApply?.some((n) => inText(company.name, n) || inText(n, company.name))) return { suggested: 1, line };
  const city = company.location?.split(",")[0].trim() ?? "";
  const remote = !!boundaries?.remote && /^y/i.test(boundaries.remote);
  const excluded = !!city && !!boundaries?.exclude && inText(boundaries.exclude, city);
  const outside = !!city && !!boundaries?.willWorkIn && !inText(boundaries.willWorkIn, city);
  if (excluded && !remote) return { suggested: 2, line };
  const industry = targetIndustries.some((t) => nameMatches(t, company.industry ?? "") || nameMatches(t, company.subSector ?? ""));
  const type = !!wantedType && !!company.companyType && company.companyType.toLowerCase() === wantedType.toLowerCase();
  const inBounds = !excluded && !(outside && !remote);
  const suggested: Suggested = industry && type && inBounds ? 5 : industry || type ? (inBounds ? 4 : 3) : 3;
  return { suggested, line: industry ? `${line} · your industry` : line };
}

/**
 * Proficiency against the anchors, from the scored skills (decision 2026-11-25): no postings read → 2; nothing they post for is a
 * skill of theirs → 1; a skill matches → 3; a skill they are solid at (Good ≥ 4) → 4; a top-six skill with proof (Prove ≥ 4) that
 * matches what they hire for → 5. Competencies without a score count as a match at 3.
 */
export function proficiencySuggestion(phrases: readonly string[], competencies: readonly string[], skills: readonly SkillScore[], topCut = 6): ProficiencyEvidence {
  const ctx = proofContext(phrases, competencies);
  if (!ctx.phrases.length) return { suggested: 2, ...ctx };
  const matched = skills.filter((s) => { const st = tokens(s.skill); return st.length && ctx.phrases.some((q) => { const qt = new Set(tokens(q)); return st.some((t) => qt.has(t)); }); });
  const names = [...new Set([...ctx.matches, ...matched.map((s) => s.skill)])];
  if (!names.length) return { suggested: 1, ...ctx };
  const best = matched.reduce<SkillScore | null>((b, s) => (!b || s.good > b.good ? s : b), null);
  const top = matched.some((s) => s.rank > 0 && s.rank <= topCut && s.proof >= 4);
  const suggested: Suggested = top ? 5 : best && best.good >= 4 ? 4 : 3;
  const line = `they post for ${ctx.phrases.map((q) => `"${q}"`).join(", ")} — you have ${names.join(", ")}${best ? ` (${best.skill}: good ${best.good}, proof ${best.proof})` : ""}`;
  return { suggested, phrases: ctx.phrases, matches: names, line };
}

/** Proof gets no number: what they post for, beside the competency of yours that fits — matched on words, never written. */
export function proofContext(phrases: readonly string[], competencies: readonly string[]): { phrases: string[]; matches: string[]; line: string } {
  const quoted = [...new Set(phrases.map((p) => p.trim()).filter(Boolean))].slice(0, 3);
  const matches = competencies.filter((c) => { const ct = tokens(c); return ct.length && quoted.some((q) => { const qt = new Set(tokens(q)); return ct.some((t) => qt.has(t)); }); });
  if (!quoted.length) return { phrases: [], matches: [], line: "no postings read — a guess unless you know their problem" };
  const line = `they post for ${quoted.map((q) => `"${q}"`).join(", ")}${matches.length ? ` — you have ${matches.join(", ")}` : " — none of your competencies in their words"}`;
  return { phrases: quoted, matches, line };
}

export interface EvidenceInput {
  company: JhgCompany;
  /** Postings at this company: the shared collection's rows and the True North postings the member read. */
  postings: PostingFact[];
  contacts: Connection[];
  archetypeTitles: string[];
  competencies: string[];
  /** The member's scored skills (Coach 1's matrix) — Proficiency reads them. */
  skills?: SkillScore[];
  /** The True North's industries and sub-sectors by name — Fit reads them. */
  targetIndustries?: string[];
  boundaries: JhgBoundaries | undefined;
  wantedType: string;
  today: string;
}

export function evidenceFor(i: EvidenceInput): CompanyEvidence {
  const growth = growthSuggestion(i.company, i.postings, i.archetypeTitles, i.today);
  const now = i.postings.filter((p) => !p.postedAt || daysBetween(p.postedAt, i.today) <= POSTING_DAYS).length;
  const access = accessSuggestion(i.contacts, now, i.archetypeTitles);
  const interest = fitSuggestion(i.company, i.boundaries, i.wantedType, i.targetIndustries ?? []);
  const proof = proficiencySuggestion(i.postings.flatMap((p) => p.phrases ?? []), i.competencies, i.skills ?? []);
  return { growth, access, interest, proof };
}

/** The matrix's pre-filled cells in axis order: Market signal · Fit · Access · Proficiency — all four from data (decision 2026-11-25). */
export const suggestedValues = (e: CompanyEvidence): (number | null)[] => [e.growth.suggested, e.interest.suggested, e.access.suggested, e.proof.suggested];

/** The True North's industries and sub-sectors by name — what Fit matches a company's industry against. */
export const targetIndustriesOf = (trueNorth: { industries?: { name: string; subSectors?: { name: string }[] }[] } | undefined): string[] =>
  (trueNorth?.industries ?? []).flatMap((i) => [i.name, ...(i.subSectors ?? []).map((s) => s.name)]).map((s) => s.trim()).filter(Boolean);

/** The archetype's titles: the primary cluster's first, then the target titles. */
export function archetypeTitlesOf(trueNorth: { clusters?: { titles?: string[]; fit?: string }[]; titles?: { target?: string[] } } | undefined): string[] {
  const primary = trueNorth?.clusters?.find((c) => c.fit === "primary");
  return [...new Set([...(primary?.titles ?? []), ...(trueNorth?.titles?.target ?? [])].map((t) => t.trim()).filter(Boolean))];
}

/** The member's True North postings at a company, as posting facts. */
export const trueNorthPostingsAt = (postings: readonly JhgPosting[] | undefined, companyName: string, matches: (a: string, b: string) => boolean): PostingFact[] =>
  (postings ?? []).filter((p) => p.company && matches(p.company, companyName)).map((p) => ({ title: p.title, postedAt: p.verified ?? "", source: "your postings", phrases: p.phrases }));
