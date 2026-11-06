// Client-safe types for the career-ops integration (no Upstash / Firebase imports).
import type { Goal } from "@/lib/goal";
import type { Personalization } from "./personalization";
import type { AgentKey, CareerOpsJobStatus, CareerOpsJobType } from "./keys";

export interface CareerOpsJob {
  id: string;
  type: CareerOpsJobType;
  status: CareerOpsJobStatus;
  uid: string;                 // member the job belongs to ("admin" jobs use the admin's uid)
  payload: Record<string, unknown>;
  createdAt: number;
  createdBy: string;           // email or uid
  startedAt?: number;
  endedAt?: number;
  worker?: string;
  progress?: string;           // one-line human status, e.g. "Block D — compensation"
  log?: string;                // tail of the worker log (≤ ~12 kB), fetched per job
  result?: unknown;
  error?: string;
  cancel?: number;             // 1 when cancellation has been requested
}

export interface WorkerHeartbeat {
  id: string;
  host: string;
  pid: number;
  version: string;
  startedAt: number;
  at: number;
  current: string | null;      // job id being worked on
  pollMs: number;
  n8n: boolean;                // n8n reachable at last check
  ollama: boolean;             // Ollama reachable at last check
}

export interface OllamaModelInfo { name: string; sizeGb: number; modifiedAt: string; family?: string; params?: string }

export interface WorkerState {
  models: OllamaModelInfo[];
  agents: { key: AgentKey; n8nWorkflowId: string | null; active: boolean }[];
  datasets: { name: string; examples: number; builtAt: string }[];
  gpu: { host: string | null; reachable: boolean; checkedAt: number };
  careerOpsVersion: string | null;   // ~/career-ops package.json version on the Pi
  vaultPublicKey?: string | null;    // RSA-OAEP public key (SPKI, base64) — the browser encrypts portal passwords for this worker
  drive?: { configured: boolean; account: string | null; folderId: string | null; ok?: boolean; name?: string; canWrite?: boolean; error?: string };
  claude?: { configured: boolean; model: string; via?: "api" | "cli" | "none"; bin?: string; hint?: string };   // via: API key · Claude Code CLI (`claude login`) · nothing
  // Non-Ollama model tags any LLM agent may run on: "claude-cli[:sonnet|opus|haiku]" (Claude Code, your
  // subscription) and "claude-api" (Anthropic key). Absent/empty when neither is set up on the Pi.
  claudeModels?: { name: string; label: string; family: "claude"; available: boolean }[];
  training?: { examples: { total: number; approved: number; exam: number; bySource: Record<string, number> }; datasets: { name: string; train: number; exam: number; builtAt: number }[] } | null;
  updatedAt: number;
}

export interface AgentConfig {
  model: string;               // Ollama tag
  numCtx: number;
  numPredict: number;          // output cap — small models ramble without one
  temperature: number;
  systemPrompt: string;
  promptVersion: number;
  promptEditedBy?: string | null;   // set once an admin edits; stops the worker auto-upgrading the default
  promptEditedAt?: number | null;
  enabled: boolean;
  n8nWorkflowId: string | null;
}

// config/agents/promptVersions/{agent}-{version} — every saved prompt, for restore.
export interface PromptVersion {
  id: string;
  agent: AgentKey;
  version: number;
  systemPrompt: string;
  savedBy: string | null;
  savedAt: number;
  note?: string;
}

// Stored at config/agents (admin write, worker read via Admin SDK).
export interface AgentsConfig {
  agents: Record<AgentKey, AgentConfig>;
  dailyEvalQuota: number;
  dailyScanQuota: number;      // Scout runs per member per UTC day (zero tokens; a browser pass can take minutes per site)
  collectLiveData: boolean;    // approved live-member reports may enter training datasets (pseudonymised)
  updatedAt?: number;
  updatedBy?: string | null;
}

export const DEFAULT_AGENT: AgentConfig = {
  model: "qwen2.5:1.5b-instruct", numCtx: 8192, numPredict: 2800, temperature: 0.2, systemPrompt: "", promptVersion: 0, enabled: true, n8nWorkflowId: null,
};

