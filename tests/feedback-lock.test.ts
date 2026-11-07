import { describe, expect, it } from "vitest";
import { uploadLockLine, uploadsLocked } from "@/lib/feedback-lock";
import { DEFAULT_FEEDBACK_CONFIG } from "@/lib/feedback-defaults";

describe("uploadsLocked", () => {
  it("is off while the admin flag is off, whatever the member has done", () => {
    expect(uploadsLocked({ uploadLock: false, submitted: false, loading: false })).toBe(false);
    expect(uploadsLocked({ uploadLock: false, submitted: false, loading: true })).toBe(false);
  });
  it("locks a member who has not answered", () => {
    expect(uploadsLocked({ uploadLock: true, submitted: false, loading: false })).toBe(true);
  });
  it("unlocks the moment the survey is submitted", () => {
    expect(uploadsLocked({ uploadLock: true, submitted: true, loading: false })).toBe(false);
  });
  it("holds the lock while the submission check is still loading", () => {
    expect(uploadsLocked({ uploadLock: true, submitted: true, loading: true })).toBe(true);
  });
});

describe("uploadLockLine", () => {
  it("counts the survey's questions", () => {
    expect(uploadLockLine(DEFAULT_FEEDBACK_CONFIG)).toBe("Answer 4 short questions and every slot unlocks.");
    expect(uploadLockLine({ questions: [DEFAULT_FEEDBACK_CONFIG.questions[0]] })).toBe("Answer 1 short question and every slot unlocks.");
  });
});

describe("defaults", () => {
  it("ships with the lock off", () => {
    expect(DEFAULT_FEEDBACK_CONFIG.uploadLock).toBe(false);
  });
});
