import { describe, it, expect } from "vitest";
import { MAX_MATRIX_SKILLS, SKILL_AXES, TOP_CUT, cleanSkills, parseScores, scoreSkills, scoresMessage, scoresRecap, skillFlags, topCut } from "@/lib/engine/coach/skills";
import { applyEvent, emptyPending, pendingMatrixOf, type TranscriptTurn } from "@/lib/engine/coach/transcript";
import { COACH_MATRIX, SCORE_SKILLS, coachTools, scoreSkillsTool } from "@/lib/engine/coach/tools";
import { coachChecks } from "@/lib/engine/coach/checks";
import { recapOf } from "@/lib/engine/coach/turn";
import { COACH_PROMPTS } from "@/lib/engine/coach/prompts";

// The skills rubric in code (docs/UX_COACH_AGENTIC.md §9): four axes with five anchors each, the same for every
// member; totals, ranks, the tie-break, the cut at six and the flags are the portal's — the model only converses.

const row = (skill: string, good: number, love: number, proof: number, pays: number) => ({ skill, good, love, proof, pays });

describe("the scale", () => {
  it("is four axes with five anchors each, in the method's order", () => {
    expect(SKILL_AXES.map((a) => a.key)).toEqual(["good", "love", "proof", "pays"]);
    for (const a of SKILL_AXES) expect(a.anchors).toHaveLength(5);
    expect(SKILL_AXES[2].anchors[1]).toBe("No result in 10 seconds"); // the one anchor the Gem had, kept
  });

  it("cleans the coach's list: trimmed, de-duplicated, 3–20", () => {
    expect(cleanSkills(["Python ", "python", "SQL", "Negotiation"])).toEqual({ ok: true, skills: ["Python", "SQL", "Negotiation"] });
    expect(cleanSkills(["a", "b"]).ok).toBe(false);
    expect(cleanSkills(Array.from({ length: MAX_MATRIX_SKILLS + 1 }, (_, i) => `s${i}`)).ok).toBe(false);
    expect(cleanSkills("x").ok).toBe(false);
  });

  it("takes the member's scores only against the matrix they saw, complete and 1–5", () => {
    const skills = ["Python", "SQL", "Negotiation"];
    const ok = parseScores([row("sql", 3, 4, 5, 4), row("Python", 5, 5, 5, 5), row("Negotiation", 2, 2, 2, 2)], skills);
    expect(ok.ok && ok.scores.map((s) => s.skill)).toEqual(["Python", "SQL", "Negotiation"]); // the matrix's order
    expect(parseScores([row("Python", 5, 5, 5, 5)], skills)).toEqual({ ok: false, error: "Not scored yet: SQL, Negotiation" });
    expect(parseScores([row("Excel", 5, 5, 5, 5)], skills).ok).toBe(false);
    expect(parseScores([row("Python", 6, 5, 5, 5), row("SQL", 3, 4, 5, 4), row("Negotiation", 2, 2, 2, 2)], skills).ok).toBe(false);
    expect(parseScores([{ skill: "Python", good: 1.5, love: 5, proof: 5, pays: 5 }, row("SQL", 3, 4, 5, 4), row("Negotiation", 2, 2, 2, 2)], skills).ok).toBe(false);
  });
});

describe("totals, ranks and the cut", () => {
  it("sums the four, ranks by total then proof, pays, love, then the matrix's order", () => {
    const scored = scoreSkills([row("A", 4, 4, 2, 4), row("B", 4, 4, 4, 2), row("C", 5, 5, 5, 5), row("D", 4, 4, 4, 2), row("E", 3, 5, 4, 2)]);
    expect(scored.map((s) => s.total)).toEqual([14, 14, 20, 14, 14]);
    // A loses on proof; B, D, E tie on proof and pays, E wins on love; B before D by the matrix's order.
    expect(scored.map((s) => `${s.skill}${s.rank}`)).toEqual(["A5", "B3", "C1", "D4", "E2"]);
    expect(topCut(scored, 2).map((s) => s.skill)).toEqual(["C", "E"]);
  });

  it("is deterministic — the same numbers always give the same ranks", () => {
    const input = [row("x", 3, 3, 3, 3), row("y", 3, 3, 3, 3), row("z", 2, 2, 2, 2)];
    expect(scoreSkills(input)).toEqual(scoreSkills([...input]));
    expect(scoreSkills(input).map((s) => s.rank)).toEqual([1, 2, 3]);
  });
});