export const DEFAULT_AGENTS_CONFIG: AgentsConfig = {
  agents: {
    scout:     { ...DEFAULT_AGENT, model: "llama3.2:3b" },
    extractor: { ...DEFAULT_AGENT },
    evaluator: { ...DEFAULT_AGENT, model: "llama3.2:3b", numCtx: 8192 },
    tailor:    { ...DEFAULT_AGENT, model: "llama3.2:3b" },
    writer:    { ...DEFAULT_AGENT, model: "llama3.2:3b", temperature: 0.5 },
    researcher:{ ...DEFAULT_AGENT, model: "claude-cli", temperature: 0.3 },
  },
  dailyEvalQuota: 20,
  dailyScanQuota: 6,
  collectLiveData: false,
};

// Admin → Agents → Overview payload.
export interface AgentsStatus {
  configured: boolean;         // Upstash env present
  worker: WorkerHeartbeat | null;
  online: boolean;
  state: WorkerState | null;
  queueLength: number;
}

// ---- member data mirrored in Firestore ----

// users/{uid}/careerOps/setup — owner-writable (Firestore client SDK).
export interface CareerOpsSetup {
  cvMarkdown: string;
  profileYaml: string;      // generated by buildProfileYaml, stored for transparency
  notes?: string;
  updatedAt: number;
}

// users/{uid}/careerOpsReports/{jobId} — written by the Pi worker (Admin SDK).
export interface CareerOpsReport {
  id: string;                   // Firestore doc id (= jobId)
  jobId: string;
  n: number;
  file: string;
  company: string;
  role: string;
  url: string | null;
  title: string | null;
  score: number | null;
  archetype: string;
  legitimacy: string;
  summaryFound: boolean;
  markdown: string;
  agent: AgentKey;
  model: string;
  promptVersion: number;
  via: "n8n" | "ollama" | "claude-cli";
  usage: { prompt: number | null; completion: number | null } | null;
  durationMs: number;
  jdChars: number;
  createdAt: number;
  addedOpportunityId?: string;  // set by the client once "Add to Tracker" is used
}

export const scoreTone = (s: number | null) => s == null ? "unknown" : s >= 4.5 ? "strong" : s >= 4 ? "good" : s >= 3.5 ? "maybe" : "skip";
export const scoreVerdict = (s: number | null) =>
  s == null ? "No score" : s >= 4.5 ? "Strong match — apply now" : s >= 4 ? "Good match — worth applying" : s >= 3.5 ? "Only with a specific reason" : "Skip this one";

// ---- phase 3: Scout pipeline, Tailor / Writer documents ----

// users/{uid}/careerOps/setup also carries the Scout config.
// One watched company. careersUrl should be the page that LISTS the jobs (the ATS board when there is one),
// not the marketing "life at …" page. provider / apiUrl map 1:1 to career-ops portals.yml `provider:` / `api:`
// — needed for branded ATS domains career-ops cannot auto-detect (SuccessFactors, Phenom, …).
export interface PortalCompany { name: string; careersUrl: string; enabled?: boolean; provider?: string; apiUrl?: string }
export interface CareerOpsPortals { companies: PortalCompany[]; positive: string[]; negative: string[] }
// Which North Star the agents work from. The Compass tab owns the member's goal;
// intake can capture its own and override it, and the choice is reversible at any
// time — the Compass goal is never overwritten, only out-ranked. Absent means
// "compass", so every member who predates intake is unaffected.
export type GoalSource = "compass" | "intake";

// candidate.* fields career-ops' profile.yml carries and the Pi worker ALREADY
// reads (careerops-worker/lib/profile.js → parseProfile). They reach the
// generated CV PDF header, the cover-letter contact block and the application
// form autofill, so leaving them unset silently degrades all three.
export interface CareerOpsContact {
  /** candidate.title — professional headline under the name on the CV. */
  title?: string;
  phone?: string;
  linkedin?: string;
  github?: string;
  /** candidate.portfolio_url */
  portfolio?: string;
  /** candidate.location — where the member is based ("Wellington, New Zealand"); falls back to the goal city, then the account country. */
  location?: string;
}

// compensation.* and location.* beyond the five Compass goal fields. These were
// previously hardcoded to "" in buildProfileYaml even when the member had
// answered them elsewhere.
export interface CareerOpsPolicy {
  /** compensation.minimum — the walk-away number. */
  minimumSalary?: string;
  /** compensation.location_flexibility */
  locationFlexibility?: string;
  /** location.visa_status — free text. */
  visaStatus?: string;
  /** location.needs_sponsorship — hard blocker when a JD says it won't sponsor. */
  needsSponsorship?: boolean;
  /** location.authorized_in — countries where work authorization is already held. */
  authorizedIn?: string[];
}

