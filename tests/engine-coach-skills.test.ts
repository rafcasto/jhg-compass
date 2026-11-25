import { describe, it, expect } from "vitest";
import { RUBRICS, RUBRIC_KINDS, cleanItems, coachRubrics, commonFlags, parseRows, rankRows, scoredRecap, scoredTable, topCut } from "@/lib/engine/coach/rubrics";
import { SKILL_AXES, TOP_CUT, scoreSkills, scoresMessage, skillFlags, skillRow } from "@/lib/engine/coach/skills";
import { applyCompanyScores, companyFlags, companyMeta, companyRows, companyScoresMessage, matrixCompanies } from "@/lib/engine/coach/companies";
import { applyEvent, emptyPending, pendingMatrixOf, type TranscriptTurn } from "@/lib/engine/coach/transcript";
import { SCORE_MATRIX, coachTools, scoreMatrixTool } from "@/lib/engine/coach/tools";
import { coachChecks, rankCompanies } from "@/lib/engine/coach/checks";
import { recapOf } from "@/lib/engine/coach/turn";
import { COACH_PROMPTS } from "@/lib/engine/coach/prompts";
import type { JhgCompany } from "@/lib/careerops/types";

// The scoring rubrics in code (docs/UX_COACH_AGENTIC.md §9–§10): four axes with five anchors each, the same for every
// member; totals, ranks, the tie-break, the cut and the flags are the portal's — the model only converses.

const row = (item: string, ...values: number[]) => ({ item, values });
const S = RUBRICS.skills, C = RUBRICS.companies;

