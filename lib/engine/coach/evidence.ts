// The portal's evidence under each company in the scoring matrix (docs/UX_COACH_COMPANY_SCORING.md §2): Growth and Access
// suggested from stored facts against the rubric's own anchors; Interest and Proof given context, never a number. Every
// line here is a template over data — the model writes none of it. Pure. Tested.

import type { JhgBoundaries, JhgCompany, JhgPosting } from "../../careerops/types";
import { MAX_NAMED_CONTACTS, type Connection } from "./connections";

export interface GrowthEvidence { suggested: 1 | 2 | 3 | 4 | 5; why: string[] }
export interface AccessEvidence { suggested: 1 | 3 | 5; contacts: { name: string; position: string; connectedOn: string }[]; more: number }
export interface CompanyEvidence { growth: GrowthEvidence; access: AccessEvidence; interest: { line: string }; proof: { phrases: string[]; matches: string[]; line: string } }

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
  boundaries: JhgBoundaries | undefined;
  wantedType: string;
  today: string;
}

export function evidenceFor(i: EvidenceInput): CompanyEvidence {
  const growth = growthSuggestion(i.company, i.postings, i.archetypeTitles, i.today);
  const now = i.postings.filter((p) => !p.postedAt || daysBetween(p.postedAt, i.today) <= POSTING_DAYS).length;
  const access = accessSuggestion(i.contacts, now, i.archetypeTitles);
  const interest = { line: interestContext(i.company, i.boundaries, i.wantedType) };
  const proof = proofContext(i.postings.flatMap((p) => p.phrases ?? []), i.competencies);
  return { growth, access, interest, proof };
}

/** The matrix's pre-filled cells in axis order: growth · interest · access · proof. */
export const suggestedValues = (e: CompanyEvidence): (number | null)[] => [e.growth.suggested, null, e.access.suggested, null];

/** The archetype's titles: the primary cluster's first, then the target titles. */
export function archetypeTitlesOf(trueNorth: { clusters?: { titles?: string[]; fit?: string }[]; titles?: { target?: string[] } } | undefined): string[] {
  const primary = trueNorth?.clusters?.find((c) => c.fit === "primary");
  return [...new Set([...(primary?.titles ?? []), ...(trueNorth?.titles?.target ?? [])].map((t) => t.trim()).filter(Boolean))];
}

/** The member's True North postings at a company, as posting facts. */
export const trueNorthPostingsAt = (postings: readonly JhgPosting[] | undefined, companyName: string, matches: (a: string, b: string) => boolean): PostingFact[] =>
  (postings ?? []).filter((p) => p.company && matches(p.company, companyName)).map((p) => ({ title: p.title, postedAt: p.verified ?? "", source: "your postings", phrases: p.phrases }));
