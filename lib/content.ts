// Single source of truth for all admin-editable content.
//
// Two things live here and are overridable from the admin "Content" tab via the
// config/content Firestore document:
//   1) activities  — the Hidden / Visible job-market taxonomy (add / remove / edit)
//   2) text        — every static string shown across the app: Performance, onboarding,
//                    Compass, the Tracker/Progress board, navigation, and the
//                    sign-in / invite / set-password / verify-email screens
//
// This module is pure (no client/server-only imports) so it can be shared by the
// client hook (lib/firestore/content.ts) and the server helpers (lib/server/content.ts).

import { CATEGORIES, DEFAULT_WEEKLY_TARGETS, EFFORT_SPLIT } from "./categories";
import type { Activity, ContentConfig } from "./types";

// ---- default activity taxonomy (derived from the original static lists) ----
export const DEFAULT_ACTIVITIES: Activity[] = CATEGORIES.map((c) => ({
  id: c.id,
  market: c.market,
  emoji: c.emoji,
  label: c.label,
  defaultWeekly: DEFAULT_WEEKLY_TARGETS[c.id] ?? 0,
}));

// ---- catalogue of editable static strings ----
// Each entry powers one field in the admin Content editor and one default value.
export interface TextField {
  key: string;
  label: string;
  group: string;
  textarea?: boolean;
  help?: string;
}

