// Share a JobHacking page as a read-only document — docs/UX_SHARE.md
// (decision 2026-11-07).
//
// One link per page: Narrative · True North · Target companies, and (2026-11-09)
// each artefact page — Story Bank · Master CV · LinkedIn profile. An Artefacts
// link minted before the split stays live and shows all three.
// The member switches a page's link on from the page header; anyone with the
// link reads the page at /share/<token> as a document — a title, the author
// line, every section as a heading with its content under it — not as the app.
// Live, not a snapshot: the link reads the same documents the page does.
//
// Storage:
//   shareLinks/{token}          { uid, page, createdAt, revokedAt? }   server-only (lib/server/shares.ts)
//   users/{uid}/shares/{page}   { token, createdAt }                   owner reads it live; server writes it
//
// This module is the document model: `shareDocument()` turns the page's
// stored fields into blocks a renderer draws without knowing the schema —
// the same registry (`jhSectionsFor`), the same fields (`jhSectionFields`),
// the same workbook helpers the page's panels read. Contact details never
// enter the document: the author line carries the name, nothing else.
// Pure — no React. Tested.

import type { CareerOpsSetupV2, CompanyList, JhgBlock, RankedCompany, Snapshot } from "../careerops/types";
import { trueNorthText } from "../goal";
import type { Profile } from "../types";
import { companyTypeLabel, industryLine, listGroups, watchlistRows, type CompanyListKey } from "./company-lists";
import { LINKEDIN_SECTIONS, dateRange, linkedinPresent, roleLine, roleMeta } from "./linkedin-profile";
import { JH_LIST_OF, jhPagesFor, findJhPage, jhGoal, jhSectionsFor, type JhPageKey, type JhSectionDef, type JhSectionKey, type JhSignals } from "./sections";
import { proofPoints, provenanceLabel, snapshotDetail, snapshotFigures, storyRows, storyStar } from "./story-bank";
import {
  boundaryFacts, boundaryLists, companyFacts, cvRuleFacts, cvRuleLists, fitLabel, isoDate, languageLines, locationFacts, outlookLabel, salaryFacts, scoresLine,
  storyFact, storyFactFacts, top10Facts, top3Facts, type Fact, type FactList,
} from "./workbook";

// ---- the pages, the link ----

/** Every page a link can point at — the JobHacking pages, hub included (links minted before 2026-11-09). */
export type SharePageKey = Exclude<JhPageKey, "agents">;
/** The pages a member can switch a link on — the JobHacking pages with a header of their own; the Artefacts hub has none. */
export const SHARE_PAGES = jhPagesFor("jobhacking").filter((p) => !jhPagesFor("jobhacking").some((c) => c.parent === p.key)).map((p) => p.key) as readonly SharePageKey[];
export const isSharePage = (v: unknown): v is SharePageKey => typeof v === "string" && (SHARE_PAGES as readonly string[]).includes(v);

/** `shareLinks/{token}` — the public index, server-only. */
export interface ShareLink { uid: string; page: SharePageKey; createdAt: number; revokedAt?: number }
/** `users/{uid}/shares/{page}` — what the owner sees: the page is shared, since when, at which token. */
export interface ShareRecord { token: string; createdAt: number }

export const SHARE_BASE = "/share";
/** Tokens are 32 hex chars (a UUID without dashes) — anything else never reaches the database. */
export const isShareToken = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f]{32}$/.test(v);
export const shareHref = (token: string): string => `${SHARE_BASE}/${token}`;
/** The full link to copy — the origin the member is on, so staging shares staging. */
export const shareUrl = (origin: string, token: string): string => `${origin.replace(/\/$/, "")}${shareHref(token)}`;

/** "7 Nov 2026" — the author line's date, in the reader's own words, not ISO. */
export const shareDate = (ms: number): string => new Date(ms).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

// ---- the document ----

/** A document is a title, an author line, an optional opening paragraph and sections of blocks. */
export interface ShareDocument { page: SharePageKey; title: string; author: string; lead?: string; sections: ShareSection[] }
export interface ShareSection { key: JhSectionKey; title: string; blocks: ShareBlock[] }
export type ShareBlock =
  | { kind: "text"; label?: string; text: string }
  | { kind: "markdown"; text: string }
  | { kind: "facts"; label?: string; facts: Fact[] }
  | { kind: "list"; label?: string; items: string[] }
  | { kind: "entries"; label?: string; entries: ShareEntry[] };