describe("the registry", () => {
  it("has two rubrics — skills for Coach 1, companies for Coach 3 — each four axes with five anchors", () => {
    expect(RUBRIC_KINDS).toEqual(["skills", "companies"]);
    for (const r of Object.values(RUBRICS)) { expect(r.axes).toHaveLength(4); for (const a of r.axes) expect(a.anchors).toHaveLength(5); for (const k of r.tieBreak) expect(r.axes.map((a) => a.key)).toContain(k); }
    expect(SKILL_AXES.map((a) => a.key)).toEqual(["good", "love", "proof", "pays"]);
    expect(SKILL_AXES[2].anchors[1]).toBe("No result in 10 seconds"); // the one anchor the source prompt had, kept
    expect(C.axes.map((a) => a.key)).toEqual(["growth", "interest", "access", "proof"]);
    expect(C.tieBreak).toEqual(["interest", "proof"]); // the prompt's rule, and rankCompanies'
    expect(C.cut).toBe(10);
    expect(coachRubrics("narrative").map((r) => r.kind)).toEqual(["skills"]);
    expect(coachRubrics("targetCompanies").map((r) => r.kind)).toEqual(["companies"]);
    expect(coachRubrics("linkedin")).toEqual([]);
  });

  it("cleans the coach's list: trimmed, de-duplicated, within the rubric's bounds", () => {
    expect(cleanItems(["Python ", "python", "SQL", "Negotiation"], S)).toEqual({ ok: true, items: ["Python", "SQL", "Negotiation"] });
    expect(cleanItems(["a", "b"], S).ok).toBe(false);
    expect(cleanItems(Array.from({ length: S.max + 1 }, (_, i) => `s${i}`), S).ok).toBe(false);
    expect(cleanItems(Array.from({ length: 40 }, (_, i) => `c${i}`), C).ok).toBe(true);
    expect(cleanItems("x", S).ok).toBe(false);
  });

  it("takes the member's rows only against the matrix they saw, complete and 1–5, in the matrix's order", () => {
    const items = ["Python", "SQL", "Negotiation"];
    const ok = parseRows([row("sql", 3, 4, 5, 4), row("Python", 5, 5, 5, 5), row("Negotiation", 2, 2, 2, 2)], items, S);
    expect(ok.ok && ok.rows.map((s) => s.item)).toEqual(["Python", "SQL", "Negotiation"]);
    expect(parseRows([row("Python", 5, 5, 5, 5)], items, S)).toEqual({ ok: false, error: "Not scored yet: SQL, Negotiation" });
    expect(parseRows([row("Excel", 5, 5, 5, 5)], items, S).ok).toBe(false);
    expect(parseRows([row("Python", 6, 5, 5, 5), row("SQL", 3, 4, 5, 4), row("Negotiation", 2, 2, 2, 2)], items, S).ok).toBe(false);
    expect(parseRows([row("Python", 5, 5, 5), row("SQL", 3, 4, 5, 4), row("Negotiation", 2, 2, 2, 2)], items, S).ok).toBe(false);
    expect(parseRows([{ item: "Python", values: [1.5, 5, 5, 5] }, row("SQL", 3, 4, 5, 4), row("Negotiation", 2, 2, 2, 2)], items, S).ok).toBe(false);
  });

  it("sums, ranks by total then the rubric's tie-break then order, and is deterministic", () => {
    const scored = rankRows([row("A", 4, 4, 2, 4), row("B", 4, 4, 4, 2), row("C", 5, 5, 5, 5), row("D", 4, 4, 4, 2), row("E", 3, 5, 4, 2)], S);
    expect(scored.map((s) => s.total)).toEqual([14, 14, 20, 14, 14]);
    // A loses on proof; B, D, E tie on proof and pays, E wins on love; B before D by the matrix's order.
    expect(scored.map((s) => `${s.item}${s.rank}`)).toEqual(["A5", "B3", "C1", "D4", "E2"]);
    expect(topCut(scored, 2).map((s) => s.item)).toEqual(["C", "E"]);
    // Companies break ties on interest, then proof — the same order rankCompanies uses.
    const cs = rankRows([row("x", 3, 5, 3, 3), row("y", 3, 3, 5, 3), row("z", 3, 4, 4, 3)], C);
    expect(cs.map((s) => `${s.item}${s.rank}`)).toEqual(["x1", "y3", "z2"]);
    const input = [row("x", 3, 3, 3, 3), row("y", 3, 3, 3, 3), row("z", 2, 2, 2, 2)];
    expect(rankRows(input, S)).toEqual(rankRows([...input], S));
    expect(rankRows(input, S).map((s) => s.rank)).toEqual([1, 2, 3]);
    expect(scoredTable(cs, C)).toContain("| # | Company | Signal | Fit | Access | Skills | Total |");
    expect(scoredRecap(cs, C)).toBe("Scored 3 companies — ranked: x 14, z 14, y 14");
  });

  it("flags a scale that does not separate, flat totals, and a tie at the cut — for any rubric", () => {
    const fifteen = (f: (i: number) => ReturnType<typeof row>) => rankRows(Array.from({ length: 15 }, (_, i) => f(i)), S);
    expect(commonFlags(fifteen((i) => row(`s${i}`, 5, 5, 5, i % 2 ? 5 : 4)), S, "drop", "keep").map((f) => f.id)).toContain("inflated");
    expect(commonFlags(fifteen((i) => row(`s${i}`, 3, 3, 3, i % 2 ? 3 : 2)), S, "drop", "keep").map((f) => f.id)).toContain("flat");
    expect(commonFlags(fifteen((i) => row(`s${i}`, 3, 3, 3, i % 2 ? 3 : 2)), S, "drop", "keep").map((f) => f.id)).not.toContain("inflated");
    expect(commonFlags(fifteen((i) => row(`s${i}`, 5 - (i % 5), 3, 2, 1)), S, "drop", "keep").find((f) => f.id === "flat")).toBeUndefined();
    const tie = rankRows([...Array.from({ length: 5 }, (_, i) => row(`top${i}`, 5, 5, 5, 5)), row("Six", 3, 3, 3, 3), row("Seven", 3, 3, 3, 3), row("Eight", 1, 1, 1, 1)], S);
    expect(commonFlags(tie, S, "", "").find((f) => f.id === "tie_at_cut")?.items).toEqual(["Six", "Seven"]);
  });
});