// ---- artefacts (Packer spec, profile.yml top-level `narrative` · `stories` · `snapshots`) ----
//
// Stored and exported so a member's profile.yml round-trips without loss. Read
// and edited on JobHacking → Artefacts → Story Bank (lib/jobhacking/story-bank.ts);
// an upload replaces them as one section.

/** narrative.proofPoints[] — a named result, the one number that proves it, and where it is shown (2026-11-07: `url`). */
export interface ProofPoint { name: string; heroMetric?: string; url?: string }
/**
 * narrative — the proof points, plus (2026-11-07, the Narrative file) the positioning line and the
 * superpowers the Packer writes: `headline` is "I help … through …", `superpowers` the three to five skills.
 */
export interface Narrative { proofPoints?: ProofPoint[]; headline?: string; superpowers?: string[] }
/** stories[] — one interview story as STAR-R (2026-11-07: situation · task · action · reflection beside the result), and how sure the member is of the figure. */
export interface Story { id?: string; title: string; situation?: string; task?: string; action?: string; result?: string; reflection?: string; provenance?: string }
/** snapshots[] — a story pointed at one target company: the figures to lead with, and (2026-11-07) the context, challenge, role, activities, relevance and key decisions behind them. */
export interface Snapshot {
  company: string; storyId?: string; title?: string;
  context?: string; challenge?: string; role?: string; activities?: string[]; results?: string[]; relevance?: string; keyDecisions?: string[];
}

// ---- LinkedIn profile (profile.yml top-level `linkedin`; added 2026-11-05) ----
//
// The LinkedIn profile as the member builds it: one block per LinkedIn section,
// written to be pasted — headline, About, each role's description, the Featured
// strip, skills, education, certifications. Mirrors LinkedIn's own sections so
// the portal can show each block against LinkedIn's limit with a Copy button.
// Read on JobHacking → Artefacts → LinkedIn profile; edited nowhere. The URL
// stays contact.linkedin; what the member is open to stays the goal.

export type LinkedinFeaturedKind = "link" | "post" | "article" | "document";
/** One Experience entry. `start` / `end` are "YYYY-MM" (or "YYYY"); an empty `end` is Present. */
export interface LinkedinExperience { title: string; company: string; location?: string; start?: string; end?: string; description?: string; skills?: string[] }
export interface LinkedinFeatured { kind?: LinkedinFeaturedKind; title: string; url?: string }
export interface LinkedinEducation { school: string; degree?: string; field?: string; start?: string; end?: string }
export interface LinkedinCertification { name: string; issuer?: string; issued?: string; url?: string }
export interface LinkedinProfile {
  headline?: string;
  about?: string;
  experience?: LinkedinExperience[];
  featured?: LinkedinFeatured[];
  /** The first three are the pinned Top skills. */
  skills?: string[];
  education?: LinkedinEducation[];
  certifications?: LinkedinCertification[];
}

// ---- company lists (Packer spec, profile.yml top-level `companyLists`; added 2026-11-05) ----
//
// The coach's ranked target companies: Top 3 · Top 10 · the whole field (`all`,
// shown as "Top 40"), each split sunrise (growing) / sunset (shrinking) /
// unclassified. Read-only in the portal — the Packer writes them, the member
// reads them on JobHacking → Target companies. The watchlist above stays the
// Scout's config; these never feed it.

export type CompanyTrend = "sunrise" | "sunset" | "unclassified";
/** How the careers URL got there: the coach confirmed it, the coach opened it (unverified), the coach corrected the one found (2026-11-07), or there is none. */
export type CareersUrlStatus = "confirmed" | "opened_by_coach" | "corrected" | "none";
/** The Packer's four scores (1–5 each) and their total — why a company sits where it does in the ranking. */
export interface CompanyScores { growth?: number; interest?: number; access?: number; proof?: number; total?: number }
export interface RankedCompany {
  rank?: number;
  name: string;
  industry?: string;
  subSector?: string;
  /** Free text from the Packer ("scaleup", "established") — see companyTypeLabel in lib/jobhacking/company-lists. */
  companyType?: string;
  careersUrl?: string;
  careersUrlStatus?: CareersUrlStatus;
  scores?: CompanyScores;
}
export type CompanyList = Partial<Record<CompanyTrend, RankedCompany[]>>;
export interface CompanyLists { top3?: CompanyList; top10?: CompanyList; all?: CompanyList }

