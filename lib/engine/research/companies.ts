// The companies job — Target companies Part A as a job, not a turn (docs/COACH_ASSESSMENT_2026-11-16.md §1.2;
// docs/SEARCH_TO_API_ASSESSMENT_2026-11-17.md §2 row 5). Pure: what to source from, the two passes' shapes (the job
// boards' postings grouped by employer — an API; the model's proposal for the industries — a job with search, every
// link opened by code), the merge that excludes the never-join list and caps at forty, the rows as the profile stores
// them, and the table the coach reads next turn. The handler (lib/engine/handlers/companies.ts) does the calls and
// the writes. Tested.

import { z } from "zod";
import type { ProfileFile } from "../../careerops/profile-file";
import type { JhgCompany } from "../../careerops/types";
import type { ProfilePortal } from "../../jobhacking/sections";
import { slug, type PipelineCountry, type SourcedPosting } from "../sourcing/keys";
import { atsBoardPage, atsOf } from "../sourcing/ats";

export const COMPANIES_TARGET = 40;
/** The model's one call proposes the industry-led passes; its searches are capped — the links are opened by code after. */
export const COMPANIES_MAX_SEARCHES = 10;
/** The job boards' queries for the companies job — titles and industries, city and country-wide; the metered source may spend this many. */
export const COMPANIES_MAX_BOARD_QUERIES = 12;
export const COMPANIES_MAX_URL_CHECKS = 80;
/** Companies per industry the proposal is asked for — enough that forty survive verification and the never-join list. */
export const COMPANIES_PER_INDUSTRY = 8;

export const COMPANY_TYPES = ["startup", "scaleup", "established", "public_sector"] as const;
export const INSPIRED_BY = ["industry_growth", "competitor", "customer_or_supplier", "network_or_alumni", "press_or_funding", "job_posting", "event_or_community", "other"] as const;

export interface CompaniesIndustry { name: string; subSectors: { name: string; outlook: string }[] }

export interface CompaniesPayload {
  /** True North's industries with their sub-sectors and outlooks — the proposal's frame, the outlook's source. */
  industries: CompaniesIndustry[];
  /** The primary cluster's titles first, then the target titles — what the job boards are asked for. */
  titles: string[];
  region: string;
  country: PipelineCountry | null;
  companyType: string;
  /** Boundaries that are code: never-join names; the places excluded, as the member wrote them. */
  neverApply: string[];
  exclude: string;
  /** Companies already on the page — kept first on a re-run; never sourced twice. */
  stored: JhgCompany[];
  /** Names the member added in the conversation — sourced like the rest. */
  names: string[];
  /** The model's industry-led proposal: "auto" runs it only when the boards leave the list short; "off" never (API only). */
  proposal: "auto" | "off";
  portal: ProfilePortal;
}

const strings = (v: unknown, max = 12): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && !!x.trim()).map((x) => x.trim()).slice(0, max) : []);

/** What the job sources from: True North and the Narrative first, the coach's hints over them. */
export function companiesPayload(profile: ProfileFile, hints: Record<string, unknown> = {}, countryOf: (region: string) => PipelineCountry | null = () => null): CompaniesPayload {
  const tn = profile.jhg?.trueNorth;
  const industries: CompaniesIndustry[] = (tn?.industries ?? []).filter((i) => i?.name?.trim()).slice(0, 3).map((i) => ({ name: i.name.trim(), subSectors: (i.subSectors ?? []).filter((s) => s?.name?.trim()).map((s) => ({ name: s.name.trim(), outlook: s.outlook === "sunrise" || s.outlook === "sunset" ? s.outlook : "" })) }));
  const primary = (tn?.clusters ?? []).find((c) => c.fit === "primary");
  const titles = [...new Set([...strings(hints.titles, 6), ...strings(primary?.titles, 4), ...strings(tn?.titles?.target, 6)])].slice(0, 8);
  const region = (typeof hints.region === "string" && hints.region.trim()) || profile.goal?.city?.trim() || profile.jhg?.identity?.location?.trim() || profile.contact?.location?.trim() || "";
  return {
    industries, titles, region, country: countryOf(region),
    companyType: profile.goal?.companyType?.trim() || tn?.companyType?.trim() || "",
    neverApply: strings(tn?.boundaries?.neverApply, 20), exclude: tn?.boundaries?.exclude?.trim() ?? "",
    stored: (profile.jhg?.targetCompanies?.companies ?? []).filter((c) => c?.name?.trim()),
    names: strings(hints.names, 10),
    proposal: hints.proposal === "off" || (hints.proposal === undefined && process.env.COMPANIES_PROPOSAL === "off") ? "off" : "auto",
    portal: hints.portal === "compass" ? "compass" : "jobhacking",
  };
}

