import { describe, it, expect } from "vitest";
import { pseudonymise } from "@/lib/careerops/pseudonymise";

describe("pseudonymise", () => {
  it("removes name, email, phone and links", () => {
    const out = pseudonymise("# Ada Lovelace\nada@x.io · +64 21 123 4567 · linkedin.com/in/ada\nAda led the team; Lovelace Ltd.", { name: "Ada Lovelace", email: "ada@x.io" });
    expect(out).not.toMatch(/ada@x\.io|123 4567|linkedin\.com\/in\/ada/);
    expect(out).toContain("Alex Candidate");
    expect(out).toContain("Alex led the team");
    expect(out).toContain("Candidate Ltd");
  });
  it("keeps unrelated numbers and words", () => {
    expect(pseudonymise("Cut onboarding from 21 to 6 days on 1,200 accounts (NZ$4M ARR).", { name: "Bob" })).toBe("Cut onboarding from 21 to 6 days on 1,200 accounts (NZ$4M ARR).");
  });
});