// ---- the JobHackers workbook (profile.yml top-level `jhg`; added 2026-11-07) ----
//
// The four Packer files — narrative.yml · true-north.yml · target-companies.yml ·
// artefacts.yml — each carry a `jhg` block: the file's progress stamp, the
// member's identity as the coach has it, and the working data behind the
// sections above (titles and clusters behind the roles, boundaries behind the
// policy, scores and theses behind the ranked lists, story facts behind the
// stories). Stored whole and exported again so nothing the coach wrote is lost
// before CareerOps reads it; the JobHacking pages show it beside the field it
// explains. Every key here is one the files carry — none is invented.

export type JhgFileKey = "narrative" | "trueNorth" | "targetCompanies" | "artefacts";
export interface JhgProgress { status?: string; updated?: string }
export interface JhgIdentity {
  fullName?: string; email?: string; city?: string; country?: string; location?: string; timezone?: string; outputLanguage?: string;
  alternateEmails?: string[]; preferredChannel?: string; contactNote?: string;
}
export interface JhgNarrative { leadSkills?: string[]; bridgeStoryOneLine?: string }
export interface JhgBoundaries {
  currency?: string; salaryLower?: string; salaryUpper?: string; salaryFloor?: string;
  authorizedIn?: string[]; needsSponsorship?: string; visaStatus?: string;
  willWorkIn?: string; exclude?: string; remote?: string; localHybrid?: string; relocate?: string; remoteTravel?: string;
  hardNos?: string[]; cultureMustHaves?: string[]; deprioritizeIfAbsent?: string; softDislikes?: string[];
  noticePeriodDays?: number; excludeLevels?: string[]; neverApply?: string[]; negotiationLines?: string[];
}
export interface JhgPosting { title: string; company?: string; location?: string; url?: string; phrases?: string[]; verified?: string }
export interface JhgTitles { target?: string[]; analog?: string[]; exclude?: string[] }
export interface JhgCluster { name: string; titles?: string[]; axes?: string[]; buys?: string; level?: string; fit?: string }
export interface JhgSubSector { name: string; growthSignal?: string; source?: string; outlook?: string; confirmed?: string }
export interface JhgIndustry { name: string; subSectors?: JhgSubSector[] }
export interface JhgTrueNorth {
  boundaries?: JhgBoundaries; postings?: JhgPosting[]; keepers?: string[]; titles?: JhgTitles; clusters?: JhgCluster[]; industries?: JhgIndustry[]; companyType?: string;
}
/** One researched company — the whole field behind the Top 40, with the growth signal and the scores. */
export interface JhgCompany {
  rank?: number; name: string; companyType?: string; inspiredBy?: string; industry?: string; subSector?: string; outlook?: string; location?: string; website?: string;
  growthSignal?: string; growthSource?: string; knownContact?: string; careersUrl?: string; careersUrlStatus?: string; scores?: CompanyScores;
}
export interface JhgChallenge { company: string; challenge?: string; resolution?: string }
/** The Top 10 as the coach worked them: who hires, who the member knows, the thesis and the business problem it answers. */
export interface JhgTop10 {
  rank?: number; name: string; careersUrl?: string; careersUrlStatus?: string; careersUrlNote?: string; hiringAuthorityTitle?: string; knownPerson?: string;
  thesis?: string; businessProblem?: string; sayItLoud?: string;
}
/** The Top 3 with the reason to move now, the first move, and the date to make it by. */
export interface JhgTop3 { name: string; whyNow?: string; firstMove?: string; byDate?: string }
export interface JhgTargetCompanies { companies?: JhgCompany[]; challenges?: JhgChallenge[]; top10?: JhgTop10[]; top3?: JhgTop3[] }
/** The fact behind a story: where it happened, the lead skill, the numbers and how the figure is sourced. */
export interface JhgStoryFact { id?: string; title: string; role?: string; leadSkill?: string; numbers?: string[]; sourceStatus?: string; sourceNote?: string }
export interface JhgLanguage { language: string; currentLevel?: string; targetLevel?: string; targetDate?: string; sentence?: string; countries?: string[] }
export interface JhgArtefacts { storyFacts?: JhgStoryFact[]; currentDomain?: string; cvHouseRules?: string[]; lockedSections?: string[]; languageLearning?: JhgLanguage[] }
export interface JhgBlock {
  progress?: Partial<Record<JhgFileKey, JhgProgress>>;
  identity?: JhgIdentity;
  narrative?: JhgNarrative;
  trueNorth?: JhgTrueNorth;
  targetCompanies?: JhgTargetCompanies;
  artefacts?: JhgArtefacts;
}

