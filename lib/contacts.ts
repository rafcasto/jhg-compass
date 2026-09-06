// Contact-type taxonomy for the Progress (Tracker) "Contacts" view.
//
// Contacts are classified by the role they play in the search rather than by
// job market (the Hidden / Visible split still applies to opportunities and
// activities — see lib/categories.ts).

export const CONTACT_TYPES = ["hiring_manager", "peer", "influencer", "referrer"] as const;
export type ContactType = (typeof CONTACT_TYPES)[number];

export const DEFAULT_CONTACT_TYPE: ContactType = "hiring_manager";

// Content keys for the admin-editable option labels (lib/content.ts).
export const CONTACT_TYPE_TKEY: Record<ContactType, string> = {
  hiring_manager: "tracker.f.ct.hiringManager",
  peer:           "tracker.f.ct.peer",
  influencer:     "tracker.f.ct.influencer",
  referrer:       "tracker.f.ct.referrer",
};

// Map any stored value (including legacy types written before the taxonomy
// change: prospect / coach / recruiter / referral / other) onto the current set.
export function normalizeContactType(t: string | undefined | null): ContactType {
  switch (t) {
    case "hiring_manager": case "peer": case "influencer": case "referrer": return t;
    case "prospect":  return "hiring_manager"; // "prospects" = potential future bosses
    case "referral":  return "referrer";
    case "recruiter": return "referrer";
    case "coach":     return "influencer";
    default:          return DEFAULT_CONTACT_TYPE;
  }
}
