import { describe, it, expect } from "vitest";
import type { ProfileFile } from "@/lib/careerops/profile-file";
import { COACH_PARTS } from "@/lib/engine/coach/parts";
import { asideFor, canContinue, completedSteps, currentStep, findStep, previousStep, scriptFor, stepFields, stepPosition, validateStep, type JobLike, type StepValues } from "@/lib/engine/coach/script";
import { TRUE_NORTH_SCRIPT, phraseCounts, repeatedTitles } from "@/lib/engine/coach/script/true-north";
import { foreignPaths } from "@/lib/engine/coach/tools";

// The scripted coach (decision C, docs/DECISION_PROFILE_INTERFACE_2026-11-25.md): Coach 2's conversation as steps — one
// decision each, the same keys, the derived keys by the prompt's rules, resume from the stored profile.

const S = TRUE_NORTH_SCRIPT;
const empty: ProfileFile = { version: 1 };
const withBoundaries = (b: Record<string, unknown>, more: Partial<ProfileFile> = {}): ProfileFile => ({ version: 1, ...more, jhg: { ...(more.jhg ?? {}), trueNorth: { ...(more.jhg?.trueNorth ?? {}), boundaries: b } } });
const payB = { currency: "NZD", salaryLower: "140,000", salaryUpper: "170,000", salaryFloor: "130,000" };
const rightsB = { authorizedIn: ["New Zealand"], needsSponsorship: "N", visaStatus: "NZ citizen" };
const placeB = { willWorkIn: "Auckland", remote: "yes", localHybrid: "3 days" };
const moveB = { relocate: "no", remoteTravel: "a week a quarter" };
const neverB = { hardNos: ["on-call weekends"], noticePeriodDays: 28 };
const allA = { ...payB, ...rightsB, ...placeB, ...moveB, cultureMustHaves: ["clear decision rights"], deprioritizeIfAbsent: "Y", ...neverB, negotiationLines: ["My range is 140 to 170"] };
const postings = [
  { title: "Delivery Lead", company: "A", phrases: ["stakeholder management", "agile delivery"] },
  { title: "Delivery Lead", company: "B", phrases: ["Agile delivery", "release management"] },
  { title: "Head of Delivery", company: "C", phrases: ["agile delivery", "vendor management"] },
  { title: "Head of Delivery", company: "D", phrases: ["release management"] },
  { title: "Scrum Master", company: "E", phrases: ["ceremonies"] },
  { title: "Programme Manager", company: "F", phrases: ["stakeholder management"] },
  { title: "Programme Manager", company: "G", phrases: [] },
];