/** Which Packer file last filled each part of the profile — app bookkeeping for the Settings page, not a profile.yml field. */
export interface ProfileFileRecord { filename: string; at: number }

export interface CareerOpsSetupV2 extends CareerOpsSetup {
  portals?: CareerOpsPortals;
  portalsYaml?: string;
  goalSource?: GoalSource;
  /** Captured in intake. Only in effect while goalSource is "intake". */
  intakeGoal?: Goal;
  goalUpdatedAt?: number;
  contact?: CareerOpsContact;
  policy?: CareerOpsPolicy;
  /** The eight `## Your …` sections of career-ops' modes/_profile.md. */
  personalization?: Personalization;
  /** Rendered modes/_profile.md, stored for the worker and for transparency. */
  profileMd?: string;
  /** Artefacts carried by profile.yml (Packer spec). Read and edited on JobHacking → Artefacts → Story Bank. */
  narrative?: Narrative;
  stories?: Story[];
  snapshots?: Snapshot[];
  /** The Packer's ranked company lists (profile.yml `companyLists`). Read on JobHacking → Target companies; edited nowhere. */
  companyLists?: CompanyLists;
  /** The LinkedIn profile to build (profile.yml `linkedin`). Read on JobHacking → Artefacts → LinkedIn profile; edited nowhere. */
  linkedin?: LinkedinProfile;
  /** The JobHackers workbook (profile.yml `jhg`), merged from the four Packer files. Read beside the fields it explains; edited nowhere. */
  jhg?: JhgBlock;
  /** When each of the four files was last unpacked, and from which filename (JobHacking → Settings). */
  profileFiles?: Partial<Record<JhgFileKey, ProfileFileRecord>>;
}

// users/{uid}/careerOps/portalsStatus — what happened to each watchlist company on the last
// scan. Worker-written. method: "board" = career-ops read the ATS/job-board API directly;
// "page" = the Pi's browser scraped the careers page (slower, best effort); "none" = nothing worked.
// suggested: the job board the Scout found behind a marketing careers page (Workday link, branded
// SuccessFactors host, …). It was already used for that scan; "Use this" copies it onto the row so it sticks.
export interface PortalSuggestion { careersUrl: string; provider: string | null; apiUrl: string | null; live: number | null; via: "link" | "fingerprint" }
export interface PortalStatus { name: string; careersUrl: string; method: "board" | "page" | "none"; provider?: string | null; found: number; matched: number; error?: string | null; hint?: string | null; ms?: number; sample?: string[]; suggested?: PortalSuggestion }   // sample: titles seen that did NOT match the keywords
export interface PortalsStatusDoc { at: number; jobId: string; companies: PortalStatus[] }

// users/{uid}/careerOpsPipeline/{id} — postings the Scout found (worker-written, owner-updatable).
export type PipelineStatus = "pending" | "evaluated" | "dismissed";
export interface PipelineItem {
  id: string;
  url: string;
  company: string;
  title: string;
  location: string | null;
  status: PipelineStatus;
  foundAt: number;
  lastSeenAt: number;
  reportJobId?: string;
  score?: number | null;
}

// users/{uid}/careerOpsDocs/{jobId} — a tailored CV or a cover letter tied to a report.
export type DocStorage = "drive" | "bucket" | "inline";
export interface CareerOpsDoc {
  id: string;
  kind: "cv" | "cover";
  jobId: string;
  reportJobId: string;
  company: string;
  role: string;
  file: string;
  storage: DocStorage;
  driveFileId?: string | null;
  driveLink?: string | null;
  storagePath?: string | null;
  url?: string | null;         // signed URL (bucket) — may expire
  urlExpires?: number | null;
  size: number;
  pageCount: number;
  template?: string;
  words?: number;              // cover letters
  text?: string;               // cover letters — plain text for copy/paste
  keywordsUsed?: string[];
  keywordsMissing?: string[];
  model: string;
  via: "n8n" | "ollama" | "claude-cli";
  durationMs: number;
  createdAt: number;
}

// ---- phase 4: training (admin-only collections, Admin SDK writes) ----