/** Nothing to source from — no industry, no title, no name. */
export const companiesPayloadEmpty = (p: CompaniesPayload): boolean => !p.industries.length && !p.titles.length && !p.names.length;

/** The model's proposal — the industry-led passes, each company with the link that carries its signal. */
export const CompaniesSchema = z.object({
  companies: z.array(z.object({
    name: z.string().describe("As the company writes it"),
    companyType: z.enum(COMPANY_TYPES).describe("public_sector for government and its agencies"),
    inspiredBy: z.enum(["industry_growth", "competitor", "customer_or_supplier", "press_or_funding", "event_or_community", "other"]).describe("Which pass found it"),
    industry: z.string().describe("The industry it sells into, named exactly as given"),
    subSector: z.string().describe("Its sub-sector, named exactly as given; '' when none fits"),
    location: z.string().describe("Where it is, city and country"),
    website: z.string().describe("Its own site, absolute URL; '' when unknown"),
    growthSignal: z.string().describe("A number or a dated event — funding, a result, a hiring wave, an expansion"),
    growthSource: z.string().describe("The URL search returned for the signal, exactly as returned — never the company's own site, never constructed"),
    careersUrl: z.string().describe("The page that LISTS its jobs — its ATS board where one exists — exactly as returned; '' when not found"),
  })).describe("Up to eight per industry across the passes; no company on the never-join list"),
  note: z.string().describe("One line on coverage; '' when nothing to say"),
});
export type CompaniesAnswer = z.infer<typeof CompaniesSchema>;
export type ProposedCompany = CompaniesAnswer["companies"][number];

/** The task message for the proposal: the frame the prompt expects. */
export function companiesTask(p: CompaniesPayload, today: string, perIndustry = COMPANIES_PER_INDUSTRY): string {
  const industries = p.industries.map((i) => `- ${i.name}${i.subSectors.length ? ` — sub-sectors: ${i.subSectors.map((s) => s.name).join(" · ")}` : ""}`).join("\n");
  return [
    `Today: ${today}.`,
    `Geography: ${p.region || "(not given — the industries' home market)"}${p.exclude ? `; excluded: ${p.exclude}` : ""}.`,
    `Industries (True North, first = North Star):\n${industries || "- (none — use the titles)"}`,
    p.titles.length ? `Titles the market posts for the member: ${p.titles.join(" · ")}.` : "",
    p.companyType ? `Company type they aim at: ${p.companyType}.` : "",
    p.neverApply.length ? `Never include: ${p.neverApply.join(" · ")}.` : "",
    p.stored.length ? `Already on their page (do not propose again): ${p.stored.map((c) => c.name).join(" · ")}.` : "",
    p.names.length ? `The member asked for these by name — source each one too: ${p.names.join(" · ")}.` : "",
    `Return up to ${perIndustry} companies per industry across the passes: leaders and fast growers · competitors expanding · customers and suppliers · press or funding this year.`,
  ].filter(Boolean).join("\n");
}

/** One candidate before verification — either pass. */
export interface Candidate {
  name: string; companyType?: string; inspiredBy: string; industry: string; subSector: string; location: string; website: string;
  growthSignal: string; growthSource: string; careersUrl: string;
}

const nameKey = (n: string) => slug(n);

/**
 * The job boards' postings grouped by employer — the API pass: the signal is the open roles, the source the newest posting,
 * the industry the query that found it (when an industry query did), the careers page the ATS board a posting link sits on.
 */
export function fromPostings(rows: readonly SourcedPosting[], titles: readonly string[]): Candidate[] {
  const by = new Map<string, SourcedPosting[]>();
  for (const r of rows) { const k = nameKey(r.company); by.set(k, [...(by.get(k) ?? []), r]); }
  const out: Candidate[] = [];
  for (const list of by.values()) {
    const newest = [...list].sort((a, b) => (b.postedAt || "").localeCompare(a.postedAt || ""))[0];
    const n = list.length;
    const roles = [...new Set(list.map((p) => p.title))].slice(0, 2).join(", ");
    const industries = list.map((p) => p.foundBy?.industry).filter((x): x is string => !!x);
    const industry = industries.length ? [...industries].sort((a, b) => industries.filter((x) => x === b).length - industries.filter((x) => x === a).length)[0] : "";
    const board = list.map((p) => atsOf(p.url)).find((b) => b !== null);
    const forTitle = list.some((p) => p.foundBy?.from === "title") && titles.length ? ` for ${titles[0]}` : "";
    out.push({ name: newest.company, inspiredBy: industry ? "industry_growth" : "job_posting", industry, subSector: "", location: newest.location, website: "", growthSignal: `${n} open posting${n === 1 ? "" : "s"} now — ${roles}${newest.postedAt ? ` (${newest.postedAt})` : ""}${forTitle}`, growthSource: newest.url, careersUrl: board ? atsBoardPage(board) : "" });
  }
  // The employers posting most, first.
  return out.sort((a, b) => parseInt(b.growthSignal) - parseInt(a.growthSignal));
}