/** One stacked item: a ranked company, a story, a role — a title, a quiet line, and what sits under it. */
export interface ShareEntry { index?: string; title: string; meta?: string; text?: string; facts?: Fact[]; tags?: string[]; url?: string; children?: ShareEntry[] }

const text = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
const list = (v: readonly (string | undefined | null)[] | null | undefined): string[] => (Array.isArray(v) ? v.map((x) => text(x)).filter(Boolean) : []);
const join = (parts: (string | undefined | null | false)[], sep = " · "): string => parts.map((p) => (p ? String(p).trim() : "")).filter(Boolean).join(sep);

const textBlock = (t: string | undefined | null, label?: string): ShareBlock | null => (text(t) ? { kind: "text", label, text: text(t) } : null);
const listBlock = (items: readonly (string | undefined)[] | null | undefined, label?: string): ShareBlock | null => (list(items).length ? { kind: "list", label, items: list(items) } : null);
const factsBlock = (facts: readonly Fact[], label?: string): ShareBlock | null => (facts.length ? { kind: "facts", label, facts: [...facts] } : null);
const entriesBlock = (entries: readonly ShareEntry[], label?: string): ShareBlock | null => (entries.length ? { kind: "entries", label, entries: [...entries] } : null);
const factListBlocks = (lists: readonly FactList[]): ShareBlock[] => lists.map((l) => ({ kind: "list", label: l.label, items: l.items }));
const blocks = (xs: (ShareBlock | null | undefined)[]): ShareBlock[] => xs.filter((b): b is ShareBlock => !!b);

/** The member's name for the author line — the account's, never the file's. */
export const shareAuthor = (profile: Profile | null | undefined): string => join([profile?.firstName, profile?.lastName], " ");

/** The sections a shared page carries: the JobHacking portal's own list, less Contact details. */
export const shareSections = (page: SharePageKey): readonly JhSectionDef[] => jhSectionsFor(page, { portal: "jobhacking" }).filter((s) => s.key !== "contact");

/**
 * The page as a document. A section with nothing in it is left out — a reader
 * sees what is there, never "Not set". Never includes contact details.
 */
export function shareDocument(page: SharePageKey, signals: JhSignals): ShareDocument {
  const meta = findJhPage(page)!;
  const goal = jhGoal(signals);
  const sections = shareSections(page)
    .map((s) => ({ key: s.key, title: s.title, blocks: sectionBlocks(s.key, signals) }))
    .filter((s) => s.blocks.length > 0);
  const lead = page === "true-north" && text(goal.role) ? trueNorthText(goal) : undefined;
  return { page, title: meta.title, author: shareAuthor(signals.profile), lead, sections };
}

/** True when the page has nothing to show — the owner's Share button stays hidden. */
export const shareEmpty = (page: SharePageKey, signals: JhSignals): boolean => shareDocument(page, signals).sections.length === 0;

