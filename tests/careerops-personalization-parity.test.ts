import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  SECTIONS,
  coercePersonalization,
  renderSection,
  type Personalization,
  type SectionId,
} from "@/lib/careerops/personalization";

// lib/careerops/personalization.ts is a deliberate port of career-ops'
// web/src/lib/personalization.mjs. If the two drift, a report produced from
// Compass stops reasoning about the member the way the CLI does — silently,
// because both sides still "work".
//
// So when a career-ops checkout is on this machine, run BOTH implementations
// over the same inputs and require identical output. Point CAREER_OPS_REPO at
// the checkout, or keep it beside this one. Skipped when absent, so CI without
// the sibling repo is unaffected.

const CANDIDATES = [
  process.env.CAREER_OPS_REPO,
  path.resolve(__dirname, "../../career-ops"),
  path.resolve(__dirname, "../../../career-ops"),
].filter(Boolean) as string[];

const upstreamPath = CANDIDATES
  .map((root) => path.join(root, "web/src/lib/personalization.mjs"))
  .find((p) => existsSync(p));

type Upstream = {
  SECTIONS: { id: string; heading: string }[];
  coercePersonalization: (raw: unknown) => Record<string, unknown>;
  renderSection: (id: string, value: unknown) => string;
};

// The checkout lives outside this project's Vite root, so it cannot be
// imported by path. The upstream module is deliberately self-contained (its own
// comment: "must stay free of node:fs"), so load it from source as a data-URL
// module instead — no bundler config, no fs allow-list.
let cached: Promise<Upstream> | null = null;
const load = (): Promise<Upstream> => {
  if (!cached) {
    const src = readFileSync(upstreamPath!, "utf8");
    if (/^\s*import\s/m.test(src)) throw new Error(`${upstreamPath} gained imports — this loader can no longer evaluate it standalone`);
    cached = import(/* @vite-ignore */ `data:text/javascript,${encodeURIComponent(src)}`) as Promise<Upstream>;
  }
  return cached;
};

// Inputs chosen to hit every branch: caps, junk rows, pipes, quotes, bad URLs.
const CASES: { name: string; raw: unknown }[] = [
  { name: "a fully filled profile", raw: {
    targetRoles: [
      { archetype: "AI Platform / LLMOps", axes: "Evaluation, observability", buys: "Production AI with metrics" },
      { archetype: "Technical AI PM", axes: "GenAI, PRDs", buys: "Business to AI product" },
    ],
    adaptiveFraming: [
      { role: "Platform / LLMOps", emphasize: "Production systems, evals", proof: "cv.md section 3" },
      { role: "Agentic", emphasize: "Multi-agent, HITL" },
    ],
    exitNarrative: "Built and sold a SaaS.   Now applied AI at scale.",
    crossCuttingAdvantage: "Technical builder with real-world proof.",
    portfolio: { url: "https://jane.dev/demo", description: "Agent dashboard", whenToShare: "LLMOps roles" },
    compTargets: "NZ$180-220k base.",
    negotiationScripts: ['"I am targeting 200k."', "Output-based, not location-based."],
    locationPolicy: ["Auckland or remote", "No relocation outside NZ"],
  } },
  { name: "junk and empties", raw: { targetRoles: [{ axes: "orphan" }, null, 7], adaptiveFraming: [{ role: "PO" }], exitNarrative: "   ", portfolio: { url: "jane.dev" }, negotiationScripts: "nope", locationPolicy: [] } },
  { name: "over the caps", raw: {
    targetRoles: Array.from({ length: 12 }, (_, i) => ({ archetype: `A${i}`, axes: "x".repeat(400), buys: "y".repeat(400) })),
    adaptiveFraming: Array.from({ length: 12 }, (_, i) => ({ role: `R${i}`, emphasize: "e".repeat(400), proof: "p".repeat(400) })),
    exitNarrative: "x".repeat(3000), crossCuttingAdvantage: "y".repeat(3000), compTargets: "z".repeat(3000),
    negotiationScripts: Array(20).fill("s".repeat(500)), locationPolicy: Array(20).fill("l"),
  } },
  { name: "pipes and headings that could break the file", raw: {
    targetRoles: [{ archetype: "A | B", axes: "x|y|z", buys: "|" }],
    adaptiveFraming: [{ role: "R|1", emphasize: "e|2", proof: "p|3" }],
    exitNarrative: "## Sneaky heading\nbody",
    compTargets: "###### deep",
    crossCuttingAdvantage: "#### four",
  } },
  { name: "nothing at all", raw: {} },
  { name: "not an object", raw: "nope" },
];

const d = upstreamPath ? describe : describe.skip;

d(`personalization parity with career-ops${upstreamPath ? "" : " (skipped — no checkout found)"}`, () => {
  it("agrees on the section ids and headings", async () => {
    const up = await load();
    expect(SECTIONS.map((s) => s.id)).toEqual(up.SECTIONS.map((s) => s.id));
    expect(SECTIONS.map((s) => s.heading)).toEqual(up.SECTIONS.map((s) => s.heading));
  });

  it.each(CASES)("coerces $name identically", async ({ raw }) => {
    const up = await load();
    // toEqual ignores undefined-valued keys, which is the one shape difference
    // we allow: upstream leaves `axes: undefined` on a row, we omit the key.
    expect(coercePersonalization(raw)).toEqual(up.coercePersonalization(raw));
  });

  it.each(CASES)("renders every section of $name identically", async ({ raw }) => {
    const up = await load();
    const mine = coercePersonalization(raw) as Personalization;
    const theirs = up.coercePersonalization(raw);
    for (const { id } of SECTIONS) {
      const a = mine[id as SectionId];
      const b = theirs[id];
      // Same sections present…
      expect(a === undefined).toBe(b === undefined || b === null);
      if (a === undefined) continue;
      // …and the same bytes for each one.
      expect(renderSection(id as SectionId, a)).toBe(up.renderSection(id, b));
    }
  });

  it("renders a missing framing proof the same way (both default to cv.md)", async () => {
    const up = await load();
    const raw = { adaptiveFraming: [{ role: "PO", emphasize: "discovery" }] };
    const mine = coercePersonalization(raw).adaptiveFraming!;
    const theirs = up.coercePersonalization(raw).adaptiveFraming;
    expect(renderSection("adaptiveFraming", mine)).toBe(up.renderSection("adaptiveFraming", theirs));
    expect(renderSection("adaptiveFraming", mine)).toContain("cv.md");
  });
});
