import { describe, it, expect } from "vitest";
import { COACHES, COACH_TOTAL, coachForPage, coachShowsOn, coachStates, findCoach, launcherLabel, missingBefore, nextCoach, pageOfPath } from "@/lib/engine/coach/keys";
import { COACH_OWNED_PATHS, foreignPaths, updateProfileTool } from "@/lib/engine/coach/tools";
import { applyEvent, emptyPending, parseEvent, writeLine } from "@/lib/engine/coach/transcript";
import { START_CUE, buildMessages, contextNote, userTurn, withoutOperatorNotes } from "@/lib/engine/coach/turn";
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
    expect(coachShowsOn("/jobhacking/narrative")).toBe(true);
    expect(coachShowsOn("/settings/true-north")).toBe(true);
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

  it("has a prompt for every coach marked ready", () => {
    for (const c of COACHES) expect(!!COACH_PROMPTS[c.key]).toBe(c.ready);
    expect(COACH_PROMPTS.narrative!.text).toContain("update_profile");
    expect(COACH_PROMPTS.narrative!.text).toContain("Brief narrative outlining who you are");
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
    expect(updateProfileTool("trueNorth")).toBeNull();
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

    const msgs = buildMessages([{ role: "user", content: "a" }, { role: "assistant", content: "b" }], "c", null, { page: "true-north", section: "salary", voice: true });
    expect(msgs).toHaveLength(4);
    expect(msgs[3].role).toBe("system");
    expect(String(msgs[3].content)).toContain("True North · Salary range");
    expect(String(msgs[3].content)).toContain("Voice");
    expect(withoutOperatorNotes(msgs)).toHaveLength(3);
    expect(contextNote({ page: null })).toBeNull();
    expect(contextNote({ page: "narrative" })).toBe("The member is looking at Narrative.");
    expect(START_CUE).toMatch(/start/);
  });
});