export type ExampleSource = "claude" | "live" | "golden";
export interface TrainingExample {
  id: string;
  agent: AgentKey;
  source: ExampleSource;
  split: "train" | "exam";
  approved: boolean;
  company: string;
  role: string;
  market?: string;
  intendedFit?: string;
  notes?: string;
  cv: string;
  profileYaml: string;
  jd: string;
  report: string;
  summary: { company: string; role: string; score: number | null; archetype: string; legitimacy: string };
  teacherModel?: string;
  studentPromptVersion?: number;
  memberUid?: string;          // live examples only (pseudonymised text; uid kept for deletion requests)
  createdAt: number;
  createdBy?: string;
  jobId?: string;
}
export type TrainingExampleRow = Omit<TrainingExample, "cv" | "profileYaml" | "jd" | "report">;

export interface TrainingDataset {
  name: string;
  agent: AgentKey;
  sources: ExampleSource[];
  bySource: Record<string, number>;
  train: number;
  exam: number;
  dir: string;
  promptVersion: number;
  builtAt: number;
  builtBy?: string;
}

export interface ExamResult {
  tag: string; n: number; scored: number;
  scoreMae: number | null; within05: number | null; archetypeAgreement: number | null; legitimacyAgreement: number | null; summaryRate: number | null;
  avgSeconds: number | null; at: number; promptVersion: number;
  cases?: { id: string; company: string; role?: string; seconds?: number; gold?: { score: number | null; archetype: string }; got?: { score: number | null; archetype: string }; scoreDiff?: number | null; archetypeMatch?: boolean; error?: string }[];
}

export interface TrainingModel {
  tag: string;
  agent: AgentKey;
  source: "finetune" | "import" | "ollama";
  status: "training" | "importing" | "ready" | "failed";
  base?: string | null;
  dataset?: string;
  epochs?: number;
  exam?: ExamResult;
  error?: string;
  startedAt?: number;
  endedAt?: number;
  createdBy?: string;
}

export const FINETUNE_BASES = ["unsloth/Qwen2.5-1.5B-Instruct", "unsloth/Llama-3.2-3B-Instruct", "unsloth/Qwen2.5-3B-Instruct", "unsloth/Llama-3.2-1B-Instruct"] as const;

// ---- CareerOps portal: generic agent outputs ----

// users/{uid}/careerOpsNotes/{jobId} — every non-report, non-PDF thing an agent produces:
// a company deep-dive, an outreach DM, application answers, interview prep, a follow-up
// draft, a training/project verdict, a patterns analysis. Worker-written, owner-readable.
export type NoteKind = "deep" | "contacto" | "apply" | "apply_form" | "apply_fill" | "interview_prep" | "followup" | "training" | "project" | "patterns";
export interface CareerOpsNote {
  id: string;
  jobId: string;
  kind: NoteKind;
  title: string;
  company?: string | null;
  role?: string | null;
  reportJobId?: string | null;
  opportunityId?: string | null;
  markdown: string;             // what the member reads
  data?: Record<string, unknown>; // structured extras (answers[], dm, stats…)
  sources?: { title: string; url: string }[];   // web sources when the Researcher used search
  agent: AgentKey;
  model: string;
  via: "n8n" | "ollama" | "claude" | "claude-cli" | "claude-api" | "bank" | "script";   // bank: every answer came from the answer bank · script: no model (form reader)
  durationMs: number;
  createdAt: number;
}
export const NOTE_KIND_LABELS: Record<NoteKind, string> = {
  deep: "Company deep-dive", contacto: "Outreach", apply: "Application answers", apply_form: "Application form", apply_fill: "Filled in the portal", interview_prep: "Interview prep",
  followup: "Follow-up", training: "Training verdict", project: "Project verdict", patterns: "Patterns",
};

// users/{uid}/careerOps/followup — cadence rules per Progress-board stage (days of silence before a nudge is due).
export interface FollowupRules { days: Record<string, number>; updatedAt?: number }
export const DEFAULT_FOLLOWUP_DAYS: Record<string, number> = { outreach: 5, application: 7, info_interview: 3, job_interview: 2, offer: 2, negotiation: 3 };
export const CONTACT_TARGETS = [
  { key: "hiring_manager", label: "Hiring manager" },
  { key: "recruiter", label: "Recruiter" },
  { key: "peer", label: "Team peer" },
  { key: "interviewer", label: "Interviewer" },
] as const;
export type ContactTarget = (typeof CONTACT_TARGETS)[number]["key"];
export const PREP_AUDIENCES = [
  { key: "recruiter", label: "Recruiter screen" },
  { key: "hiring_manager", label: "Hiring manager" },
  { key: "peer", label: "Peer / technical" },
  { key: "panel", label: "Panel" },
] as const;
export type PrepAudience = (typeof PREP_AUDIENCES)[number]["key"];