describe("the skills rubric", () => {
  it("stores one flat row a skill with the portal's total and rank", () => {
    const scored = scoreSkills([row("Python", 5, 5, 5, 5), row("SQL", 3, 4, 5, 4)]);
    expect(scored[0]).toEqual({ skill: "Python", good: 5, love: 5, proof: 5, pays: 5, total: 20, rank: 1 });
    expect(skillRow(scored[1])).toEqual({ item: "SQL", values: [3, 4, 5, 4], total: 16, rank: 2 });
    expect(TOP_CUT).toBe(6);
  });

  it("raises nothing on a table that separates and proves its top six", () => {
    const scored = scoreSkills([
      row("a", 5, 4, 5, 4), row("b", 4, 4, 5, 4), row("c", 4, 4, 4, 4), row("d", 4, 3, 4, 4), row("e", 3, 3, 4, 4), row("f", 3, 3, 4, 3),
      row("g", 3, 3, 3, 3), row("h", 3, 3, 2, 3), row("i", 2, 3, 2, 3), row("j", 2, 2, 2, 3), row("k", 2, 2, 2, 2), row("l", 2, 2, 1, 2), row("m", 1, 2, 1, 2), row("n", 1, 1, 1, 2), row("o", 1, 1, 1, 1),
    ]);
    expect(skillFlags(scored)).toEqual([]);
  });

  it("names unproven top-six skills, passions and dislikes", () => {
    const unproven = skillFlags(scoreSkills([row("Lead", 5, 5, 1, 5), ...Array.from({ length: 5 }, (_, i) => row(`p${i}`, 4, 4, 5, 4)), row("x", 1, 1, 1, 1), row("y", 1, 1, 2, 1)]));
    expect(unproven.find((f) => f.id === "unproven")?.items).toEqual(["Lead"]); // x and y are unproven too, but below the cut
    expect(skillFlags(scoreSkills([row("Painting", 3, 5, 3, 1), row("b", 3, 3, 3, 3), row("c", 3, 3, 3, 3)])).find((f) => f.id === "loved_not_paid")?.items).toEqual(["Painting"]);
    expect(skillFlags(scoreSkills([row("Compliance", 5, 1, 5, 5), row("b", 3, 3, 3, 3), row("c", 3, 3, 3, 3)])).find((f) => f.id === "paid_not_loved")?.items).toEqual(["Compliance"]);
  });

  it("writes the coach's message: a ranked table, the top six, the flags, and that the portal stored it", () => {
    const scored = scoreSkills([row("Python", 5, 5, 5, 5), row("SQL", 3, 4, 5, 4), row("Negotiation", 3, 3, 3, 3)]);
    const m = scoresMessage(scored);
    expect(m).toContain("| 1 | Python | 5 | 5 | 5 | 5 | **20** |");
    expect(m).toContain("Top 6 for the playoff: Python, SQL, Negotiation.");
    expect(m).toContain("do not write them again");
    expect(m).toContain("No flags from the portal");
    const flagged = scoresMessage(scoreSkills([row("Python", 5, 5, 5, 5), row("SQL", 3, 4, 5, 4), row("Negotiation", 2, 2, 2, 2)]));
    expect(flagged).toContain("The portal's flags — push back on these before the playoff:");
    expect(flagged).toContain("In the top 6 with Prove ≤ 2: Negotiation.");
  });

  it("N7: once scored, the lead skills are three of the top six, as spelled", () => {
    const base = {
      version: 1, contact: { phone: "1" }, personalization: { exitNarrative: "From ops to product." },
      narrative: { headline: "I help teams ship", superpowers: ["a", "b", "c"] },
      jhg: { identity: { fullName: "Ana", email: "a@x.io", city: "W", country: "NZ", timezone: "Pacific/Auckland", preferredChannel: "email" }, narrative: { leadSkills: ["Python", "SQL", "Negotiation"], bridgeStoryOneLine: "x" } },
    };
    const n7 = (p: typeof base) => coachChecks("narrative", p).find((c) => c.id === "N7")!;
    expect(n7(base).pass).toBe(true); // no matrix scored — nothing to check against
    const scored = scoreSkills([row("Python", 5, 5, 5, 5), row("SQL", 4, 4, 4, 4), row("Excel", 4, 4, 4, 3), row("Writing", 3, 3, 3, 3), row("Figma", 3, 3, 3, 2), row("Coaching", 3, 3, 2, 2), row("Negotiation", 1, 1, 1, 1)]);
    const withScores = { ...base, jhg: { ...base.jhg, narrative: { ...base.jhg.narrative, skillScores: scored } } };
    expect(n7(withScores)).toMatchObject({ pass: false, fix: expect.stringContaining("Negotiation") });
    expect(n7({ ...withScores, jhg: { ...withScores.jhg, narrative: { ...withScores.jhg.narrative, leadSkills: ["python", "SQL", "Excel"] } } }).pass).toBe(true);
  });
});