describe("the True North script", () => {
  it("is registered for Coach 2 only, in the prompt's order, grouped by decision", () => {
    expect(scriptFor("trueNorth")).toBe(S);
    expect(scriptFor("narrative")).toBeNull();
    expect(S.steps.map((s) => s.id)).toEqual(["pay", "rights", "place", "move", "culture", "never", "negotiation", "review-a", "boards", "keepers", "titles"]);
    for (const s of S.steps) expect(stepFields(s, empty).length).toBeLessThanOrEqual(4);
    expect(stepPosition(S, findStep(S, "place")!)).toEqual({ n: 3, total: 8, part: COACH_PARTS.trueNorth[0].label });
    expect(asideFor(S, findStep(S, "pay")!)).toBe("Before we aim, we set the fence.");
    expect(asideFor(S, findStep(S, "rights")!)).toBeUndefined();
  });

  it("writes only Coach 2's keys", () => {
    const vals: Record<string, StepValues> = {
      pay: payB, rights: rightsB, place: { ...placeB, exclude: "" }, move: moveB, culture: { cultureMustHaves: ["x"], deprioritizeIfAbsent: "Y", softDislikes: [] },
      never: { hardNos: ["x"], excludeLevels: ["Junior"], neverApply: [], noticePeriodDays: "28" }, negotiation: { negotiationLines: ["a"] },
      keepers: { keepers: ["a", "b", "c"] }, titles: { titles: { A: "target", B: "exclude" } },
    };
    const p = withBoundaries(allA, { jhg: { trueNorth: { postings } } });
    for (const s of S.steps) if (s.kind !== "job") expect(foreignPaths("trueNorth", s.patch(vals[s.id] ?? {}, p))).toEqual([]);
  });

  it("walks the steps as the profile fills, and hands over when nothing is left to ask", () => {
    expect(currentStep(S, empty)?.id).toBe("pay");
    expect(currentStep(S, withBoundaries(payB))?.id).toBe("rights");
    expect(currentStep(S, withBoundaries({ ...payB, ...rightsB, ...placeB }))?.id).toBe("move");
    expect(currentStep(S, withBoundaries({ ...payB, ...rightsB, ...placeB, ...moveB }))?.id).toBe("culture");
    // A skipped culture leaves no mark; the next answer marks it.
    expect(currentStep(S, withBoundaries({ ...payB, ...rightsB, ...placeB, ...moveB, ...neverB }))?.id).toBe("negotiation");
    expect(currentStep(S, withBoundaries(allA))?.id).toBe("review-a");
    // The review writes no key: it is answered once the boards step is — the job running, or the postings landed.
    const running: JobLike[] = [{ id: "j1", type: "postings", status: "running" }];
    expect(currentStep(S, withBoundaries(allA), { jobs: running })).toBeNull();
    expect(completedSteps(S, withBoundaries(allA), { jobs: running }).map((s) => s.id)).toContain("review-a");
    const landed = withBoundaries(allA, { jhg: { trueNorth: { postings } } });
    expect(currentStep(S, landed)?.id).toBe("keepers");
    const kept = { ...landed, jhg: { trueNorth: { ...landed.jhg!.trueNorth, keepers: ["agile delivery", "release management", "stakeholder management"] } } };
    expect(currentStep(S, kept)?.id).toBe("titles");
    const bucketed = { ...kept, jhg: { trueNorth: { ...kept.jhg!.trueNorth, titles: { target: ["Delivery Lead"], exclude: ["Scrum Master"] } } } };
    expect(currentStep(S, bucketed)).toBeNull(); // clusters and Part C: the conversation's, for now
    expect(completedSteps(S, bucketed).map((s) => s.id)).toEqual(S.steps.map((s) => s.id));
    expect(previousStep(S, findStep(S, "keepers")!, bucketed)?.id).toBe("review-a"); // never a job step
    expect(previousStep(S, findStep(S, "pay")!, bucketed)).toBeNull();
  });

  it("validates the pay step's figures across fields", () => {
    const pay = findStep(S, "pay")!;
    expect(validateStep(pay, {}, empty)).toMatchObject({ currency: "Needed", salaryLower: "Needed" });
    expect(validateStep(pay, { ...payB, salaryFloor: "150,000" }, empty)).toEqual({ salaryFloor: "The floor is above the lower end" });
    expect(validateStep(pay, { ...payB, salaryUpper: "100,000" }, empty)).toEqual({ salaryUpper: "The upper end is below the lower" });
    expect(validateStep(pay, { ...payB, salaryLower: "lots" }, empty)).toEqual({ salaryLower: "A number" });
    expect(canContinue(pay, payB, empty)).toBe(true);
  });

  it("writes only the step's boundaries — the North Star is derived on the write path", () => {
    expect(findStep(S, "pay")!.patch(payB, empty)).toEqual({ jhg: { trueNorth: { boundaries: payB } } });
    expect(findStep(S, "pay")!.summary(payB)).toBe("NZD 140,000–170,000 · floor 130,000");
    expect(findStep(S, "rights")!.patch({ authorizedIn: ["New Zealand", "Australia"], needsSponsorship: "Y", visaStatus: "work visa" }, empty)).toEqual({ jhg: { trueNorth: { boundaries: { authorizedIn: ["New Zealand", "Australia"], needsSponsorship: "Y", visaStatus: "work visa" } } } });
    expect(findStep(S, "place")!.patch({ ...placeB, exclude: "Hamilton" }, empty)).toEqual({ jhg: { trueNorth: { boundaries: { ...placeB, exclude: "Hamilton" } } } });
  });

  it("writes the notice period as a number; the save point writes the stamp only", () => {
    const never = findStep(S, "never")!.patch({ hardNos: ["on-call weekends"], excludeLevels: [], neverApply: ["Acme"], noticePeriodDays: "28" }, empty) as { jhg: { trueNorth: { boundaries: Record<string, unknown> } } };
    expect(never.jhg.trueNorth.boundaries).toEqual({ hardNos: ["on-call weekends"], excludeLevels: [], neverApply: ["Acme"], noticePeriodDays: 28 });
    const review = findStep(S, "review-a")!;
    expect(review.kind).toBe("review");
    expect(review.progress).toBe("in_progress");
    expect(review.patch({}, withBoundaries(allA))).toEqual({});
  });

  it("reads a stored answer back for Back and Change", () => {
    const p = withBoundaries(allA);
    expect(findStep(S, "pay")!.read(p)).toEqual(payB);
    expect(findStep(S, "never")!.read(p)).toEqual({ hardNos: ["on-call weekends"], excludeLevels: [], neverApply: [], noticePeriodDays: "28" });
    expect(findStep(S, "culture")!.read(empty)).toEqual({ cultureMustHaves: [], deprioritizeIfAbsent: "", softDislikes: [] });
    expect(findStep(S, "culture")!.summary({})).toBe("Culture: I don't know yet");
  });

  it("counts the postings' phrases and titles in code — the keepers' and the buckets' rows", () => {
    expect(phraseCounts(postings).slice(0, 3)).toEqual([{ phrase: "agile delivery", count: 3 }, { phrase: "stakeholder management", count: 2 }, { phrase: "release management", count: 2 }]);
    expect(repeatedTitles(postings)).toEqual(["Delivery Lead", "Head of Delivery", "Programme Manager"]);
    expect(repeatedTitles(postings.slice(0, 3))).toEqual(["Delivery Lead", "Head of Delivery"]); // fewer than three repeat: every distinct title
    const p: ProfileFile = { version: 1, jhg: { trueNorth: { postings, keepers: ["something else"] } } };
    const kf = stepFields(findStep(S, "keepers")!, p)[0];
    expect(kf.kind).toBe("multi");
    expect(kf.options?.[0]).toEqual({ value: "agile delivery", label: "agile delivery", hint: "in 3 postings" });
    expect(kf.options?.some((o) => o.value === "something else")).toBe(true); // a stored keeper stays pickable
    expect(kf.min).toBe(3);
    const tf = stepFields(findStep(S, "titles")!, p)[0];
    expect(tf.kind).toBe("bucket");
    expect(tf.rows).toEqual(["Delivery Lead", "Head of Delivery", "Programme Manager"]);
  });

  it("keeps the titles honest: a target and an exclude", () => {
    const titles = findStep(S, "titles")!;
    const p: ProfileFile = { version: 1, jhg: { trueNorth: { postings, boundaries: { excludeLevels: ["Junior"] } } } };
    expect(validateStep(titles, { titles: { "Delivery Lead": "target", "Head of Delivery": "analog", "Programme Manager": "target" } }, p)).toMatchObject({ titles: expect.stringContaining("exclude") });
    expect(validateStep(titles, { titles: { "Delivery Lead": "exclude", "Head of Delivery": "exclude", "Programme Manager": "exclude" } }, p)).toEqual({ titles: "At least one title is a target" });
    expect(validateStep(titles, { titles: { "Delivery Lead": "target", "Head of Delivery": "analog" } }, p)).toEqual({ titles: "Every row needs a choice" });
    const ok = { titles: { "Delivery Lead": "target", "Head of Delivery": "analog", "Programme Manager": "exclude" } };
    expect(validateStep(titles, ok, p)).toEqual({});
    expect(titles.patch(ok, p)).toEqual({ jhg: { trueNorth: { titles: { target: ["Delivery Lead"], analog: ["Head of Delivery"], exclude: ["Programme Manager"] } } } });
    expect(titles.summary(ok)).toBe("target: Delivery Lead · analog: Head of Delivery · exclude: Programme Manager");
    expect(titles.read({ version: 1, jhg: { trueNorth: { titles: { target: ["A"], exclude: ["B"] } } } })).toEqual({ titles: { A: "target", B: "exclude" } });
  });

  it("the boards step is a job: its payload carries the member's boards and titles, nothing is written by the step", () => {
    const boards = findStep(S, "boards")!;
    expect(boards.kind).toBe("job");
    expect(boards.job?.type).toBe("postings");
    expect(boards.job?.payload({ boards: ["Seek", "LinkedIn"], titles: [] }, empty)).toEqual({ boards: ["Seek", "LinkedIn"] });
    expect(boards.job?.payload({ boards: [], titles: ["Delivery Lead"] }, empty)).toEqual({ titles: ["Delivery Lead"] });
    expect(boards.patch({}, empty)).toEqual({});
    expect(canContinue(boards, {}, empty)).toBe(true); // both fields optional
  });
});