export const TEXT_FIELDS: TextField[] = [
  // ----- Performance tab -----
  { group: "Performance tab", key: "perf.eyebrow", label: "Eyebrow" },
  { group: "Performance tab", key: "perf.title", label: "Title" },
  { group: "Performance tab", key: "perf.editTargets", label: "“Edit targets” button" },
  { group: "Performance tab", key: "perf.done", label: "“Done” button" },
  { group: "Performance tab", key: "perf.hiddenEmoji", label: "Hidden banner — emoji" },
  { group: "Performance tab", key: "perf.hiddenTitle", label: "Hidden banner — title" },
  { group: "Performance tab", key: "perf.visibleEmoji", label: "Visible banner — emoji" },
  { group: "Performance tab", key: "perf.visibleTitle", label: "Visible banner — title" },
  {
    group: "Performance tab", key: "perf.effortNote", label: "Banner subtitle",
    help: "Use {pct} for the effort-split percentage.",
  },
  { group: "Performance tab", key: "perf.footer", label: "Footer hint", textarea: true },
  { group: "Performance tab", key: "perf.setGoal", label: "“Set a daily goal” pill" },
  { group: "Performance tab", key: "perf.setTargetHint", label: "Edit-mode hint" },
  { group: "Performance tab", key: "perf.actual", label: "“Actual” label" },
  { group: "Performance tab", key: "perf.target", label: "“Target” label" },

  // ----- Onboarding -----
  { group: "Onboarding", key: "onb.welcomeTitle", label: "Step 1 — title" },
  { group: "Onboarding", key: "onb.welcomeSubtitle", label: "Step 1 — subtitle" },
  { group: "Onboarding", key: "onb.firstName", label: "Field — first name" },
  { group: "Onboarding", key: "onb.lastName", label: "Field — last name" },
  { group: "Onboarding", key: "onb.country", label: "Field — country" },
  { group: "Onboarding", key: "onb.goalEyebrow", label: "Goal statement — eyebrow" },
  { group: "Onboarding", key: "onb.goalIntro", label: "Step 2 — intro", textarea: true },
  { group: "Onboarding", key: "onb.salaryHelp", label: "Compensation helper", textarea: true },
  { group: "Onboarding", key: "onb.targetsTitle", label: "Step 3 — title" },
  { group: "Onboarding", key: "onb.targetsSubtitle", label: "Step 3 — subtitle", textarea: true },
  { group: "Onboarding", key: "onb.perDay", label: "“Per day” label" },
  { group: "Onboarding", key: "onb.finish", label: "Finish button" },

  // ----- Compass tab -----
  { group: "Compass tab", key: "compass.eyebrow", label: "Eyebrow" },
  { group: "Compass tab", key: "compass.title", label: "Title" },
  { group: "Compass tab", key: "compass.goalEyebrow", label: "Goal statement — eyebrow" },
  { group: "Compass tab", key: "compass.editIntro", label: "Edit-mode intro", textarea: true },
  { group: "Compass tab", key: "compass.salaryHelp", label: "Compensation helper", textarea: true },
  { group: "Compass tab", key: "compass.compTarget", label: "“Target salary” label" },
  { group: "Compass tab", key: "compass.compMin", label: "“Minimum” label" },

  // ----- Tracker / Progress board -----
  { group: "Progress (Tracker)", key: "tracker.eyebrow", label: "Eyebrow" },
  { group: "Progress (Tracker)", key: "tracker.title", label: "Title" },
  { group: "Progress (Tracker)", key: "tracker.addJob", label: "“Add job” button" },
  { group: "Progress (Tracker)", key: "tracker.intro", label: "Intro", textarea: true },
  { group: "Progress (Tracker)", key: "tracker.dropHere", label: "Empty-column text" },
  { group: "Progress (Tracker)", key: "tracker.moveTo", label: "“Move to:” prefix (mobile)" },
  { group: "Progress (Tracker)", key: "tracker.roleFallback", label: "Role fallback (when blank)" },
  // Kanban stage names
  { group: "Progress (Tracker)", key: "tracker.stage.wishlist", label: "Stage — Wishlist" },
  { group: "Progress (Tracker)", key: "tracker.stage.applied", label: "Stage — Applied" },
  { group: "Progress (Tracker)", key: "tracker.stage.interview", label: "Stage — Interview" },
  { group: "Progress (Tracker)", key: "tracker.stage.offer", label: "Stage — Offer" },
  { group: "Progress (Tracker)", key: "tracker.stage.rejected", label: "Stage — Rejected" },
  // Add-job sheet
  { group: "Progress (Tracker)", key: "tracker.addTitle", label: "Add-job sheet — title" },
  { group: "Progress (Tracker)", key: "tracker.addSubmit", label: "Add-job sheet — submit" },
  // Detail modal
  { group: "Progress (Tracker)", key: "tracker.jobLink", label: "“Job link” label" },
  { group: "Progress (Tracker)", key: "tracker.delete", label: "“Delete” label" },
  { group: "Progress (Tracker)", key: "tracker.contacts", label: "“Contacts” heading" },
  { group: "Progress (Tracker)", key: "tracker.contactsEmpty", label: "No-contacts text", textarea: true },
  { group: "Progress (Tracker)", key: "tracker.attachContact", label: "Attach-contact placeholder" },
  { group: "Progress (Tracker)", key: "tracker.newContact", label: "“New contact” button" },
  { group: "Progress (Tracker)", key: "tracker.notes", label: "“Conversation notes” heading" },
  { group: "Progress (Tracker)", key: "tracker.notePlaceholder", label: "Note input placeholder" },
  { group: "Progress (Tracker)", key: "tracker.noNotes", label: "No-notes text" },
  { group: "Progress (Tracker)", key: "tracker.addNote", label: "“Add” note button" },
  { group: "Progress (Tracker)", key: "tracker.newContactTitle", label: "New-contact sheet — title" },
  { group: "Progress (Tracker)", key: "tracker.createAttach", label: "New-contact sheet — submit" },
  // Shared form field labels
  { group: "Progress (Tracker)", key: "tracker.f.company", label: "Field — Company" },
  { group: "Progress (Tracker)", key: "tracker.f.role", label: "Field — Role" },
  { group: "Progress (Tracker)", key: "tracker.f.market", label: "Field — Market" },
  { group: "Progress (Tracker)", key: "tracker.f.source", label: "Field — Source" },
  { group: "Progress (Tracker)", key: "tracker.f.link", label: "Field — Link" },
  { group: "Progress (Tracker)", key: "tracker.f.fullName", label: "Field — Full name" },
  { group: "Progress (Tracker)", key: "tracker.f.email", label: "Field — Email" },
  { group: "Progress (Tracker)", key: "tracker.f.linkedin", label: "Field — LinkedIn URL" },
  { group: "Progress (Tracker)", key: "tracker.f.hidden", label: "Market option — Hidden" },
  { group: "Progress (Tracker)", key: "tracker.f.visible", label: "Market option — Visible" },

  // ----- Progress (Tracker) — view toggle, edit & reminders -----
  { group: "Progress (Tracker)", key: "tracker.view.board", label: "View toggle — Board" },
  { group: "Progress (Tracker)", key: "tracker.view.reminders", label: "View toggle — Reminders" },
  { group: "Progress (Tracker)", key: "tracker.edit", label: "“Edit” label" },
  { group: "Progress (Tracker)", key: "tracker.save", label: "“Save” button" },
  { group: "Progress (Tracker)", key: "tracker.cancel", label: "“Cancel” button" },
  { group: "Progress (Tracker)", key: "tracker.editJobTitle", label: "Edit-job sheet — title" },
  { group: "Progress (Tracker)", key: "tracker.editContactTitle", label: "Edit-contact sheet — title" },
  { group: "Progress (Tracker)", key: "reminders.eyebrow", label: "Reminders — eyebrow" },
  { group: "Progress (Tracker)", key: "reminders.title", label: "Reminders — title" },
  { group: "Progress (Tracker)", key: "reminders.intro", label: "Reminders — intro", textarea: true },
  { group: "Progress (Tracker)", key: "reminders.add", label: "Reminders — “Add reminder” button" },
  { group: "Progress (Tracker)", key: "reminders.addTitle", label: "Reminders — add sheet title" },
  { group: "Progress (Tracker)", key: "reminders.empty", label: "Reminders — empty text", textarea: true },
  { group: "Progress (Tracker)", key: "reminders.overdue", label: "Reminders — overdue label" },
  { group: "Progress (Tracker)", key: "reminders.done", label: "Reminders — done section label" },
  { group: "Progress (Tracker)", key: "reminders.noDue", label: "Reminders — “no date” label" },
  { group: "Progress (Tracker)", key: "reminders.f.title", label: "Reminders field — Title" },
  { group: "Progress (Tracker)", key: "reminders.f.due", label: "Reminders field — Due date" },
  { group: "Progress (Tracker)", key: "reminders.f.link", label: "Reminders field — Linked job" },
  { group: "Progress (Tracker)", key: "reminders.f.none", label: "Reminders field — link none option" },

  // ----- Navigation -----
  { group: "Navigation", key: "nav.compass", label: "Compass tab" },
  { group: "Navigation", key: "nav.performance", label: "Performance tab" },
  { group: "Navigation", key: "nav.tracker", label: "Progress tab" },
  { group: "Navigation", key: "nav.coaching", label: "Coaching tab" },

  // ----- Auth: sign in / sign up -----
  { group: "Sign in / sign up", key: "auth.shared.email", label: "“Email” field label" },
  { group: "Sign in / sign up", key: "auth.login.brand", label: "Heading — text" },
  { group: "Sign in / sign up", key: "auth.login.brandAccent", label: "Heading — accent word (red)" },
  { group: "Sign in / sign up", key: "auth.login.tagline", label: "Tagline" },
  { group: "Sign in / sign up", key: "auth.login.password", label: "“Password” field label" },
  { group: "Sign in / sign up", key: "auth.login.signupNote", label: "Sign-up note", textarea: true },
  { group: "Sign in / sign up", key: "auth.login.signIn", label: "“Sign in” button" },
  { group: "Sign in / sign up", key: "auth.login.createAccount", label: "“Create account” button" },
  { group: "Sign in / sign up", key: "auth.login.busy", label: "Busy button text" },
  { group: "Sign in / sign up", key: "auth.login.toSignup", label: "Switch → create account" },
  { group: "Sign in / sign up", key: "auth.login.toSignin", label: "Switch → I have an account" },
  { group: "Sign in / sign up", key: "auth.login.forgot", label: "“Forgot password?” link" },
  { group: "Sign in / sign up", key: "auth.login.resetSent", label: "Reset-email-sent message" },
  { group: "Sign in / sign up", key: "auth.login.enterEmailFirst", label: "“Enter email first” error" },
  { group: "Sign in / sign up", key: "auth.login.redirecting", label: "Redirecting state" },

  // ----- Auth: invite registration -----
  { group: "Invite registration", key: "auth.register.brand", label: "Heading — text" },
  { group: "Invite registration", key: "auth.register.brandAccent", label: "Heading — accent word (red)" },
  { group: "Invite registration", key: "auth.register.subtitle", label: "Subtitle" },
  { group: "Invite registration", key: "auth.register.passwordLabel", label: "“Choose a password” label" },
  { group: "Invite registration", key: "auth.register.submit", label: "Submit button" },
  { group: "Invite registration", key: "auth.register.busy", label: "Busy button text" },
  { group: "Invite registration", key: "auth.register.checking", label: "“Checking invite” state" },
  { group: "Invite registration", key: "auth.register.invalidTitle", label: "Invalid — title" },
  { group: "Invite registration", key: "auth.register.invalidExpired", label: "Invalid — expired" },
  { group: "Invite registration", key: "auth.register.invalidUsed", label: "Invalid — used" },
  { group: "Invite registration", key: "auth.register.invalidDefault", label: "Invalid — generic" },
  { group: "Invite registration", key: "auth.register.invalidHelp", label: "Invalid — help line" },

  // ----- Auth: set password & verify-link landing -----
  { group: "Set password / verify link", key: "auth.setpw.title", label: "Set password — title" },
  { group: "Set password / verify link", key: "auth.setpw.label", label: "Set password — field label" },
  { group: "Set password / verify link", key: "auth.setpw.submit", label: "Set password — button" },
  { group: "Set password / verify link", key: "auth.setpw.done", label: "Set password — success" },
  { group: "Set password / verify link", key: "auth.verifyLink.title", label: "Verify link — title" },
  { group: "Set password / verify link", key: "auth.verifyLink.verifying", label: "Verify link — verifying" },
  { group: "Set password / verify link", key: "auth.verifyLink.done", label: "Verify link — success" },

  // ----- Auth: verify-email gate -----
  { group: "Verify-email gate", key: "auth.verify.title", label: "Title" },
  { group: "Verify-email gate", key: "auth.verify.sentTo", label: "“We sent a link to” line" },
  { group: "Verify-email gate", key: "auth.verify.sentOk", label: "Email-sent confirmation" },
  { group: "Verify-email gate", key: "auth.verify.continue", label: "“I’ve verified — continue” button" },
  { group: "Verify-email gate", key: "auth.verify.resend", label: "“Resend” button" },
  { group: "Verify-email gate", key: "auth.verify.sending", label: "“Sending…” text" },
  { group: "Verify-email gate", key: "auth.verify.wrongEmail", label: "“Wrong email?” link" },
  { group: "Verify-email gate", key: "auth.verify.newEmailLabel", label: "New-email field label" },
  { group: "Verify-email gate", key: "auth.verify.updateResend", label: "“Update & resend” button" },
  { group: "Verify-email gate", key: "auth.verify.cancel", label: "“Cancel” button" },
  { group: "Verify-email gate", key: "auth.verify.signOut", label: "“Sign out” button" },
  { group: "Verify-email gate", key: "auth.verify.notVerified", label: "“Not verified yet” error", textarea: true },
];

