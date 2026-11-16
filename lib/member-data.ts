// What a member's data is, for the admin's reset and delete (Admin → TOFU → Access renewals →
// Member data). Pure — the one list both the server (lib/server/member-data.ts) and the admin
// screen read, so a collection added to the member's tree is named here once. Tested.

/** Every per-member subcollection under users/{uid}, with the label the admin reads. */
export const MEMBER_COLLECTIONS = [
  { key: "careerOps",          label: "Profile and setup",         group: "profile" },
  { key: "coachSessions",      label: "Coach conversations",       group: "coach" },
  { key: "engineJobs",         label: "Engine jobs",               group: "coach" },
  { key: "claudeUsage",        label: "Claude usage meter",        group: "coach" },
  { key: "shares",             label: "Share links",               group: "profile" },
  { key: "settings",           label: "Settings",                  group: "profile" },
  { key: "careerOpsReports",   label: "CareerOps reports",         group: "agents" },
  { key: "careerOpsPipeline",  label: "CareerOps pipeline",        group: "agents" },
  { key: "careerOpsDocs",      label: "CareerOps documents",       group: "agents" },
  { key: "careerOpsNotes",     label: "CareerOps notes",           group: "agents" },
  { key: "careerOpsAnswers",   label: "Standard answers",          group: "agents" },
  { key: "careerOpsVault",     label: "Portal accounts (vault)",   group: "agents" },
  { key: "contacts",           label: "Contacts",                  group: "tracker" },
  { key: "interactions",       label: "Interactions",              group: "tracker" },
  { key: "opportunities",      label: "Opportunities",             group: "tracker" },
  { key: "activityLogs",       label: "Activity log",              group: "tracker" },
  { key: "reminders",          label: "Reminders",                 group: "tracker" },
  { key: "feedback",           label: "Survey answers",            group: "tracker" },
] as const;

export type MemberCollectionKey = (typeof MEMBER_COLLECTIONS)[number]["key"];

/**
 * What a reset removes. `coach` — the six conversations, the jobs and the meter; the profile stays.
 * `all` — state zero, a new member: every subcollection, and the account document goes back to exactly what
 * registration wrote (ACCOUNT_FIELDS: email, name, createdAt — lib/server/registration.ts), so `onboardedAt`,
 * the goal and the country go and onboarding shows again. The grant (with its feature switches) and the
 * sign-in stay on both; only a delete removes those.
 */
export type ResetScope = "coach" | "all";
export const RESET_SCOPES: readonly ResetScope[] = ["coach", "all"];
export const isResetScope = (v: unknown): v is ResetScope => RESET_SCOPES.includes(v as ResetScope);

/** The subcollections a reset of this scope removes. */
export const collectionsForScope = (scope: ResetScope): MemberCollectionKey[] =>
  MEMBER_COLLECTIONS.filter((c) => scope === "all" || c.group === "coach").map((c) => c.key);

/** The fields of users/{uid} that survive a full reset — the account's, not the profile's (docs/UX_JOBHACKING.md §4). */
export const ACCOUNT_FIELDS = ["email", "firstName", "lastName", "createdAt"] as const;

export interface MemberDataSummary {
  uid: string;
  email: string | null;
  /** Documents per subcollection — only the non-empty ones. */
  counts: Partial<Record<MemberCollectionKey, number>>;
  /** Whether users/{uid} exists at all. */
  hasAccount: boolean;
  hasGrant: boolean;
  /** Whether a Firebase Auth user exists for the uid. */
  hasAuthUser: boolean;
}

/** "3 coach conversations · 12 opportunities" — the summary the confirm dialog quotes. */
export function summaryLine(s: MemberDataSummary, scope?: ResetScope): string {
  const keys = scope ? collectionsForScope(scope) : MEMBER_COLLECTIONS.map((c) => c.key);
  const parts = MEMBER_COLLECTIONS.filter((c) => keys.includes(c.key) && (s.counts[c.key] ?? 0) > 0).map((c) => `${s.counts[c.key]} ${c.label.toLowerCase()}`);
  return parts.length ? parts.join(" · ") : "nothing stored";
}