describe("the flags", () => {
  const fifteen = (f: (i: number) => ReturnType<typeof row>) => scoreSkills(Array.from({ length: 15 }, (_, i) => f(i)));

  it("raises nothing on a table that separates and proves its top six", () => {
    const scored = scoreSkills([
      row("a", 5, 4, 5, 4), row("b", 4, 4, 5, 4), row("c", 4, 4, 4, 4), row("d", 4, 3, 4, 4), row("e", 3, 3, 4, 4), row("f", 3, 3, 4, 3),
      row("g", 3, 3, 3, 3), row("h", 3, 3, 2, 3), row("i", 2, 3, 2, 3), row("j", 2, 2, 2, 3), row("k", 2, 2, 2, 2), row("l", 2, 2, 1, 2), row("m", 1, 2, 1, 2), row("n", 1, 1, 1, 2), row("o", 1, 1, 1, 1),
    ]);
    expect(skillFlags(scored)).toEqual([]);
  });

  it("names inflation, flatness, unproven top-six skills, passions, dislikes and a tie at the cut", () => {
    expect(skillFlags(fifteen((i) => row(`s${i}`, 5, 5, 5, i % 2 ? 5 : 4))).map((f) => f.id)).toContain("inflated");
    expect(skillFlags(fifteen((i) => row(`s${i}`, 3, 3, 3, i % 2 ? 3 : 2))).map((f) => f.id)).toContain("flat");
    const unproven = skillFlags(scoreSkills([row("Lead", 5, 5, 1, 5), ...Array.from({ length: 5 }, (_, i) => row(`p${i}`, 4, 4, 5, 4)), row("x", 1, 1, 1, 1), row("y", 1, 1, 2, 1)]));
    expect(unproven.find((f) => f.id === "unproven")?.skills).toEqual(["Lead"]); // x and y are unproven too, but below the cut
    expect(skillFlags(scoreSkills([row("Painting", 3, 5, 3, 1), row("b", 3, 3, 3, 3), row("c", 3, 3, 3, 3)])).find((f) => f.id === "loved_not_paid")?.skills).toEqual(["Painting"]);
    expect(skillFlags(scoreSkills([row("Compliance", 5, 1, 5, 5), row("b", 3, 3, 3, 3), row("c", 3, 3, 3, 3)])).find((f) => f.id === "paid_not_loved")?.skills).toEqual(["Compliance"]);
    const tie = scoreSkills([...Array.from({ length: 5 }, (_, i) => row(`top${i}`, 5, 5, 5, 5)), row("Six", 3, 3, 3, 3), row("Seven", 3, 3, 3, 3), row("Eight", 1, 1, 1, 1)]);
    expect(skillFlags(tie).find((f) => f.id === "tie_at_cut")?.skills).toEqual(["Six", "Seven"]);
    expect(TOP_CUT).toBe(6);
  });

  it("writes the coach's message: a ranked table, the top six, the flags, and that the portal stored it", () => {
    const scored = scoreSkills([row("Python", 5, 5, 5, 5), row("SQL", 3, 4, 5, 4), row("Negotiation", 3, 3, 3, 3)]);
    const m = scoresMessage(scored);
    expect(m).toContain("| 1 | Python | 5 | 5 | 5 | 5 | **20** |");
    expect(m).toContain("Top 6 for the playoff: Python, SQL, Negotiation.");
    expect(m).toContain("do not write them again");
    expect(m).toContain("No flags from the portal");
    expect(scoresRecap(scored)).toBe("Scored 3 skills — ranked: Python 20, SQL 16, Negotiation 12");
    const flagged = scoresMessage(scoreSkills([row("Python", 5, 5, 5, 5), row("SQL", 3, 4, 5, 4), row("Negotiation", 2, 2, 2, 2)]));
    expect(flagged).toContain("The portal's flags — push back on these before the playoff:");
    expect(flagged).toContain("In the top 6 with Prove ≤ 2: Negotiation.");
  });
});

describe("the matrix in the conversation", () => {
  it("is a tool only the Narrative coach has, and the prompt tells it so", () => {
    expect(COACH_MATRIX).toEqual(["narrative"]);
    expect(coachTools("narrative").map((t) => t.name)).toEqual(["update_profile", SCORE_SKILLS]);
    expect(coachTools("trueNorth").map((t) => t.name)).toEqual(["update_profile", "run_research"]);
    expect(scoreSkillsTool("linkedin")).toBeNull();
    expect(COACH_PROMPTS.narrative.text).toContain("call score_skills");
    expect(COACH_PROMPTS.narrative.text).toContain("never total or rank yourself");
    expect(COACH_PROMPTS.narrative.text).toContain("N7");
  });

  it("rides the stream as a matrix event and waits until a member turn carries scores", () => {
    const p = applyEvent(emptyPending(), { type: "matrix", matrix: { skills: ["a", "b", "c"] } });
    expect(p.matrix).toEqual({ skills: ["a", "b", "c"] });
    const shown: TranscriptTurn = { role: "coach", text: "Score them all.", at: 2, matrix: { skills: ["a", "b", "c"] } };
    const turns: TranscriptTurn[] = [{ role: "coach", text: "List your skills.", at: 1 }, { role: "member", text: "a, b, c", at: 1 }, shown];
    expect(pendingMatrixOf(turns)).toEqual({ skills: ["a", "b", "c"] });
    const scored = scoreSkills([row("a", 5, 5, 5, 5), row("b", 3, 3, 3, 3), row("c", 1, 1, 1, 1)]);
    const answered: TranscriptTurn[] = [...turns, { role: "member", text: "", at: 3, scores: scored }];
    expect(pendingMatrixOf(answered)).toBeNull();
    // A second matrix after the answer waits again; the member's talk in between does not answer it.
    expect(pendingMatrixOf([...answered, { role: "coach", text: "Rescore these.", at: 4, matrix: { skills: ["a", "b", "c"] } }, { role: "member", text: "ok", at: 5 }])).toEqual({ skills: ["a", "b", "c"] });
    expect(recapOf(answered)).toContain("Member: Scored 3 skills — ranked: a 20, b 12, c 4");
    expect(recapOf(answered)).toContain("(showed the skills matrix: a, b, c)");
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
