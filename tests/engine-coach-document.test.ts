import { describe, it, expect } from "vitest";
import { MAX_DOCUMENT_CHARS, MAX_PDF_BYTES, PDF_TRANSCRIBE_PROMPT, START_CUE, START_WITH_CV_CUE, buildMessages, documentBlock, isCoachDocumentName, isPdfName, recapOf, userTurn } from "@/lib/engine/coach/turn";
import { coachStartsFromCv } from "@/lib/engine/coach/keys";
import { COACH_PROMPTS } from "@/lib/engine/coach/prompts";

// The CV-first start (docs/COACH_ASSESSMENT_2026-11-16.md §1.1, docs/UX_COACH_AGENTIC.md §3): the member's own
// document rides on the turn it arrived with; the three coaches that start from it; the prompts say how.

describe("a document on a turn", () => {
  const doc = { name: "ana-cv.md", text: "# CV -- Ana\n\n## Work Experience" };
  it("takes Markdown, plain text and a PDF (transcribed once, server-side), within a budget", () => {
    expect(isCoachDocumentName("cv.md")).toBe(true);
    expect(isCoachDocumentName("CV.TXT")).toBe(true);
    expect(isCoachDocumentName("cv.pdf")).toBe(true);
    expect(isPdfName("CV.PDF")).toBe(true);
    expect(isPdfName("cv.md")).toBe(false);
    expect(isCoachDocumentName("cv.docx")).toBe(false);
    expect(MAX_DOCUMENT_CHARS).toBeGreaterThanOrEqual(30_000);
    expect(MAX_PDF_BYTES).toBe(3 * 1024 * 1024);
    expect(PDF_TRANSCRIBE_PROMPT).toContain("verbatim");
    expect(PDF_TRANSCRIBE_PROMPT).toContain("nothing added or corrected");
  });
  it("precedes the member's words, fenced and named, and says the rule", () => {
    const block = documentBlock(doc);
    expect(block).toContain("(ana-cv.md)");
    expect(block).toContain("never write from it without a yes");
    expect(block).toMatch(/```\n# CV -- Ana\n\n## Work Experience\n```$/);
    const later = userTurn("here you go", null, doc);
    expect(String(later.content).indexOf("ana-cv.md")).toBeLessThan(String(later.content).indexOf("here you go"));
    const first = userTurn(START_WITH_CV_CUE, { profileYaml: "version: 1", account: { name: "Ana", email: "ana@x.io" } }, doc);
    const c = String(first.content);
    expect(c.indexOf("profile.yml")).toBeLessThan(c.indexOf("ana-cv.md"));
    expect(c.indexOf("ana-cv.md")).toBeLessThan(c.indexOf(START_WITH_CV_CUE));
    expect(userTurn("plain", null)).toEqual({ role: "user", content: "plain" });
    expect(buildMessages([], "x", null, null, doc)).toHaveLength(1);
    expect(START_WITH_CV_CUE).not.toBe(START_CUE);
  });
  it("is remembered by name in a restart's recap", () => {
    expect(recapOf([{ role: "member", text: "", at: 1, attachment: "ana-cv.md" }, { role: "coach", text: "Read it.", at: 2 }])).toBe("Member:  (attached ana-cv.md)\n\nCoach: Read it.");
  });
});

describe("the coaches that start from a CV", () => {
  it("are Narrative, Story Bank and Master CV, and their prompts say what to do with one", () => {
    expect(["narrative", "trueNorth", "targetCompanies", "storyBank", "masterCv", "linkedin"].filter((k) => coachStartsFromCv(k as never))).toEqual(["narrative", "storyBank", "masterCv"]);
    for (const k of ["narrative", "storyBank", "masterCv"] as const) {
      expect(COACH_PROMPTS[k].text).toContain("# WHEN A CV IS IN FRONT OF YOU");
      expect(COACH_PROMPTS[k].version).toBe(k === "narrative" ? 6 : 5); // Narrative v6: the skills matrix (docs/UX_COACH_AGENTIC.md §9)
    }
    expect(COACH_PROMPTS.narrative.text).toContain("write only what they confirm");
    expect(COACH_PROMPTS.trueNorth.text).not.toContain("# WHEN A CV IS IN FRONT OF YOU");
  });
});