describe("the companies rubric", () => {
  const stored: JhgCompany[] = [
    { name: "Xero", subSector: "Accounting SaaS", growthSignal: "+18% revenue FY25", growthSource: "https://news.example/xero", knownContact: "Sam" },
    { name: "Sharesies", subSector: "Wealth", growthSignal: "Series C closed", growthSource: "https://news.example/sharesies" },
    { name: "Dream Co", subSector: "Space" },
    { name: "Halter", subSector: "Agritech", growthSignal: "hiring wave" },
  ];

  it("shows only stored companies, all of them when the coach names none, with a mute line each", () => {
    expect(matrixCompanies(stored).ok && matrixCompanies(stored).ok && (matrixCompanies(stored) as { companies: JhgCompany[] }).companies.map((c) => c.name)).toEqual(["Xero", "Sharesies", "Dream Co", "Halter"]);
    const some = matrixCompanies(stored, ["halter", "Xero", "xero"]);
    expect(some.ok && some.companies.map((c) => c.name)).toEqual(["Halter", "Xero"]);
    expect(matrixCompanies(stored, ["Evil Corp"])).toEqual({ ok: false, error: '"Evil Corp" is not one of the stored companies — write it with Part A first' });
    expect(matrixCompanies([]).ok).toBe(false);
    expect(companyMeta(stored[0])).toBe("Accounting SaaS · +18% revenue FY25 · knows Sam");
    expect(companyMeta(stored[2])).toBe("Space");
  });

  it("lays the numbers on the stored list, which rankCompanies then ranks the same way the rubric does", () => {
    const rows = [row("Xero", 5, 4, 5, 4), row("sharesies", 4, 5, 2, 3), row("Dream Co", 2, 5, 1, 1), row("Halter", 5, 3, 3, 5)];
    const applied = applyCompanyScores(stored, rows);
    expect(applied[1].scores).toEqual({ growth: 4, interest: 5, access: 2, proof: 3, total: 14 });
    expect(applied[0].subSector).toBe("Accounting SaaS"); // nothing else touched
    const ranked = rankCompanies(applied);
    expect(ranked.map((c) => `${c.name}${c.rank}`)).toEqual(["Xero1", "Halter2", "Sharesies3", "Dream Co4"]);
    expect(companyRows(applied).map((r) => `${r.item}${r.rank}`)).toEqual(["Xero1", "Sharesies3", "Dream Co4", "Halter2"]);
  });

  it("challenges what the prompt names — a dream, access with no route, growth with no source, proof fives — plus the shared flags", () => {
    const applied = applyCompanyScores(stored, [row("Xero", 5, 4, 5, 4), row("Sharesies", 5, 5, 5, 3), row("Dream Co", 2, 5, 1, 1), row("Halter", 5, 3, 3, 5)]);
    const flags = companyFlags(applied);
    expect(flags.find((f) => f.id === "dream")?.items).toEqual(["Dream Co"]);
    expect(flags.find((f) => f.id === "access_no_route")?.items).toEqual(["Sharesies"]); // Xero has Sam
    expect(flags.find((f) => f.id === "growth_no_source")?.items).toEqual(["Halter"]); // Xero and Sharesies have a source
    expect(flags.find((f) => f.id === "proof_five")?.items).toEqual(["Halter"]);
    const m = companyScoresMessage(applied);
    expect(m).toContain("| 1 | Sharesies | 5 | 5 | 5 | 3 | **18** |"); // ties Xero on 18, wins on Interest
    expect(m).toContain("| 2 | Xero | 5 | 4 | 5 | 4 | **18** |");
    expect(m).toContain("Ranks 1–10: Sharesies, Xero, Halter, Dream Co.");
    expect(m).toContain("challenge these one company at a time and record each in challenges[]");
    expect(m).toContain("do not write them again");
  });
});

