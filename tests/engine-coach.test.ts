import { describe, it, expect } from "vitest";
import { COACHES, COACH_TOTAL, coachForPage, coachShowsOn, coachStates, findCoach, launcherLabel, missingBefore, nextCoach, pageOfPath } from "@/lib/engine/coach/keys";
import { COACH_OWNED_PATHS, COACH_PATCH_SCHEMAS, foreignPaths, schemaPaths, updateProfileTool } from "@/lib/engine/coach/tools";
import { applyEvent, emptyPending, parseEvent, writeLine } from "@/lib/engine/coach/transcript";
import { MAX_ECHO_CHARS, MAX_RECAP_BYTES, MAX_TRANSCRIPT_BYTES, START_CUE, buildMessages, contextNote, recapOf, toolResultOf, transcriptFits, userTurn, withoutOperatorNotes } from "@/lib/engine/coach/turn";
import { COACH_PROMPTS } from "@/lib/engine/coach/prompts";

describe("the six coaches", () => {
  it("are the six Packer files in order, under the menu's two groups", () => {
    expect(COACH_TOTAL).toBe(6);
    expect(COACHES.map((c) => c.key)).toEqual(["narrative", "trueNorth", "targetCompanies", "storyBank", "masterCv", "linkedin"]);
    expect(COACHES.filter((c) => c.group === "compass").map((c) => c.label)).toEqual(["Narrative", "True North", "Target companies"]);
    expect(COACHES.filter((c) => c.group === "artefacts").map((c) => c.label)).toEqual(["Story Bank", "Master CV", "LinkedIn"]);
  });

  it("knows which coach writes which page, on either portal", () => {
    expect(pageOfPath("/jobhacking/true-north")).toBe("true-north");
    expect(pageOfPath("/settings/companies?section=top3")).toBe("companies");
    expect(pageOfPath("/settings")).toBeNull();
    expect(pageOfPath("/compass")).toBeNull();
    expect(coachForPage("true-north")?.key).toBe("trueNorth");
    expect(coachForPage("artefacts")?.key).toBe("storyBank");
    expect(coachForPage("agents")).toBeUndefined();
    // The coach floats only where a coach writes (decision 2026-11-10): not the hub, not JobHacking → Settings, not Agents.
    expect(coachShowsOn("/jobhacking/narrative")).toBe(true);
    expect(coachShowsOn("/settings/true-north?section=salary")).toBe(true);
    expect(coachShowsOn("/jobhacking/artefacts")).toBe(true);
    expect(coachShowsOn("/settings")).toBe(false);
    expect(coachShowsOn("/jobhacking/settings")).toBe(false);
    expect(coachShowsOn("/settings/agents")).toBe(false);
    expect(coachShowsOn("/compass")).toBe(false);
    expect(coachShowsOn("/careerops/sourcing")).toBe(false);
  });

  it("reads the stamps, finds the next coach, and gates on what must come first", () => {
    const states = coachStates({ narrative: { status: "complete" }, trueNorth: { status: "in_progress" } });
    expect(states.narrative).toBe("complete");
    expect(states.trueNorth).toBe("in_progress");
    expect(states.storyBank).toBe("not_started");
    expect(nextCoach(states).key).toBe("trueNorth");
    expect(missingBefore(findCoach("targetCompanies")!, states).map((c) => c.key)).toEqual(["trueNorth"]);
    expect(missingBefore(findCoach("narrative")!, states)).toEqual([]);
    expect(launcherLabel(findCoach("narrative")!, states)).toBe("Your coach · Narrative");
    expect(launcherLabel(findCoach("trueNorth")!, states)).toBe("Continue True North");
    expect(launcherLabel(findCoach("storyBank")!, states)).toBe("Start Story Bank");
    expect(nextCoach(coachStates(null)).key).toBe("narrative");
  });

  it("has a prompt for every coach, each with its Gem's opening line, the tool, and its knowledge file where the Gem had one", () => {
    for (const c of COACHES) { expect(c.ready).toBe(true); expect(COACH_PROMPTS[c.key].text).toContain("update_profile"); }
    expect(COACH_PROMPTS.narrative.text).toContain("Brief narrative outlining who you are");
    expect(COACH_PROMPTS.trueNorth.text).toContain("Clear definition of your Professional Target");
    expect(COACH_PROMPTS.storyBank.text).toContain("Your best work, proven");
    expect(COACH_PROMPTS.masterCv.text).toContain("Your complete record of proof");
    expect(COACH_PROMPTS.linkedin.text).toContain("written to be found and pasted");
    expect(COACH_PROMPTS.trueNorth.knowledge).toContain("Growth Company Source Directory");
    expect(COACH_PROMPTS.storyBank.knowledge).toContain("Value Proof Reference Library");
    expect(COACH_PROMPTS.linkedin.knowledge).toBeUndefined();
    expect(COACHES.find((c) => c.key === "trueNorth")!.search).toBeGreaterThan(COACHES.find((c) => c.key === "linkedin")!.search);
  });
});

