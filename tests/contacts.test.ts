import { describe, it, expect } from "vitest";
import { CONTACT_TYPES, CONTACT_TYPE_TKEY, DEFAULT_CONTACT_TYPE, normalizeContactType } from "@/lib/contacts";
import { DEFAULT_TEXT } from "@/lib/content";

describe("contact types", () => {
  it("exposes exactly the four contact types in order", () => {
    expect([...CONTACT_TYPES]).toEqual(["hiring_manager", "peer", "influencer", "referrer"]);
    expect(CONTACT_TYPES).toContain(DEFAULT_CONTACT_TYPE);
  });

  it("has an admin-editable label for every type", () => {
    for (const ct of CONTACT_TYPES) {
      expect(DEFAULT_TEXT[CONTACT_TYPE_TKEY[ct]]).toBeTruthy();
    }
    expect(DEFAULT_TEXT["tracker.f.ct.hiringManager"]).toBe("Hiring manager");
    expect(DEFAULT_TEXT["tracker.f.contactType"]).toBe("Contact type");
    expect(DEFAULT_TEXT["tracker.f.phone"]).toBe("Phone number");
  });

  it("keeps current values and maps legacy ones", () => {
    for (const ct of CONTACT_TYPES) expect(normalizeContactType(ct)).toBe(ct);
    expect(normalizeContactType("prospect")).toBe("hiring_manager");
    expect(normalizeContactType("referral")).toBe("referrer");
    expect(normalizeContactType("recruiter")).toBe("referrer");
    expect(normalizeContactType("coach")).toBe("influencer");
    expect(normalizeContactType("other")).toBe(DEFAULT_CONTACT_TYPE);
    expect(normalizeContactType(undefined)).toBe(DEFAULT_CONTACT_TYPE);
  });
});
