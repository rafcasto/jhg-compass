// Coach 3's rubric — Part B, the fit scores (docs/UX_COACH_AGENTIC.md §10) — on the shared core in rubrics.ts.
// The 40 are already stored (Part A); the matrix scores them all at once; the stored shape is the one
// rankCompanies already ranks (companies[].scores + rank), so the page's Top 40 is the result. Pure — tested.

import type { JhgCompany } from "../../careerops/types";
import { RUBRICS, commonFlags, rankRows, scoredTable, topCut, valueOf, type MatrixFlag, type MatrixRow, type ScoredRow } from "./rubrics";

export const COMPANIES_RUBRIC = RUBRICS.companies;

const lower = (s: string) => s.trim().toLowerCase();

/** The companies the matrix may show: the stored 40 (or the names the coach passed, each one of them). */
export function matrixCompanies(stored: readonly JhgCompany[], names?: readonly string[] | null): { ok: true; companies: JhgCompany[] } | { ok: false; error: string } {
  const named = stored.filter((c) => c.name?.trim());
  if (!names?.length) return named.length ? { ok: true, companies: named } : { ok: false, error: "no companies are stored yet — write Part A first" };
  const out: JhgCompany[] = [];
  for (const n of names) {
    const c = named.find((x) => lower(x.name) === lower(n));
    if (!c) return { ok: false, error: `"${n}" is not one of the stored companies — write it with Part A first` };
    if (!out.includes(c)) out.push(c);
  }
  return { ok: true, companies: out };
}

/** The mute line under a company's name in the matrix: sub-sector · growth signal · who they know. */
export const companyMeta = (c: JhgCompany): string => [c.subSector, c.growthSignal, c.knownContact ? `knows ${c.knownContact}` : ""].map((s) => s?.trim() ?? "").filter(Boolean).join(" · ");

/** The stored list with the matrix's numbers laid on the companies it named; the rest keep what they had. rankCompanies ranks the whole on the way in. */
export function applyCompanyScores(stored: readonly JhgCompany[], rows: readonly MatrixRow[]): JhgCompany[] {
  const by = new Map(rows.map((r) => [lower(r.item), r.values]));
  return stored.map((c) => {
    const v = by.get(lower(c.name));
    return v ? { ...c, scores: { growth: v[0], interest: v[1], access: v[2], proof: v[3], total: v.reduce((n, x) => n + x, 0) } } : c;
  });
}

/** The ranked rows the coach and the transcript read, from the stored companies that carry all four numbers. */
export function companyRows(companies: readonly JhgCompany[]): ScoredRow[] {
  const rows = companies.filter((c) => c.scores && [c.scores.growth, c.scores.interest, c.scores.access, c.scores.proof].every((n) => typeof n === "number"))
    .map((c) => ({ item: c.name, values: [c.scores!.growth!, c.scores!.interest!, c.scores!.access!, c.scores!.proof!] }));
  return rankRows(rows, COMPANIES_RUBRIC);
}

/** What Coach 3 challenges (the prompt's own four, where the numbers can tell) plus the shared flags. */
export function companyFlags(companies: readonly JhgCompany[]): MatrixFlag[] {
  const r = COMPANIES_RUBRIC;
  const rows = companyRows(companies);
  const out = commonFlags(rows, r, "Ask which ten they would drop first and rescore those.", "Ask for the three they would call tomorrow.");
  const find = (name: string) => companies.find((c) => lower(c.name) === lower(name));
  const dreams = rows.filter((s) => valueOf(s, r, "interest") === 5 && valueOf(s, r, "access") <= 2 && valueOf(s, r, "proof") <= 2).map((s) => s.item);
  if (dreams.length) out.push({ id: "dream", line: `Interest 5 with Access and Proof at 1–2 — a dream, not a target: ${dreams.join(", ")}. Ask what would make it a target.`, items: dreams });
  const noRoute = rows.filter((s) => valueOf(s, r, "access") === 5 && !find(s.item)?.knownContact?.trim()).map((s) => s.item);
  if (noRoute.length) out.push({ id: "access_no_route", line: `Access 5 with no one named: ${noRoute.join(", ")}. Ask for the route — a person, a community, a posting, an event — or the 5 comes down.`, items: noRoute });
  const noSource = rows.filter((s) => valueOf(s, r, "growth") === 5 && !find(s.item)?.growthSource?.trim()).map((s) => s.item);
  if (noSource.length) out.push({ id: "growth_no_source", line: `Growth 5 with no source on file: ${noSource.join(", ")}. Name the signal and where it was read, or the 5 comes down.`, items: noSource });
  const proofFive = topCut(rows, r.cut).filter((s) => valueOf(s, r, "proof") === 5).map((s) => s.item);
  if (proofFive.length) out.push({ id: "proof_five", line: `Proof 5 in the top ${r.cut}: ${proofFive.join(", ")}. Ask which competency solves which visible problem there — one sentence each.`, items: proofFive });
  return [...out.filter((f) => f.id !== "tie_at_cut"), ...out.filter((f) => f.id === "tie_at_cut")];
}

/** The member's scores as the coach reads them — the ranked 40 plus the flags; totals and ranks are the portal's. */
export function companyScoresMessage(companies: readonly JhgCompany[], flags: readonly MatrixFlag[] = companyFlags(companies)): string {
  const r = COMPANIES_RUBRIC;
  const rows = companyRows(companies);
  const lines = [
    `I scored my ${rows.length} companies in the matrix. Totals and ranks are the portal's (total = Growth + Interest + Access + Proof; ties: Interest, then Proof). Stored on the page as jhg.targetCompanies.companies[].scores and rank — do not write them again.`,
    "", scoredTable(rows, r), "",
    `Ranks 1–${r.cut}: ${topCut(rows, r.cut).map((s) => s.item).join(", ")}.`,
  ];
  if (flags.length) lines.push("", "The portal's flags — challenge these one company at a time and record each in challenges[]:", ...flags.map((f) => `- ${f.line}`));
  else lines.push("", "No flags from the portal: the scores separate and the fives are backed. Confirm the ranking and go to Part C.");
  return lines.join("\n");
}