describe("update_profile", () => {
  it("is a closed tool over the coach's own keys — not strict: the server enforces the shape", () => {
    const t = updateProfileTool("narrative")!;
    expect(t.strict).toBe(false);
    expect(t.input_schema.required).toEqual(["patch"]);
    const patch = t.input_schema.properties.patch as { properties: Record<string, unknown>; additionalProperties: boolean };
    expect(Object.keys(patch.properties)).toEqual(["contact", "personalization", "narrative", "jhg"]);
    expect(patch.additionalProperties).toBe(false);
    expect(updateProfileTool("trueNorth").input_schema.properties.patch).toBeDefined();
  });

  it("every coach's schema offers only paths that coach owns — the two never drift apart", () => {
    const nest = (path: string): Record<string, unknown> => path.split(".").reverse().reduce<Record<string, unknown>>((acc, k) => ({ [k]: acc }), { x: 1 } as Record<string, unknown>);
    for (const c of COACHES) {
      for (const path of schemaPaths(COACH_PATCH_SCHEMAS[c.key])) expect({ coach: c.key, path, foreign: foreignPaths(c.key, nest(path)) }).toEqual({ coach: c.key, path, foreign: [] });
    }
    expect(foreignPaths("trueNorth", { narrative: { headline: "x" } })).toEqual(["narrative"]);
    expect(foreignPaths("linkedin", { cv: "x", linkedin: { headline: "y" } })).toEqual(["cv"]);
    expect(foreignPaths("masterCv", { jhg: { artefacts: { storyFacts: [] , cvHouseRules: [] } } })).toEqual(["jhg.artefacts.storyFacts"]);
  });

  it("refuses another coach's keys, path by path", () => {
    expect(foreignPaths("narrative", { contact: { phone: "1" }, narrative: { headline: "x" }, jhg: { identity: { city: "W" }, narrative: { leadSkills: ["a"] } } })).toEqual([]);
    expect(foreignPaths("narrative", { goal: { role: "PM" }, contact: { title: "CV headline", phone: "1" }, jhg: { trueNorth: {} } })).toEqual(["goal", "contact.title", "jhg.trueNorth"]);
    expect(foreignPaths("narrative", "x")).toEqual([]);
    expect(COACH_OWNED_PATHS.narrative).toContain("personalization.exitNarrative");
  });
});

describe("the transcript", () => {
  it("builds a pending turn from stream events and reads frames", () => {
    let p = emptyPending();
    p = applyEvent(p, { type: "text", text: "Good. " });
    p = applyEvent(p, { type: "text", text: "First the money." });
    p = applyEvent(p, { type: "write", note: { labels: ["Salary range"], links: [{ label: "Salary range", href: "/jobhacking/true-north?section=salary" }] } });
    expect(p.text).toBe("Good. First the money.");
    expect(p.writes).toHaveLength(1);
    expect(parseEvent('{"type":"text","text":"a"}')).toEqual({ type: "text", text: "a" });
    expect(parseEvent("not json")).toBeNull();
    expect(parseEvent('{"nope":1}')).toBeNull();
  });

  it("says what a write did in one line", () => {
    expect(writeLine({ labels: ["Contact details", "Headline"], links: [] })).toBe("Updated Contact details, Headline");
    expect(writeLine({ labels: ["Headline"], links: [], progress: "complete" })).toBe("Completed · Updated Headline");
    expect(writeLine({ labels: [], links: [], progress: "complete" })).toBe("Marked complete");
  });
});