function sectionBlocks(key: JhSectionKey, signals: JhSignals): ShareBlock[] {
  const { setup } = signals;
  const g = jhGoal(signals);
  const c = setup?.contact ?? {};
  const p = setup?.personalization ?? {};
  const policy = setup?.policy ?? {};
  const jhg = setup?.jhg;
  const tn = jhg?.trueNorth;
  switch (key) {
    // ---- Narrative ----
    case "headline":
      return blocks([textBlock(c.title), textBlock(setup?.narrative?.headline, "Positioning line")]);
    case "story":
      return blocks([textBlock(p.exitNarrative), textBlock(jhg?.narrative?.bridgeStoryOneLine, "In one line")]);
    case "competencies":
      return blocks([textBlock(p.crossCuttingAdvantage), listBlock(setup?.narrative?.superpowers, "Superpowers"), listBlock(jhg?.narrative?.leadSkills, "Lead skills")]);
    // ---- True North ----
    case "industry": {
      const industries = (tn?.industries ?? []).filter((i) => text(i.name));
      return blocks([
        textBlock(g.subsector),
        entriesBlock(industries.map((i) => ({
          title: i.name.trim(),
          children: (i.subSectors ?? []).filter((s) => text(s.name)).map((s) => ({ title: s.name.trim(), meta: join([outlookLabel(s.outlook), s.growthSignal]), url: text(s.source) || undefined })),
        })), "Industries researched"),
      ]);
    }
    case "roles": {
      const titles = tn?.titles;
      const clusters = (tn?.clusters ?? []).filter((x) => text(x.name));
      const postings = (tn?.postings ?? []).filter((x) => text(x.title));
      return blocks([
        textBlock(g.role),
        entriesBlock((p.targetRoles ?? []).filter((r) => text(r.archetype)).map((r) => ({ title: r.archetype.trim(), meta: text(r.axes) ? `Axes: ${r.axes!.trim()}` : undefined, text: text(r.buys) ? `They buy: ${r.buys!.trim()}` : undefined })), "Archetypes"),
        entriesBlock((p.adaptiveFraming ?? []).filter((r) => text(r.role)).map((r) => ({ title: r.role.trim(), text: text(r.emphasize) || undefined, meta: text(r.proof) ? `Proof: ${r.proof!.trim()}` : undefined })), "Framing per archetype"),
        listBlock(titles?.target, "Target titles"),
        listBlock(titles?.analog, "Analog titles — same job, another name"),
        listBlock(titles?.exclude, "Titles to exclude"),
        listBlock(tn?.keepers, "Keeper phrases — the words the postings use"),
        entriesBlock(clusters.map((x) => ({ title: x.name.trim(), tags: list([fitLabel(x.fit), x.level]), meta: list(x.titles).join(" · ") || undefined, text: join([list(x.axes).length ? `Axes: ${list(x.axes).join(", ")}` : "", text(x.buys) ? `They buy: ${x.buys!.trim()}` : ""], "\n") || undefined })), "Clusters"),
        entriesBlock(postings.map((x) => ({ title: x.title.trim(), meta: join([x.company, x.location, list(x.phrases).join(" · "), text(x.verified) ? `checked ${isoDate(x.verified)}` : ""]), url: text(x.url) || undefined })), "Postings read"),
      ]);
    }
    case "seniority":
      return blocks([textBlock(g.seniority)]);
    case "salary":
      return blocks([
        factsBlock(mergeFacts(facts([["Range", g.salary], ["Floor", policy.minimumSalary]]), salaryFacts(tn?.boundaries))),
        textBlock(p.compTargets, "How I talk about my number"),
        listBlock(p.negotiationScripts, "Negotiation scripts"),
        listBlock(tn?.boundaries?.negotiationLines, "Negotiation lines"),
      ]);
    case "location":
      return blocks([
        factsBlock(mergeFacts(facts([["Based in", g.city], ["Flexibility", policy.locationFlexibility]]), locationFacts(tn?.boundaries))),
        listBlock(p.locationPolicy, "Rules"),
      ]);
    case "company-type":
      return blocks([textBlock(g.companyType)]);
    case "boundaries": {
      const b = tn?.boundaries;
      return blocks([...factListBlocks(boundaryLists(b)), factsBlock(boundaryFacts(b))]);
    }
    // ---- Target companies ----
    case "top3": case "top10": case "top40":
      return rankedList(JH_LIST_OF[key], setup?.companyLists?.[JH_LIST_OF[key]], jhg);
    case "companies": {
      const rows = watchlistRows(setup?.portals?.companies, setup?.companyLists);
      return blocks([
        entriesBlock(rows.map((r) => ({ index: String(r.c.rank), title: r.c.name, meta: join([r.secondLine, companyTypeLabel(r.c.companyType)]), url: r.c.careersUrl })), "Careers pages watched"),
        listBlock(setup?.portals?.positive, "Titles to include"),
        listBlock(setup?.portals?.negative, "Titles to exclude"),
      ]);
    }
    // ---- Artefacts ----
    case "story-bank": {
      const source = setup;
      const points = proofPoints(source);
      const { stories, unlinked } = storyRows(source);
      return blocks([
        entriesBlock(points.map((x, i) => ({ index: String(i + 1), title: x.name, meta: text(x.heroMetric) || undefined, url: text(x.url) || undefined })), "Proof points"),
        entriesBlock(stories.map(({ story, snapshots }, i) => ({
          index: text(story.id) || String(i + 1), title: story.title, text: text(story.result) || undefined, tags: list([provenanceLabel(story.provenance)]),
          facts: [...storyStar(story).map((l) => ({ label: l.label, value: l.text })), ...storyFactFacts(storyFact(jhg, story))],
          children: snapshots.map(snapshotEntry),
        })), "Stories"),
        entriesBlock(unlinked.map(snapshotEntry), "Snapshots"),
      ]);
    }
    case "master-cv":
      return blocks([
        text(setup?.cvMarkdown) ? { kind: "markdown", text: setup!.cvMarkdown.trim() } : null,
        factsBlock(cvRuleFacts(jhg)),
        ...factListBlocks(cvRuleLists(jhg)),
        listBlock(languageLines(jhg), "Languages I'm learning"),
      ]);
    case "linkedin-profile": {
      const li = setup?.linkedin;
      if (!li) return [];
      const label = (k: keyof typeof li) => LINKEDIN_SECTIONS.find((s) => s.key === k)!.label;
      return blocks(linkedinPresent(li).map((s) => {
        switch (s.key) {
          case "headline": return textBlock(li.headline, label("headline"));
          case "about": return textBlock(li.about, label("about"));
          case "experience": return entriesBlock((li.experience ?? []).map((e) => ({ title: roleLine(e), meta: roleMeta(e) || undefined, text: text(e.description) || undefined, tags: list(e.skills) })), label("experience"));
          case "featured": return entriesBlock((li.featured ?? []).map((f) => ({ title: f.title, meta: f.kind ? f.kind.charAt(0).toUpperCase() + f.kind.slice(1) : undefined, url: text(f.url) || undefined })), label("featured"));
          case "skills": return listBlock(li.skills, label("skills"));
          case "education": return entriesBlock((li.education ?? []).map((e) => ({ title: e.school, meta: join([join([e.degree, e.field], ", "), dateRange(e.start, e.end, { presentWhenOpen: false })]) || undefined })), label("education"));
          case "certifications": return entriesBlock((li.certifications ?? []).map((x) => ({ title: x.name, meta: join([x.issuer, text(x.issued) ? `Issued ${dateRange(x.issued, undefined, { presentWhenOpen: false })}` : ""]) || undefined, url: text(x.url) || undefined })), label("certifications"));
        }
      }));
    }
    // Never in a document: the account's contact details, and the Compass-only sections.
    case "contact": case "work-rights": case "portfolio": case "accounts": case "notes":
      return [];
  }
}

