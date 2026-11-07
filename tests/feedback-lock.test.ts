import { describe, expect, it } from "vitest";
import { lockedSlots, slotLocked, uploadLockLine } from "@/lib/feedback-lock";
import { DEFAULT_FEEDBACK_CONFIG } from "@/lib/feedback-defaults";

const SLOTS = ["narrative", "trueNorth", "targetCompanies", "artefacts"];

describe("slotLocked", () => {
  it("is off while the admin flag is off, whatever the member has done", () => {
    expect(slotLocked({ uploadLock: false, unlocked: [], loading: false }, "narrative")).toBe(false);
    expect(slotLocked({ uploadLock: false, unlocked: [], loading: true }, "narrative")).toBe(false);
  });
  it("locks a slot the member has not answered for", () => {
    expect(slotLocked({ uploadLock: true, unlocked: [], loading: false }, "narrative")).toBe(true);
  });
  it("unlocks one slot per answer — the others stay locked", () => {
    const input = { uploadLock: true, unlocked: ["narrative"], loading: false };
    expect(slotLocked(input, "narrative")).toBe(false);
    expect(slotLocked(input, "trueNorth")).toBe(true);
    expect(lockedSlots(input, SLOTS)).toEqual(["trueNorth", "targetCompanies", "artefacts"]);
  });
  it("a global or link answer (no slot) unlocks nothing", () => {
    expect(lockedSlots({ uploadLock: true, unlocked: [], loading: false }, SLOTS)).toEqual(SLOTS);
  });
  it("holds the lock while the submission check is still loading", () => {
    expect(slotLocked({ uploadLock: true, unlocked: ["narrative"], loading: true }, "narrative")).toBe(true);
  });
  it("is fully open once every slot is answered", () => {
    expect(lockedSlots({ uploadLock: true, unlocked: SLOTS, loading: false }, SLOTS)).toEqual([]);
  });
});

describe("uploadLockLine", () => {
  it("counts the survey's questions", () => {
    expect(uploadLockLine(DEFAULT_FEEDBACK_CONFIG)).toBe("Each file unlocks with a short survey — 4 questions, once per file.");
    expect(uploadLockLine({ questions: [DEFAULT_FEEDBACK_CONFIG.questions[0]] })).toBe("Each file unlocks with a short survey — 1 question, once per file.");
  });
});

describe("defaults", () => {
  it("ships with the lock off", () => {
    expect(DEFAULT_FEEDBACK_CONFIG.uploadLock).toBe(false);
  });
});
