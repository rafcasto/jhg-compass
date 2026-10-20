// The eight `## Your …` sections of career-ops' modes/_profile.md — the file
// evaluations actually score against.
//
// This is a deliberate, close port of career-ops' own
// web/src/lib/personalization.mjs (career-ops-hq/career-ops): same section ids,
// same headings, same order, same validation caps, same rendered shapes. Keep
// it that way. The point of the file is that a report produced from Compass and
// a report produced from the CLI reason about the member identically, and the
// moment a heading or a column drifts, the agents read a different document.
//
// Upstream states the cost of leaving it unfilled plainly: without these
// sections, "evaluations score against the template author's targeting, not
// yours". Compass collected none of them until now.
//
// Pure — no React, no Firebase. Tested.

/** The eight template sections, in template order. `id` is the storage key. */
export const SECTIONS = [
  { id: "targetRoles", heading: "## Your Target Roles" },
  { id: "adaptiveFraming", heading: "## Your Adaptive Framing" },
  { id: "exitNarrative", heading: "## Your Exit Narrative" },
  { id: "crossCuttingAdvantage", heading: "## Your Cross-cutting Advantage" },
  { id: "portfolio", heading: "## Your Portfolio / Demo" },
  { id: "compTargets", heading: "## Your Comp Targets" },
  { id: "negotiationScripts", heading: "## Your Negotiation Scripts" },
  { id: "locationPolicy", heading: "## Your Location Policy" },
] as const satisfies readonly { id: string; heading: string }[];

export type SectionId = (typeof SECTIONS)[number]["id"];

/** Member-facing labels and the question each section is really asking. */
export const SECTION_COPY: Record<SectionId, { label: string; ask: string }> = {
  targetRoles: { label: "Target roles", ask: "The role archetypes you're going after, what each one is really about, and what a company is buying when they hire for it." },
  adaptiveFraming: { label: "Adaptive framing", ask: "For each archetype: what to emphasise about you, and which part of your CV proves it." },
  exitNarrative: { label: "Exit narrative", ask: "Why you're leaving and where you're heading. This frames every summary, cover letter and STAR answer." },
  crossCuttingAdvantage: { label: "Cross-cutting advantage", ask: "Your signature move — the thing you do that the other candidates can't." },
  portfolio: { label: "Portfolio / demo", ask: "A live demo, dashboard or public project, and when it's worth sharing." },
  compTargets: { label: "Comp targets", ask: "What the market pays for your target roles, and how you frame your own number." },
  negotiationScripts: { label: "Negotiation scripts", ask: "What you actually say when the offer comes in low, or they push a location discount." },
  locationPolicy: { label: "Location policy", ask: "Where you'll work, what you'll travel, and what's a hard no." },
};

export interface TargetRoleRow { archetype: string; axes?: string; buys?: string }
export interface FramingRow { role: string; emphasize: string; proof?: string }
export interface PortfolioValue { url: string; description?: string; whenToShare?: string }

export interface Personalization {
  targetRoles?: TargetRoleRow[];
  adaptiveFraming?: FramingRow[];
  exitNarrative?: string;
  crossCuttingAdvantage?: string;
  portfolio?: PortfolioValue;
  compTargets?: string;
  negotiationScripts?: string[];
  locationPolicy?: string[];
}

// ---- validation (mirrors upstream coercePersonalization) ----

const str = (v: unknown, max = 600): string | undefined =>
  typeof v === "string" && v.trim() ? v.trim().replace(/\s+/g, " ").slice(0, max) : undefined;

const strList = (v: unknown, max = 8): string[] | undefined =>
  Array.isArray(v) ? (v.map((x) => str(x, 300)).filter(Boolean) as string[]).slice(0, max) : undefined;

// Markdown table cells cannot contain a pipe or a newline; scrub rather than reject.
const cell = (v: unknown): string => (str(v, 200) ?? "").replace(/\|/g, "/");

/**
 * Keep only well-formed fields (house style: no zod). Unknown keys are dropped,
 * junk rows are dropped, and an empty result means "nothing to write".
 */