const facts = (pairs: readonly [string, string | undefined][]): Fact[] => pairs.filter(([, v]) => text(v)).map(([label, v]) => ({ label, value: v!.trim() }));
/** The member's own values first; the workbook's only where the member has not set the same label. */
const mergeFacts = (own: readonly Fact[], file: readonly Fact[]): Fact[] => [...own, ...file.filter((f) => !own.some((o) => o.label === f.label))];

/** The trend group as a reader meets it the first time: the word, then what it means. */
const TREND_HEADING: Record<string, string> = { sunrise: "Sunrise — growing", sunset: "Sunset — shrinking or standing still", unclassified: "Not yet classified" };

/** A ranked list as one entries block per trend group, each row with the research the workbook wrote for that list. */
function rankedList(listKey: CompanyListKey, cl: CompanyList | null | undefined, jhg: JhgBlock | null | undefined): ShareBlock[] {
  const FACTS: Record<CompanyListKey, (c: RankedCompany, j: JhgBlock | null | undefined) => Fact[]> = { top3: top3Facts, top10: top10Facts, all: companyFacts };
  const groups = listGroups(cl);
  const out = blocks(groups.map((g) => entriesBlock(g.companies.map((c) => ({
    index: c.rank !== undefined ? String(c.rank) : undefined, title: c.name,
    meta: join([industryLine(c), companyTypeLabel(c.companyType), scoresLine(c.scores)]) || undefined,
    facts: FACTS[listKey](c, jhg), url: text(c.careersUrl) || undefined,
  })), TREND_HEADING[g.key] ?? g.label)));
  if (listKey === "all") {
    const extra = (jhg?.targetCompanies?.extraSubSectors ?? []).filter((x) => text(x.name));
    const challenges = (jhg?.targetCompanies?.challenges ?? []).filter((x) => text(x.company));
    out.push(...blocks([
      entriesBlock(extra.map((x) => ({ title: x.name.trim(), tags: list([outlookLabel(x.outlook)]), meta: join([x.industry, x.growthSignal]) || undefined, url: text(x.source) || undefined })), "Other sub-sectors looked at"),
      entriesBlock(challenges.map((x) => ({ title: x.company.trim(), meta: text(x.challenge) || undefined, text: text(x.resolution) || undefined })), "Challenged by the coach"),
    ]));
  }
  return out;
}

function snapshotEntry(s: Snapshot): ShareEntry {
  return {
    title: s.company, meta: join([text(s.title), snapshotFigures(s)]) || undefined,
    facts: snapshotDetail(s).map((d) => ({ label: d.label, value: d.text ?? d.items!.join("\n") })),
  };
}