export const DEFAULT_TEXT: Record<string, string> = {
  // Performance tab
  "perf.eyebrow": "Success Predictors",
  "perf.title": "Performance",
  "perf.editTargets": "Edit targets",
  "perf.done": "Done",
  "perf.hiddenEmoji": "👀",
  "perf.hiddenTitle": "Hidden Job Market",
  "perf.visibleEmoji": "✅",
  "perf.visibleTitle": "Visible Job Market",
  "perf.effortNote": "Contributes to ~{pct}% of your success",
  "perf.footer": "Tap + / − to log today. Tap Edit targets to set them.",
  "perf.setGoal": "Set a daily goal",
  "perf.setTargetHint": "Set your daily target →",
  "perf.actual": "Actual",
  "perf.target": "Target",

  // Onboarding
  "onb.welcomeTitle": "Welcome aboard 👋",
  "onb.welcomeSubtitle": "Let's set up your Compass. First, the basics.",
  "onb.firstName": "First name",
  "onb.lastName": "Last name",
  "onb.country": "Country",
  "onb.goalEyebrow": "Your Goal Statement",
  "onb.goalIntro": "Your goal statement keeps you pointed at the right target. Fill in the blanks — be specific.",
  "onb.salaryHelp": "Target = what you're aiming for. Minimum = the lowest you'd accept.",
  "onb.targetsTitle": "Set your daily targets 🎯",
  "onb.targetsSubtitle": "How much will you do each day? You can fine-tune these any time in Performance.",
  "onb.perDay": "Per day",
  "onb.finish": "Finish & enter Compass",

  // Compass tab
  "compass.eyebrow": "Your north star",
  "compass.title": "Compass",
  "compass.goalEyebrow": "Your Goal Statement",
  "compass.editIntro": "Refine your target. Be specific — clarity drives action.",
  "compass.salaryHelp": "Target = what you're aiming for. Minimum = the lowest you'd accept.",
  "compass.compTarget": "Target salary",
  "compass.compMin": "Minimum · deal-breaker",

  // Tracker / Progress board
  "tracker.eyebrow": "Pipeline",
  "tracker.title": "Progress",
  "tracker.addJob": "Add job",
  "tracker.intro": "Every role you're chasing, in one board. Drag cards across stages — or use the menu on mobile.",
  "tracker.dropHere": "Drop jobs here",
  "tracker.moveTo": "Move to:",
  "tracker.roleFallback": "Role",
  "tracker.stage.wishlist": "Wishlist",
  "tracker.stage.applied": "Applied",
  "tracker.stage.interview": "Interview",
  "tracker.stage.offer": "Offer",
  "tracker.stage.rejected": "Rejected",
  "tracker.addTitle": "Add job opportunity",
  "tracker.addSubmit": "Add to Wishlist",
  "tracker.jobLink": "Job link",
  "tracker.delete": "Delete",
  "tracker.contacts": "Contacts",
  "tracker.contactsEmpty": "No contacts attached yet. Add the people who can open doors here.",
  "tracker.attachContact": "Attach existing contact…",
  "tracker.newContact": "New contact",
  "tracker.notes": "Conversation notes",
  "tracker.notePlaceholder": "Log a call, email, update…",
  "tracker.noNotes": "No notes yet.",
  "tracker.addNote": "Add",
  "tracker.newContactTitle": "New contact",
  "tracker.createAttach": "Create & attach",
  "tracker.f.company": "Company",
  "tracker.f.role": "Role",
  "tracker.f.market": "Market",
  "tracker.f.source": "Source",
  "tracker.f.link": "Link",
  "tracker.f.fullName": "Full name",
  "tracker.f.email": "Email",
  "tracker.f.linkedin": "LinkedIn URL",
  "tracker.f.hidden": "Hidden",
  "tracker.f.visible": "Visible",
  "tracker.view.board": "Board",
  "tracker.view.reminders": "Reminders",
  "tracker.edit": "Edit",
  "tracker.save": "Save",
  "tracker.cancel": "Cancel",
  "tracker.editJobTitle": "Edit job",
  "tracker.editContactTitle": "Edit contact",
  "reminders.eyebrow": "Follow-ups",
  "reminders.title": "Reminders",
  "reminders.intro": "Never let a follow-up slip. Add a dated nudge and check it off when it's done.",
  "reminders.add": "Add reminder",
  "reminders.addTitle": "Add reminder",
  "reminders.empty": "No reminders yet. Add one to stay on top of your follow-ups.",
  "reminders.overdue": "Overdue",
  "reminders.done": "Done",
  "reminders.noDue": "No date",
  "reminders.f.title": "What to do",
  "reminders.f.due": "Due date",
  "reminders.f.link": "Linked job (optional)",
  "reminders.f.none": "— None —",

  // Navigation
  "nav.compass": "Compass",
  "nav.performance": "Performance",
  "nav.tracker": "Progress",
  "nav.coaching": "Coaching",

  // Auth — sign in / sign up
  "auth.shared.email": "Email",
  "auth.login.brand": "JobHacker",
  "auth.login.brandAccent": "Compass",
  "auth.login.tagline": "Hacking your way to a job is a full-time job.",
  "auth.login.password": "Password",
  "auth.login.signupNote": "We'll email you a verification link. Confirm it to set up your Compass.",
  "auth.login.signIn": "Sign in",
  "auth.login.createAccount": "Create account",
  "auth.login.busy": "Please wait…",
  "auth.login.toSignup": "Create an account",
  "auth.login.toSignin": "I already have an account",
  "auth.login.forgot": "Forgot password?",
  "auth.login.resetSent": "Check your inbox for a password link.",
  "auth.login.enterEmailFirst": "Enter your email first.",
  "auth.login.redirecting": "Signing you in…",

  // Auth — invite registration
  "auth.register.brand": "Create your",
  "auth.register.brandAccent": "Compass",
  "auth.register.subtitle": "You've been invited — 90 days of access await.",
  "auth.register.passwordLabel": "Choose a password",
  "auth.register.submit": "Create Account",
  "auth.register.busy": "Creating account…",
  "auth.register.checking": "Checking your invite…",
  "auth.register.invalidTitle": "Link unavailable",
  "auth.register.invalidExpired": "This registration link has expired.",
  "auth.register.invalidUsed": "This registration link has already been used.",
  "auth.register.invalidDefault": "This registration link is invalid.",
  "auth.register.invalidHelp": "Ask your JobHackers admin for a fresh invite.",

  // Auth — set password / verify link landing
  "auth.setpw.title": "Set your password",
  "auth.setpw.label": "New password",
  "auth.setpw.submit": "Set password",
  "auth.setpw.done": "Password set! Redirecting to sign in…",
  "auth.verifyLink.title": "Email verification",
  "auth.verifyLink.verifying": "Verifying your email…",
  "auth.verifyLink.done": "Email verified! Redirecting to sign in…",

  // Auth — verify-email gate
  "auth.verify.title": "Verify your email",
  "auth.verify.sentTo": "We sent a verification link to",
  "auth.verify.sentOk": "Verification email sent ✓",
  "auth.verify.continue": "I've verified — continue",
  "auth.verify.resend": "Resend verification email",
  "auth.verify.sending": "Sending…",
  "auth.verify.wrongEmail": "Wrong email? Change it",
  "auth.verify.newEmailLabel": "New email address",
  "auth.verify.updateResend": "Update & resend",
  "auth.verify.cancel": "Cancel",
  "auth.verify.signOut": "Sign out",
  "auth.verify.notVerified": "Not verified yet — click the link in your email, then try again.",

  // Goal statement
  "goal.template":
    "In 60 days from now, I'm an outstanding {jobTitle} who adds value for my employer ABC Corp, in the {industry} industry.\nI'm making $ {targetSalary} yearly.\nI'm located in {geography} and enjoy flexible working arrangements.",
};

