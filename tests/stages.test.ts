import { describe, it, expect } from "vitest";
import { DEFAULT_STAGES, newStageId, normalizeStages, resolveStage, stageDotClass } from "@/lib/stages";
import { mergeContent, DEFAULT_TEXT, TEXT_FIELDS } from "@/lib/content";

describe("DEFAULT_STAGES", () => {
  it("is the nine-step pipeline in order", () => {
    expect(DEFAULT_STAGES.map((s) => s.label)).toEqual([
      "Wishlist", "Outreach", "Information interview", "Application", "Job interview",
      "Offer", "Negotiation", "✅ Accepted", "❌ Rejected",
    ]);
  });
  it("has unique ids and palette colours", () => {
    const ids = DEFAULT_STAGES.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    // every default colour resolves to a real palette class (not the unknown-colour fallback)
    for (const s of DEFAULT_STAGES) {
      if (s.color === "grey") continue;
      expect(stageDotClass(s.color)).not.toBe(stageDotClass("not-a-colour"));
    }
  });
});

describe("normalizeStages", () => {
  it("falls back to defaults for missing / empty / garbage input", () => {
    expect(normalizeStages(undefined)).toBe(DEFAULT_STAGES);
    expect(normalizeStages([])).toBe(DEFAULT_STAGES);
    expect(normalizeStages("nope")).toBe(DEFAULT_STAGES);
    expect(normalizeStages([{ id: "", label: "x" }, null, 42])).toBe(DEFAULT_STAGES);
  });
  it("trims, dedupes ids, drops blank labels and coerces unknown colours", () => {
    const out = normalizeStages([
      { id: " a ", label: " Alpha ", color: "blue" },
      { id: "a", label: "Dup", color: "red" },
      { id: "b", label: "   ", color: "red" },
      { id: "c", label: "Gamma", color: "hotpink" },
    ]);
    expect(out).toEqual([
      { id: "a", label: "Alpha", color: "blue" },
      { id: "c", label: "Gamma", color: "grey" },
    ]);
  });
});

describe("resolveStage", () => {
  const stages = DEFAULT_STAGES;
  it("keeps ids that exist on the board", () => {
    expect(resolveStage("negotiation", stages)).toBe("negotiation");
  });
  it("maps legacy ids to the closest current column", () => {
    expect(resolveStage("applied", stages)).toBe("application");
    expect(resolveStage("interview", stages)).toBe("job_interview");
    expect(resolveStage("interviewing", stages)).toBe("job_interview");
    expect(resolveStage("contacted", stages)).toBe("outreach");
    expect(resolveStage("researching", stages)).toBe("wishlist");
    expect(resolveStage("closed", stages)).toBe("rejected");
    expect(resolveStage("accepted", stages)).toBe("accepted");
  });
  it("falls back to the first column for unknown or removed stages", () => {
    expect(resolveStage("bogus", stages)).toBe("wishlist");
    expect(resolveStage(undefined, stages)).toBe("wishlist");
    const trimmed = [{ id: "todo", label: "Todo", color: "grey" }, { id: "done", label: "Done", color: "green" }];
    expect(resolveStage("applied", trimmed)).toBe("todo");
    expect(resolveStage("done", trimmed)).toBe("done");
  });
});

describe("newStageId", () => {
  it("slugs the label and avoids collisions", () => {
    expect(newStageId("Second round!")).toBe("second_round");
    expect(newStageId("")).toBe("stage");
    const existing = [{ id: "offer", label: "Offer", color: "grey" }, { id: "offer_2", label: "Offer", color: "grey" }];
    expect(newStageId("Offer", existing)).toBe("offer_3");
  });
});

describe("mergeContent", () => {
  it("exposes stages, defaulting when nothing is stored", () => {
    expect(mergeContent(null).stages).toBe(DEFAULT_STAGES);
  });
  it("uses stored stages verbatim (after sanitising)", () => {
    const stored = [{ id: "x", label: "X", color: "red" }];
    expect(mergeContent({ stages: stored } as any).stages).toEqual(stored);
  });
  it("no longer carries stage names as text fields", () => {
    expect(TEXT_FIELDS.some((f) => f.key.startsWith("tracker.stage."))).toBe(false);
    expect(Object.keys(DEFAULT_TEXT).some((k) => k.startsWith("tracker.stage."))).toBe(false);
  });
});