const neverMatches = (name: string, never: readonly string[]) => { const n = name.toLowerCase(); return never.some((x) => { const v = x.toLowerCase().trim(); return !!v && (n === v || n.includes(v) || v.includes(n)); }); };

/** Stored first, then the member's names, then the posting pass, then the proposal; one row per company; nobody on the never-join list; at most the target. */
export function mergeCandidates(stored: readonly JhgCompany[], passes: readonly (readonly Candidate[])[], neverApply: readonly string[], max = COMPANIES_TARGET): { kept: Candidate[]; excluded: string[] } {
  const seen = new Set(stored.map((c) => nameKey(c.name)));
  const kept: Candidate[] = [];
  const excluded: string[] = [];
  for (const pass of passes) for (const c of pass) {
    if (!c.name?.trim()) continue;
    const k = nameKey(c.name);
    if (seen.has(k)) continue;
    if (neverMatches(c.name, neverApply)) { excluded.push(c.name); seen.add(k); continue; }
    if (stored.length + kept.length >= max) break;
    seen.add(k); kept.push(c);
  }
  return { kept, excluded };
}

/** The sub-sector's outlook as True North has it — the row's label is copied, never judged here (C3). */
export function outlookFor(p: CompaniesPayload, industry: string, subSector: string): string {
  const i = p.industries.find((x) => x.name.toLowerCase() === industry.trim().toLowerCase());
  const s = i?.subSectors.find((x) => x.name.toLowerCase() === subSector.trim().toLowerCase());
  return s?.outlook ?? "";
}

export interface VerifiedCandidate extends Candidate { sourceOpened: boolean; careersUrlStatus: "opened_by_coach" | "none" }

/** The rows as the profile stores them, after the stored ones, ranked in order — unscored; the member's four numbers come in Part B. */
export function toProfileCompanies(stored: readonly JhgCompany[], rows: readonly VerifiedCandidate[], p: CompaniesPayload): JhgCompany[] {
  const fresh: JhgCompany[] = rows.filter((r) => r.sourceOpened).map((r) => ({
    name: r.name.trim(), companyType: r.companyType && (COMPANY_TYPES as readonly string[]).includes(r.companyType) ? r.companyType : undefined, inspiredBy: (INSPIRED_BY as readonly string[]).includes(r.inspiredBy) ? r.inspiredBy : "other",
    industry: r.industry.trim(), subSector: r.subSector.trim(), outlook: outlookFor(p, r.industry, r.subSector), location: r.location.trim(), website: r.website.trim() || undefined,
    growthSignal: r.growthSignal.trim(), growthSource: r.growthSource.trim(), knownContact: "", careersUrlStatus: r.careersUrlStatus, ...(r.careersUrlStatus === "opened_by_coach" ? { careersUrl: r.careersUrl.trim() } : {}),
  }));
  const all = [...stored, ...fresh].slice(0, COMPANIES_TARGET);
  return all.map((c, i) => ({ ...c, rank: i + 1 }));
}

/** The table the coach reads on its next turn — the field in forty rows, never the pages. */
export function companiesSummary(companies: readonly JhgCompany[], added: number, excluded: readonly string[], note: string): string {
  const rows = companies.map((c) => `| ${c.rank ?? ""} | ${c.name} | ${c.companyType ?? ""} | ${c.inspiredBy ?? ""} | ${c.industry ?? ""} | ${c.subSector ?? ""} | ${c.location ?? ""} | ${c.growthSignal ?? ""} | ${c.growthSource ?? ""} | ${c.careersUrlStatus === "opened_by_coach" ? c.careersUrl : "none"} |`);
  return [
    `${companies.length} companies on jhg.targetCompanies.companies (${added} added by the portal — every growth source and careers page opened by code${excluded.length ? `; left out as never-join: ${excluded.join(", ")}` : ""}).${note ? ` ${note}` : ""} Show them ten at a time; the member deletes, adds and approves; then Part B.`,
    "| # | Company | Type | Found by | Industry | Sub-sector | Location | Signal | Source | Careers page |",
    "|---|---|---|---|---|---|---|---|---|---|",
    ...rows,
  ].join("\n");
}

export interface CompaniesResult { count: number; added: number; excluded: number; summary: string; searches: number }