// Goal statement sits in its own group at the end of the catalogue UI.
TEXT_FIELDS.push({
  group: "Goal statement", key: "goal.template", label: "Goal statement template", textarea: true,
  help: "Tokens {jobTitle} {industry} {targetSalary} {geography} are filled with the user’s answers and shown in bold.",
});

export const DEFAULT_CONTENT: ContentConfig = {
  effortSplit: { ...EFFORT_SPLIT },
  activities: DEFAULT_ACTIVITIES,
  text: DEFAULT_TEXT,
};

// ---- merge helpers (defaults <- stored overrides) ----
// Stored activities fully replace defaults (so admins can remove items); text is
// merged key-by-key so newly-added default keys always have a value.
export function mergeContent(stored?: Partial<ContentConfig> | null): ContentConfig {
  return {
    effortSplit: { ...DEFAULT_CONTENT.effortSplit, ...(stored?.effortSplit ?? {}) },
    activities:
      Array.isArray(stored?.activities) && stored!.activities.length
        ? stored!.activities
        : DEFAULT_ACTIVITIES,
    text: { ...DEFAULT_TEXT, ...(stored?.text ?? {}) },
  };
}

// ---- derived views used by pages ----
export const hiddenActivities = (c: ContentConfig) => c.activities.filter((a) => a.market === "hidden");
export const visibleActivities = (c: ContentConfig) => c.activities.filter((a) => a.market === "visible");

export function weeklyTargetsFrom(c: ContentConfig): Record<string, number> {
  const out: Record<string, number> = {};
  for (const a of c.activities) out[a.id] = a.defaultWeekly ?? 0;
  return out;
}

// Fill {token} placeholders in a template string.
export function fillTemplate(tpl: string, vars: Record<string, string | number>): string {
  return tpl.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""));
}

// Generate a stable-ish id for a brand-new activity.
export function newActivityId(label: string): string {
  const base = label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 24);
  return `${base || "activity"}_${Math.random().toString(36).slice(2, 6)}`;
}