export function coercePersonalization(raw: unknown): Personalization {
  if (!raw || typeof raw !== "object") return {};
  const r = raw as Record<string, unknown>;
  const out: Personalization = {};

  // Rows are built one at a time rather than mapped-then-filtered so the
  // optional cells stay genuinely optional (an absent `axes` must not become
  // the string "undefined" in the rendered table).
  if (Array.isArray(r.targetRoles)) {
    const rows: TargetRoleRow[] = [];
    for (const x of r.targetRoles) {
      if (rows.length === 8) break;
      if (!x || typeof x !== "object") continue;
      const src = x as Partial<TargetRoleRow>;
      const archetype = str(src.archetype, 80);
      if (!archetype) continue;             // a row with no archetype says nothing
      const row: TargetRoleRow = { archetype };
      const axes = str(src.axes, 200);
      if (axes) row.axes = axes;
      const buys = str(src.buys, 200);
      if (buys) row.buys = buys;
      rows.push(row);
    }
    if (rows.length) out.targetRoles = rows;
  }

  if (Array.isArray(r.adaptiveFraming)) {
    const rows: FramingRow[] = [];
    for (const x of r.adaptiveFraming) {
      if (rows.length === 8) break;
      if (!x || typeof x !== "object") continue;
      const src = x as Partial<FramingRow>;
      const role = str(src.role, 80);
      const emphasize = str(src.emphasize, 200);
      if (!role || !emphasize) continue;    // both halves or the row is useless
      const row: FramingRow = { role, emphasize };
      const proof = str(src.proof, 160);
      if (proof) row.proof = proof;
      rows.push(row);
    }
    if (rows.length) out.adaptiveFraming = rows;
  }

  const exit = str(r.exitNarrative, 1200);
  if (exit) out.exitNarrative = exit;

  const cross = str(r.crossCuttingAdvantage, 600);
  if (cross) out.crossCuttingAdvantage = cross;

  if (r.portfolio && typeof r.portfolio === "object") {
    const p = r.portfolio as PortfolioValue;
    const url = str(p.url, 300);
    // A portfolio the agents can't open is worse than none: reject anything
    // that isn't an absolute http(s) URL rather than putting it in the file.
    if (url && /^https?:\/\//i.test(url)) {
      out.portfolio = { url, description: str(p.description, 300), whenToShare: str(p.whenToShare, 200) };
    }
  }

  const comp = str(r.compTargets, 800);
  if (comp) out.compTargets = comp;

  const scripts = strList(r.negotiationScripts, 6);
  if (scripts?.length) out.negotiationScripts = scripts;

  const loc = strList(r.locationPolicy, 8);
  if (loc?.length) out.locationPolicy = loc;

  return out;
}

// ---- rendering (mirrors upstream renderSection) ----

/** One section body, without its heading. */
export function renderSection(id: SectionId, value: NonNullable<Personalization[SectionId]>): string {
  switch (id) {
    case "targetRoles":
      return [
        "| Archetype | Thematic axes | What they buy |",
        "|-----------|---------------|---------------|",
        ...(value as TargetRoleRow[]).map((r) => `| **${cell(r.archetype)}** | ${cell(r.axes)} | ${cell(r.buys)} |`),
      ].join("\n");
    case "adaptiveFraming":
      return [
        "| If the role is... | Emphasize about you... | Proof point sources |",
        "|-------------------|------------------------|---------------------|",
        ...(value as FramingRow[]).map((r) => `| ${cell(r.role)} | ${cell(r.emphasize)} | ${cell(r.proof) || "cv.md"} |`),
      ].join("\n");
    case "exitNarrative":
    case "crossCuttingAdvantage":
    case "compTargets":
      // Prose passthrough — but never let a body open with its own `## `: the
      // file is addressed by heading, so that would silently start a new
      // section instead of filling this one.
      return String(value).replace(/^\s*#{1,6}\s+/, "");
    case "portfolio": {
      const p = value as PortfolioValue;
      return [
        `- url: ${p.url}`,
        p.description ? `- what: ${p.description}` : null,
        p.whenToShare ? `- when_to_share: ${p.whenToShare}` : null,
      ].filter(Boolean).join("\n");
    }
    case "negotiationScripts":
      return (value as string[]).map((s) => `> "${s.replace(/^["“]|["”]$/g, "")}"`).join("\n\n");
    case "locationPolicy":
      return (value as string[]).map((l) => `- ${l}`).join("\n");
    default:
      return "";
  }
}

export type SectionState = "filled" | "missing";

export interface SectionStatus { id: SectionId; heading: string; label: string; ask: string; state: SectionState }

/** Per-section progress, for the checklist. */
export function personalizationSections(p: Personalization | null | undefined): SectionStatus[] {
  const clean = coercePersonalization(p ?? {});
  return SECTIONS.map(({ id, heading }) => ({
    id,
    heading,
    label: SECTION_COPY[id].label,
    ask: SECTION_COPY[id].ask,
    state: clean[id] === undefined ? "missing" : "filled",
  }));
}

export const personalizationProgress = (p: Personalization | null | undefined) => {
  const sections = personalizationSections(p);
  const done = sections.filter((s) => s.state === "filled").length;
  return { done, total: sections.length, pct: Math.round((done / sections.length) * 100) };
};

/**
 * The whole modes/_profile.md. Every section the template ships is written in
 * template order; a section the member hasn't filled keeps its heading with an
 * explicit placeholder, so the agents can see it is unanswered rather than
 * inheriting the upstream template author's targeting.
 */
export function renderProfileMd(p: Personalization | null | undefined): string {
  const clean = coercePersonalization(p ?? {});
  const out: string[] = [
    "# User Profile Context -- career-ops",
    "",
    "<!-- Generated by JobHacker Compass from your CareerOps personalization.",
    "     Edit it there; this file follows. Sections marked NOT SET have not been",
    "     answered yet — treat them as unknown, never as a default. -->",
    "",
  ];
  for (const { id, heading } of SECTIONS) {
    const value = clean[id];
    out.push(heading, "");
    out.push(value === undefined ? "_NOT SET — ask the candidate before relying on this._" : renderSection(id, value));
    out.push("");
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}
