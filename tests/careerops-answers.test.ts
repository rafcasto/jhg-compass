import { describe, it, expect } from "vitest";
import { normalizeQuestion, questionId, standardId, STANDARD_ANSWERS, standardLabel } from "@/lib/careerops/answers";

describe("answer bank helpers (mirror of the worker's lib/answers.js)", () => {
  it("normalises the same way as the worker", () => {
    expect(normalizeQuestion("3. Why do you want to work at Xero? *")).toBe("why do you want to work at xero");
    expect(normalizeQuestion("What are your salary expectations? (required)")).toBe("what are your salary expectations");
  });
  it("gives the same id to the same question however it is written", async () => {
    expect(await questionId("Why Xero?")).toBe(await questionId("  why xero "));
    expect(await questionId("Why Xero?")).toMatch(/^q_[0-9a-f]{20}$/);
    expect(standardId("salary")).toBe("standard_salary");
  });
  it("has the standard families the worker matches on", () => {
    expect(STANDARD_ANSWERS.map((s) => s.key)).toEqual(["right_to_work", "sponsorship", "salary", "notice_period", "start_date", "location", "work_arrangement", "relocation", "drivers_licence", "background_check", "how_heard"]);
    expect(standardLabel("notice_period")).toBe("Notice period");
  });
});
