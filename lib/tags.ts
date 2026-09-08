// Client-safe event registry. Each event has a STABLE key; the tag string + stage
// + on/off are defaults that an admin can override (see config/events in Firestore).
// tag convention: EVENT->ACTION->TRACKER

// Pirate Metrics (AAARRR). Every tracked event is bucketed into one of these
// stages so the Analytics → Pirate metrics dashboard can roll them up.
export type EventStage = "awareness" | "acquisition" | "activation" | "retention" | "revenue" | "referral";

export interface PirateStage {
  key: EventStage;
  label: string;
  /** What "counts" for this stage in the Compass funnel. */
  help: string;
  /** Which system is the source of truth for this stage. */
  source: "Google Analytics" | "Supabase";
}

export const PIRATE_STAGES: PirateStage[] = [
  { key: "awareness",   label: "Awareness",   help: "Sessions, sources and countries on the public funnel pages.", source: "Google Analytics" },
  { key: "acquisition", label: "Acquisition", help: "A visitor leaves their details — e.g. starts or completes the quiz.", source: "Supabase" },
  { key: "activation",  label: "Activation",  help: "A lead becomes a member — registration, email verified, onboarding done.", source: "Supabase" },
  { key: "retention",   label: "Retention",   help: "Members come back and use the app — logins, activities logged, board moves.", source: "Supabase" },
  { key: "revenue",     label: "Revenue",     help: "A member buys — coaching booked, access purchased.", source: "Supabase" },
  { key: "referral",    label: "Referral",    help: "A member brings someone else in — shares, invites.", source: "Supabase" },
];
export const PIRATE_STAGE_KEYS = PIRATE_STAGES.map((s) => s.key) as EventStage[];
export const isEventStage = (v: unknown): v is EventStage => typeof v === "string" && (PIRATE_STAGE_KEYS as string[]).includes(v);

export interface EventDef {
  tag: string;
  stage: EventStage;
  label: string;
}

export const EVENT_DEFAULTS = {
  QUIZ_START:      { tag: "EVENT->QUIZ_START->TRACKER",       stage: "acquisition", label: "Quiz started" },
  QUIZ_COMPLETE:   { tag: "EVENT->QUIZ_COMPLETE->TRACKER",    stage: "acquisition", label: "Quiz completed" },
  REGISTRATION:    { tag: "EVENT->REGISTRATION->TRACKER",     stage: "activation", label: "Registration" },
  EMAIL_VERIFIED:  { tag: "EVENT->EMAIL_VERIFIED->TRACKER",   stage: "activation", label: "Email verified" },
  ONBOARDED:       { tag: "EVENT->ONBOARDED->TRACKER",        stage: "activation", label: "Onboarding complete" },
  LOGIN:           { tag: "EVENT->LOGIN->TRACKER",            stage: "retention",  label: "Login" },
  LOGOUT:          { tag: "EVENT->LOGOUT->TRACKER",           stage: "retention",  label: "Logout" },
  PASSWORD_RESET:  { tag: "EVENT->PASSWORD_RESET->TRACKER",   stage: "retention",  label: "Password reset" },
  LOG_ACTIVITY:    { tag: "EVENT->LOG_ACTIVITY->TRACKER",     stage: "retention",  label: "Log activity" },
  UNLOG_ACTIVITY:  { tag: "EVENT->UNLOG_ACTIVITY->TRACKER",   stage: "retention",  label: "Remove activity" },
  SET_TARGET:      { tag: "EVENT->SET_TARGET->TRACKER",       stage: "retention",  label: "Set target" },
  ADD_CONTACT:     { tag: "EVENT->ADD_CONTACT->TRACKER",      stage: "retention",  label: "Add contact" },
  UPDATE_CONTACT:  { tag: "EVENT->UPDATE_CONTACT->TRACKER",   stage: "retention",  label: "Update contact" },
  LOG_INTERACTION: { tag: "EVENT->LOG_INTERACTION->TRACKER",  stage: "retention",  label: "Log interaction" },
  ADD_OPPORTUNITY: { tag: "EVENT->ADD_OPPORTUNITY->TRACKER",  stage: "retention",  label: "Add opportunity" },
  UPDATE_OPPORTUNITY: { tag: "EVENT->UPDATE_OPPORTUNITY->TRACKER", stage: "retention", label: "Update opportunity" },
  STAGE_CHANGE:    { tag: "EVENT->OPPORTUNITY_STAGE->TRACKER",stage: "retention",  label: "Opportunity stage change" },
  ADD_REMINDER:    { tag: "EVENT->ADD_REMINDER->TRACKER",     stage: "retention",  label: "Add reminder" },
  REMINDER_DONE:   { tag: "EVENT->REMINDER_DONE->TRACKER",    stage: "retention",  label: "Reminder completed" },
  COACHING_OPEN:   { tag: "EVENT->COACHING_OPEN->TRACKER",    stage: "revenue",    label: "Coaching opened" },
  PAYWALL_HIT:     { tag: "EVENT->PAYWALL_HIT->TRACKER",      stage: "revenue",    label: "Paywall shown" },
  GRANT_CREATED:   { tag: "EVENT->GRANT_CREATED->TRACKER",    stage: "activation", label: "Access granted" },
  GRANT_REDEEMED:  { tag: "EVENT->GRANT_REDEEMED->TRACKER",   stage: "activation", label: "Access redeemed" },
} as const satisfies Record<string, EventDef>;

export type EventKey = keyof typeof EVENT_DEFAULTS;
export const EVENT_KEYS = Object.keys(EVENT_DEFAULTS) as EventKey[];

// TAGS now maps name -> stable key (kept so existing call sites read unchanged).
export const TAGS = Object.fromEntries(EVENT_KEYS.map((k) => [k, k])) as Record<EventKey, EventKey>;
