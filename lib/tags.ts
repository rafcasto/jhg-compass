// Client-safe event registry. Each event has a STABLE key; the tag string + stage
// + on/off are defaults that an admin can override (see config/events in Firestore).
// tag convention: EVENT->ACTION->TRACKER

export type EventStage = "acquisition" | "activation" | "retention";

export interface EventDef {
  tag: string;
  stage: EventStage;
  label: string;
}

export const EVENT_DEFAULTS = {
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
  LOG_INTERACTION: { tag: "EVENT->LOG_INTERACTION->TRACKER",  stage: "retention",  label: "Log interaction" },
  ADD_OPPORTUNITY: { tag: "EVENT->ADD_OPPORTUNITY->TRACKER",  stage: "retention",  label: "Add opportunity" },
  STAGE_CHANGE:    { tag: "EVENT->OPPORTUNITY_STAGE->TRACKER",stage: "retention",  label: "Opportunity stage change" },
  COACHING_OPEN:   { tag: "EVENT->COACHING_OPEN->TRACKER",    stage: "retention",  label: "Coaching opened" },
  PAYWALL_HIT:     { tag: "EVENT->PAYWALL_HIT->TRACKER",      stage: "retention",  label: "Paywall shown" },
  GRANT_CREATED:   { tag: "EVENT->GRANT_CREATED->TRACKER",    stage: "activation", label: "Access granted" },
  GRANT_REDEEMED:  { tag: "EVENT->GRANT_REDEEMED->TRACKER",   stage: "activation", label: "Access redeemed" },
} as const;

export type EventKey = keyof typeof EVENT_DEFAULTS;
export const EVENT_KEYS = Object.keys(EVENT_DEFAULTS) as EventKey[];

// TAGS now maps name -> stable key (kept so existing call sites read unchanged).
export const TAGS = Object.fromEntries(EVENT_KEYS.map((k) => [k, k])) as Record<EventKey, EventKey>;