describe("one turn's request", () => {
  it("puts the profile in the first user turn only, and the operator note last", () => {
    const first = userTurn("hi", { profileYaml: "version: 1\ncontact:\n  phone: '1'", account: { name: "Ana Ferreira", email: "ana@x.io" } });
    expect(first.role).toBe("user");
    expect(first.content).toContain("```yaml");
    expect(first.content).toContain("Account: Ana Ferreira <ana@x.io>");
    expect(first.content).toMatch(/hi$/);
    expect(userTurn("next", null)).toEqual({ role: "user", content: "next" });

    const msgs = buildMessages([{ role: "user", content: "a" }, { role: "assistant", content: "b" }], "c", null, { page: "true-north", section: "salary" });
    expect(msgs).toHaveLength(4);
    expect(msgs[3].role).toBe("system");
    expect(String(msgs[3].content)).toContain("True North · Salary range");
    expect(withoutOperatorNotes(msgs)).toHaveLength(3);
    expect(contextNote({ page: null })).toBeNull();
    expect(contextNote({ page: "narrative" })).toBe("The member is looking at Narrative.");
    expect(START_CUE).toMatch(/start/);
  });
});

describe("a transcript that outgrows the document", () => {
  it("fits under the budget and not over it — well inside Firestore's 1 MiB", () => {
    expect(MAX_TRANSCRIPT_BYTES).toBeLessThan(1_048_576 / 2);
    expect(transcriptFits("[]")).toBe(true);
    expect(transcriptFits(JSON.stringify([{ role: "user", content: "x".repeat(MAX_TRANSCRIPT_BYTES - 64) }]))).toBe(true);
    expect(transcriptFits("[" + "é".repeat(MAX_TRANSCRIPT_BYTES) + "]")).toBe(false); // bytes, not characters
  });

  it("recaps the readable turns oldest first, with what each coach turn wrote", () => {
    expect(recapOf([])).toBeNull();
    const recap = recapOf([
      { role: "coach", text: "Which three companies first?", at: 1 },
      { role: "member", text: "Stripe, Wise, Monzo", at: 2 },
      { role: "coach", text: "Saved.", at: 3, writes: [{ labels: ["Top 3", "Top 10"], links: [] }] },
    ]);
    expect(recap).toBe("Coach: Which three companies first?\n\nMember: Stripe, Wise, Monzo\n\nCoach: Saved.\n(wrote: Top 3, Top 10)");
  });

  it("keeps the most recent turns when the recap would not fit, and says so", () => {
    const turns = Array.from({ length: 10 }, (_, i) => ({ role: (i % 2 ? "coach" : "member") as "coach" | "member", text: `turn ${i} ` + "y".repeat(100), at: i }));
    const recap = recapOf(turns, 400)!;
    expect(recap.startsWith("[earlier turns omitted]")).toBe(true);
    expect(recap).toContain("turn 9");
    expect(recap).toContain("turn 8");
    expect(recap).not.toContain("turn 0 ");
    expect(recapOf(turns)).not.toContain("omitted");
    expect(MAX_RECAP_BYTES).toBeLessThan(MAX_TRANSCRIPT_BYTES);
  });

  it("restarts as a first turn: the profile, then the recap, then the member's words", () => {
    const first = { profileYaml: "version: 1", account: { name: "Ana", email: "ana@x.io" }, recap: "Coach: hi\n\nMember: hello" };
    const content = String(userTurn("what next?", first).content);
    expect(content.indexOf("```yaml")).toBeLessThan(content.indexOf("restarted"));
    expect(content).toContain("Coach: hi\n\nMember: hello");
    expect(content).toMatch(/what next\?$/);
    expect(String(userTurn("hi", { ...first, recap: null }).content)).not.toContain("restarted");
  });
});

describe("what a save answers the coach", () => {
  it("echoes a short write as stored, and only names the sections of a long one", () => {
    expect(toolResultOf(["Headline"], "version: 1\nnarrative:\n  headline: Head of Data")).toEqual({ ok: true, updated: ["Headline"], profile: "version: 1\nnarrative:\n  headline: Head of Data" });
    const long = "version: 1\ncompanyLists:\n" + "  - name: Co\n".repeat(400) + "watchlist:\n  - x\n";
    expect(long.length).toBeGreaterThan(MAX_ECHO_CHARS);
    const r = toolResultOf(["Top 40"], long);
    expect(r.profile).toBeUndefined();
    expect(String(r.stored)).toMatch(/^companyLists, watchlist — written as sent/);
    expect(JSON.stringify(r).length).toBeLessThan(200);
  });
  it("carries the validator's warnings so the coach confirms what the page holds", () => {
    const w = ["narrative.headline is 260 characters — trimmed to 220"];
    expect(toolResultOf(["Headline"], "version: 1", w)).toEqual({ ok: true, updated: ["Headline"], warnings: w, profile: "version: 1" });
    expect(toolResultOf(["Headline"], "version: 1", [])).not.toHaveProperty("warnings");
  });
});