describe("the matrix in the conversation", () => {
  it("is one tool, offered to the coaches with a rubric, and the prompts tell them so", () => {
    expect(coachTools("narrative").map((t) => t.name)).toEqual(["update_profile", SCORE_MATRIX]);
    expect(coachTools("targetCompanies").map((t) => t.name)).toEqual(["update_profile", "run_research", SCORE_MATRIX]);
    expect(coachTools("trueNorth").map((t) => t.name)).toEqual(["update_profile", "run_research"]);
    expect(scoreMatrixTool("linkedin")).toBeNull();
    expect((scoreMatrixTool("narrative")!.input_schema.properties.kind as { enum: string[] }).enum).toEqual(["skills"]);
    expect((scoreMatrixTool("targetCompanies")!.input_schema.properties.kind as { enum: string[] }).enum).toEqual(["companies"]);
    expect(COACH_PROMPTS.narrative.text).toContain('call score_matrix with kind "skills"');
    expect(COACH_PROMPTS.narrative.text).toContain("never total or rank yourself");
    expect(COACH_PROMPTS.narrative.text).toContain("N7");
    expect(COACH_PROMPTS.targetCompanies.text).toContain('call score_matrix with kind "companies"');
    expect(COACH_PROMPTS.targetCompanies.text).toContain("Never ask the numbers company by company");
    expect(COACH_PROMPTS.targetCompanies.text).not.toContain("batches of five");
  });

  it("rides the stream as a matrix event and waits until a member turn carries the scored rows", () => {
    const matrix = { kind: "skills" as const, items: ["a", "b", "c"] };
    const p = applyEvent(emptyPending(), { type: "matrix", matrix });
    expect(p.matrix).toEqual(matrix);
    const shown: TranscriptTurn = { role: "coach", text: "Score them all.", at: 2, matrix };
    const turns: TranscriptTurn[] = [{ role: "coach", text: "List your skills.", at: 1 }, { role: "member", text: "a, b, c", at: 1 }, shown];
    expect(pendingMatrixOf(turns)).toEqual(matrix);
    const rows = rankRows([row("a", 5, 5, 5, 5), row("b", 3, 3, 3, 3), row("c", 1, 1, 1, 1)], S);
    const answered: TranscriptTurn[] = [...turns, { role: "member", text: "", at: 3, scored: { kind: "skills", rows } }];
    expect(pendingMatrixOf(answered)).toBeNull();
    // A second matrix after the answer waits again; the member's talk in between does not answer it.
    expect(pendingMatrixOf([...answered, { role: "coach", text: "Rescore these.", at: 4, matrix }, { role: "member", text: "ok", at: 5 }])).toEqual(matrix);
    expect(recapOf(answered)).toContain("Member: Scored 3 skills — ranked: a 20, b 12, c 4");
    expect(recapOf(answered)).toContain("(showed the skills matrix: a, b, c)");
  });
});
