// Coach 2 — True North, as a script (docs/UX_JOURNEY_SCRIPTED_COACH.md §3; docs/UX_SCRIPTED_COACH.md §2). The prompt's
// fifteen Part A questions grouped by decision into seven steps and a save point; Part B's postings as the job it already
// is, the keepers and the titles as picks over what the job found. The clusters and Part C stay with the conversation
// until their draft and research jobs exist — the engine hands over when the script has nothing left to ask.
//
// Every derived key the prompt asks the model to write "exactly by these rules" is written here by the rule, on the step
// that gives it its inputs — goal.salary on the pay step, policy.locationFlexibility on the place steps, notes at the
// save point — so the statement fills in as the member answers. Pure — tested.

import type { ProfileFile } from "../../../careerops/profile-file";
import type { JhgBoundaries, JhgPosting } from "../../../careerops/types";
import { asList, asRecord, asString, figure } from "./values";
import type { CoachScript, FieldOption, Step, StepValues } from "./types";

export const CURRENCIES = ["NZD", "AUD", "USD", "CAD", "JPY", "GBP", "EUR", "SGD"] as const;
const YN: FieldOption[] = [{ value: "Y", label: "Yes" }, { value: "N", label: "No" }];
const b = (p: ProfileFile): JhgBoundaries => p.jhg?.trueNorth?.boundaries ?? {};
const postingsOf = (p: ProfileFile): JhgPosting[] => p.jhg?.trueNorth?.postings ?? [];
const def = (v: unknown) => v !== undefined && v !== null;
const list = (v: unknown) => Array.isArray(v) && v.length > 0;
const joinSemi = (xs: readonly string[] | undefined) => (xs ?? []).join("; ");

// ---- the derived keys, by the prompt's rules ----

/** goal.salary · policy.minimumSalary · personalization.compTargets, from the pay boundaries. */
export function derivePay(n: JhgBoundaries): Record<string, unknown> {
  if (!n.currency || !n.salaryLower || !n.salaryUpper || !n.salaryFloor) return {};
  return {
    goal: { salary: `${n.currency} ${n.salaryLower}–${n.salaryUpper}` },
    policy: { minimumSalary: `${n.currency} ${n.salaryFloor}` },
    personalization: { compTargets: `Target ${n.currency} ${n.salaryLower}–${n.salaryUpper}; floor ${n.currency} ${n.salaryFloor}.` },
  };
}

/** policy.locationFlexibility · personalization.locationPolicy, from the place boundaries as they stand. */
export function derivePlace(n: JhgBoundaries): Record<string, unknown> {
  const flex = [n.remote && `Remote: ${n.remote}`, n.localHybrid && `Local hybrid: ${n.localHybrid}`, n.relocate && `Relocate: ${n.relocate}`].filter(Boolean).join("; ");
  const policy = [
    n.willWorkIn && `Will work in: ${n.willWorkIn}`, n.exclude && `Exclude: ${n.exclude}`, n.remote && `Remote: ${n.remote}`,
    n.localHybrid && `Local hybrid: ${n.localHybrid}`, n.relocate && `Relocate: ${n.relocate}`, n.remoteTravel && `Travel for a remote role elsewhere: ${n.remoteTravel}`,
  ].filter((x): x is string => !!x).slice(0, 8);
  return { ...(flex ? { policy: { locationFlexibility: flex } } : {}), ...(policy.length ? { personalization: { locationPolicy: policy } } : {}) };
}

/** The §6 notes block — lines in the prompt's order, each left out when its source is empty. */
export function notesBlock(n: JhgBoundaries): string {
  return [
    n.hardNos?.length && `Hard no's (do not apply): ${joinSemi(n.hardNos)}`,
    n.cultureMustHaves?.length && `Culture must-haves: ${joinSemi(n.cultureMustHaves)}; deprioritise when absent: ${n.deprioritizeIfAbsent || "N"}`,
    n.softDislikes?.length && `Soft dislikes (lower, not a no): ${joinSemi(n.softDislikes)}`,
    def(n.noticePeriodDays) && `Notice period: ${n.noticePeriodDays} days`,
    n.neverApply?.length && `Never apply: ${joinSemi(n.neverApply)}`,
  ].filter((x): x is string => typeof x === "string").join("\n");
}

/** Phrases the postings repeat, most frequent first — the keepers' options (code, never the model). */
export function phraseCounts(postings: readonly JhgPosting[]): { phrase: string; count: number }[] {
  const counts = new Map<string, { phrase: string; count: number }>();
  for (const p of postings) for (const ph of p.phrases ?? []) {
    const k = ph.trim().toLowerCase();
    if (!k) continue;
    const e = counts.get(k);
    if (e) e.count++; else counts.set(k, { phrase: ph.trim(), count: 1 });
  }
  return [...counts.values()].sort((a, c) => c.count - a.count);
}

/** The titles the postings repeat (twice or more), in order of first appearance; every distinct title when fewer than three repeat. */
export function repeatedTitles(postings: readonly JhgPosting[], max = 12): string[] {
  const seen = new Map<string, { title: string; count: number }>();
  for (const p of postings) {
    const k = p.title?.trim().toLowerCase();
    if (!k) continue;
    const e = seen.get(k);
    if (e) e.count++; else seen.set(k, { title: p.title.trim(), count: 1 });
  }
  const all = [...seen.values()];
  const repeats = all.filter((t) => t.count >= 2);
  return (repeats.length >= 3 ? repeats : all).slice(0, max).map((t) => t.title);
}

const boundariesPatch = (values: StepValues, p: ProfileFile, keys: readonly (keyof JhgBoundaries)[], extra: (next: JhgBoundaries) => Record<string, unknown> = () => ({})) => {
  const part: Record<string, unknown> = {};
  for (const k of keys) {
    const v = values[k];
    if (v === undefined) continue;
    if (k === "noticePeriodDays") { const n = figure(asString(v)); if (n !== null) part[k] = Math.round(n); continue; }
    part[k] = Array.isArray(v) ? asList(v) : asString(v);
  }
  const next: JhgBoundaries = { ...b(p), ...(part as JhgBoundaries) };
  return deepMerge({ jhg: { trueNorth: { boundaries: part } } }, extra(next));
};

function deepMerge(a: Record<string, unknown>, c: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...a };
  for (const [k, v] of Object.entries(c)) {
    const cur = out[k];
    out[k] = cur && typeof cur === "object" && !Array.isArray(cur) && v && typeof v === "object" && !Array.isArray(v) ? deepMerge(cur as Record<string, unknown>, v as Record<string, unknown>) : v;
  }
  return out;
}

// ---- Part A · Boundaries ----

const pay: Step = {
  id: "pay", part: 0, sections: ["salary"],
  aside: "Before we aim, we set the fence.",
  question: "What's your target pay, per year?",
  help: "The range you aim at, and the floor below which you say no — in your own figures.",
  fields: [
    { key: "currency", label: "Currency", kind: "pick", options: CURRENCIES.map((c) => ({ value: c, label: c })) },
    { key: "salaryLower", label: "Lower", kind: "number", placeholder: "140,000" },
    { key: "salaryUpper", label: "Upper", kind: "number", placeholder: "170,000" },
    { key: "salaryFloor", label: "Floor", kind: "number", placeholder: "130,000", help: "Below this you say no." },
  ],
  validate: (v) => {
    const lo = figure(asString(v.salaryLower)), hi = figure(asString(v.salaryUpper)), fl = figure(asString(v.salaryFloor));
    const out: Record<string, string> = {};
    if (lo !== null && hi !== null && lo > hi) out.salaryUpper = "The upper end is below the lower";
    if (lo !== null && fl !== null && fl > lo) out.salaryFloor = "The floor is above the lower end";
    return out;
  },
  done: (p) => !!(b(p).currency && b(p).salaryLower && b(p).salaryUpper && b(p).salaryFloor),
  read: (p) => ({ currency: b(p).currency ?? "", salaryLower: b(p).salaryLower ?? "", salaryUpper: b(p).salaryUpper ?? "", salaryFloor: b(p).salaryFloor ?? "" }),
  patch: (v, p) => boundariesPatch(v, p, ["currency", "salaryLower", "salaryUpper", "salaryFloor"], derivePay),
  summary: (v) => `${asString(v.currency)} ${asString(v.salaryLower)}–${asString(v.salaryUpper)} · floor ${asString(v.salaryFloor)}`,
};

const rights: Step = {
  id: "rights", part: 0, sections: ["work-rights"],
  question: "Where can you work without sponsorship?",
  help: "The countries where you already hold work rights, and your status in one line.",
  fields: [
    { key: "authorizedIn", label: "Authorised in", kind: "chips", placeholder: "New Zealand, Australia", help: "Countries, separated by commas." },
    { key: "needsSponsorship", label: "Need sponsorship elsewhere?", kind: "pick", options: YN },
    { key: "visaStatus", label: "Your status", kind: "text", placeholder: "NZ citizen", max: 300 },
  ],
  done: (p) => list(b(p).authorizedIn) && !!b(p).needsSponsorship,
  read: (p) => ({ authorizedIn: b(p).authorizedIn ?? [], needsSponsorship: b(p).needsSponsorship ?? "", visaStatus: b(p).visaStatus ?? "" }),
  patch: (v, p) => boundariesPatch(v, p, ["authorizedIn", "needsSponsorship", "visaStatus"], (n) => ({ policy: { visaStatus: n.visaStatus, authorizedIn: n.authorizedIn, needsSponsorship: n.needsSponsorship === "Y" } })),
  summary: (v) => `${asList(v.authorizedIn).join(", ")} · ${asString(v.needsSponsorship) === "Y" ? "needs sponsorship elsewhere" : "no sponsorship needed"}${asString(v.visaStatus) ? ` · ${asString(v.visaStatus)}` : ""}`,
};

const place: Step = {
  id: "place", part: 0, sections: ["location"],
  question: "Where will you work?",
  help: "The cities you'd take a role in, places you rule out, and your terms on remote and hybrid.",
  fields: [
    { key: "willWorkIn", label: "Will work in", kind: "text", placeholder: "Auckland, Wellington", max: 300 },
    { key: "exclude", label: "Exclude", kind: "text", placeholder: "Nothing", max: 300, optional: true },
    { key: "remote", label: "Remote", kind: "text", placeholder: "Yes, NZ time zones", max: 300, help: "Yes or no, and any condition." },
    { key: "localHybrid", label: "Hybrid days", kind: "text", placeholder: "Up to 3 days on site; 4+ raises the floor", max: 300, help: "Days on site, and whether that changes your floor." },
  ],
  done: (p) => !!(b(p).willWorkIn && b(p).remote && b(p).localHybrid),
  read: (p) => ({ willWorkIn: b(p).willWorkIn ?? "", exclude: b(p).exclude ?? "", remote: b(p).remote ?? "", localHybrid: b(p).localHybrid ?? "" }),
  patch: (v, p) => boundariesPatch(v, p, ["willWorkIn", "exclude", "remote", "localHybrid"], derivePlace),
  summary: (v) => [asString(v.willWorkIn), asString(v.exclude) && `not ${asString(v.exclude)}`, `remote: ${asString(v.remote)}`, `hybrid: ${asString(v.localHybrid)}`].filter(Boolean).join(" · "),
};

const move: Step = {
  id: "move", part: 0, sections: ["location"],
  question: "Would you move, or travel?",
  help: "Relocation on what terms, and how much on-site travel you'd accept for a remote role based elsewhere.",
  fields: [
    { key: "relocate", label: "Relocate", kind: "text", placeholder: "No — or: to Australia, with a package", max: 300 },
    { key: "remoteTravel", label: "Travel for a remote role", kind: "text", placeholder: "A week a quarter", max: 300 },
  ],
  done: (p) => !!(b(p).relocate && b(p).remoteTravel),
  read: (p) => ({ relocate: b(p).relocate ?? "", remoteTravel: b(p).remoteTravel ?? "" }),
  patch: (v, p) => boundariesPatch(v, p, ["relocate", "remoteTravel"], derivePlace),
  summary: (v) => `relocate: ${asString(v.relocate)} · travel: ${asString(v.remoteTravel)}`,
};

const culture: Step = {
  id: "culture", part: 0, sections: ["boundaries"],
  question: "What must the culture have?",
  help: "Two or three things — including anything about the hiring process — and whether a posting without them drops down the list.",
  skipValues: { cultureMustHaves: [], deprioritizeIfAbsent: "", softDislikes: [] },
  fields: [
    { key: "cultureMustHaves", label: "Must-haves", kind: "chips", max: 3, placeholder: "Clear decision rights, a hiring process under 4 weeks" },
    { key: "deprioritizeIfAbsent", label: "Drop a posting without them?", kind: "pick", options: YN },
    { key: "softDislikes", label: "Soft dislikes", kind: "chips", optional: true, placeholder: "Lower it, don't rule it out", help: "Things that lower a posting without ruling it out." },
  ],
  done: (p) => list(b(p).cultureMustHaves) && !!b(p).deprioritizeIfAbsent,
  read: (p) => ({ cultureMustHaves: b(p).cultureMustHaves ?? [], deprioritizeIfAbsent: b(p).deprioritizeIfAbsent ?? "", softDislikes: b(p).softDislikes ?? [] }),
  patch: (v, p) => boundariesPatch(v, p, ["cultureMustHaves", "deprioritizeIfAbsent", "softDislikes"]),
  summary: (v) => asList(v.cultureMustHaves).length ? `${asList(v.cultureMustHaves).join(", ")} · ${asString(v.deprioritizeIfAbsent) === "Y" ? "drop a posting without them" : "nice to have"}${asList(v.softDislikes).length ? ` · dislikes: ${asList(v.softDislikes).join(", ")}` : ""}` : "Culture: I don't know yet",
};

const never: Step = {
  id: "never", part: 0, sections: ["boundaries"],
  question: "What rules a role out before anyone scores it?",
  help: "Hard no's, the seniority levels you won't apply at, the companies you'd never join — and your notice period.",
  fields: [
    { key: "hardNos", label: "Hard no's", kind: "chips", placeholder: "On-call weekends, 100% travel" },
    { key: "excludeLevels", label: "Levels to exclude", kind: "chips", optional: true, placeholder: "Junior, Director", help: "As the postings write them." },
    { key: "neverApply", label: "Never apply", kind: "chips", optional: true, placeholder: "Company names" },
    { key: "noticePeriodDays", label: "Notice period, days", kind: "number", placeholder: "28" },
  ],
  done: (p) => list(b(p).hardNos) && def(b(p).noticePeriodDays),
  read: (p) => ({ hardNos: b(p).hardNos ?? [], excludeLevels: b(p).excludeLevels ?? [], neverApply: b(p).neverApply ?? [], noticePeriodDays: def(b(p).noticePeriodDays) ? String(b(p).noticePeriodDays) : "" }),
  patch: (v, p) => boundariesPatch(v, p, ["hardNos", "excludeLevels", "neverApply", "noticePeriodDays"]),
  summary: (v) => [`no: ${asList(v.hardNos).join(", ")}`, asList(v.excludeLevels).length && `not ${asList(v.excludeLevels).join(", ")}`, asList(v.neverApply).length && `never ${asList(v.neverApply).join(", ")}`, `${asString(v.noticePeriodDays)} days' notice`].filter(Boolean).join(" · "),
};

const negotiation: Step = {
  id: "negotiation", part: 0, sections: ["salary"],
  question: "What would you actually say in a negotiation?",
  help: "Up to three lines you'd use — not what you'd like to be able to say.",
  skipValues: { negotiationLines: [] },
  fields: [{ key: "negotiationLines", label: "Your lines", kind: "chips", max: 3, placeholder: "One per line", help: "One line each, up to three." }],
  done: (p) => list(b(p).negotiationLines),
  read: (p) => ({ negotiationLines: b(p).negotiationLines ?? [] }),
  patch: (v, p) => boundariesPatch(v, p, ["negotiationLines"], (n) => (n.negotiationLines?.length ? { personalization: { negotiationScripts: n.negotiationLines.slice(0, 6) } } : {})),
  summary: (v) => asList(v.negotiationLines).length ? asList(v.negotiationLines).map((l) => `“${l}”`).join(" · ") : "Negotiation lines: I don't know yet",
};

const reviewA: Step = {
  id: "review-a", part: 0, sections: ["boundaries"], kind: "review", progress: "in_progress", action: "Looks right",
  question: "Your boundaries are on the page — have a look.",
  help: "Salary range, Location and Boundaries hold what you just said. Change any row from here, or on the page itself.",
  fields: [],
  done: (p) => !!p.notes && /Hard no's/.test(p.notes),
  read: () => ({}),
  patch: (_v, p) => ({ notes: notesBlock(b(p)) }),
  summary: () => "Boundaries confirmed",
};

// ---- Part B · What the market posts ----

const POSTINGS_JOB = "postings";
const postingsRunning = (ctx: { jobs: readonly { type: string; status: string }[] }) => ctx.jobs.some((j) => j.type === POSTINGS_JOB && (j.status === "queued" || j.status === "running"));

const boards: Step = {
  id: "boards", part: 1, sections: ["roles"], kind: "job", action: "Read the postings",
  aside: "The portal does the search; deciding is yours.",
  question: "Which job boards do you already check?",
  help: "The portal reads live postings for your competencies now — a minute or two. Add any titles you already have in mind.",
  fields: [
    { key: "boards", label: "Job boards", kind: "chips", optional: true, placeholder: "Seek, LinkedIn", max: 6 },
    { key: "titles", label: "Titles in mind", kind: "chips", optional: true, placeholder: "Delivery Lead, Head of Delivery", max: 6 },
  ],
  job: { type: POSTINGS_JOB, action: "Read the postings", payload: (v) => ({ ...(asList(v.boards).length ? { boards: asList(v.boards) } : {}), ...(asList(v.titles).length ? { titles: asList(v.titles) } : {}) }) },
  done: (p, ctx) => postingsOf(p).length > 0 || postingsRunning(ctx),
  read: () => ({ boards: [], titles: [] }),
  patch: () => ({}),
  summary: (v) => [asList(v.boards).join(", "), asList(v.titles).length && `titles: ${asList(v.titles).join(", ")}`].filter(Boolean).join(" · ") || "Reading the postings",
};

const keepers: Step = {
  id: "keepers", part: 1, sections: ["roles"],
  question: "Which phrases keep coming back?",
  help: "The portal counted them across your postings — pick three to five you'd put on your CV tomorrow.",
  fields: (p) => {
    const counts = phraseCounts(postingsOf(p)).slice(0, 10);
    const stored = p.jhg?.trueNorth?.keepers ?? [];
    const options: FieldOption[] = counts.map((c) => ({ value: c.phrase, label: c.phrase, hint: c.count > 1 ? `in ${c.count} postings` : undefined }));
    for (const k of stored) if (!options.some((o) => o.value.toLowerCase() === k.toLowerCase())) options.push({ value: k, label: k });
    return [{ key: "keepers", label: "Keepers", kind: "multi", options, min: Math.min(3, options.length), max: 5 }];
  },
  available: (p, ctx) => postingsOf(p).length > 0 && !postingsRunning(ctx),
  done: (p) => list(p.jhg?.trueNorth?.keepers),
  read: (p) => ({ keepers: p.jhg?.trueNorth?.keepers ?? [] }),
  patch: (v) => ({ jhg: { trueNorth: { keepers: asList(v.keepers).slice(0, 5) } } }),
  summary: (v) => asList(v.keepers).join(" · "),
};

const BUCKETS: FieldOption[] = [{ value: "target", label: "Target" }, { value: "analog", label: "Analog", hint: "same work, another name" }, { value: "exclude", label: "Exclude" }];

const titles: Step = {
  id: "titles", part: 1, sections: ["roles"],
  question: "Which titles are yours?",
  help: "Every title your postings repeat — target, analog (the same work under another name) or exclude. At least one target and one exclude.",
  fields: (p) => {
    const rows = repeatedTitles(postingsOf(p));
    const t = p.jhg?.trueNorth?.titles ?? {};
    for (const x of [...(t.target ?? []), ...(t.analog ?? []), ...(t.exclude ?? [])]) if (!rows.some((r) => r.toLowerCase() === x.toLowerCase())) rows.push(x);
    return [{ key: "titles", label: "Titles", kind: "bucket", rows, options: BUCKETS }];
  },
  available: (p, ctx) => postingsOf(p).length > 0 && !postingsRunning(ctx),
  validate: (v) => {
    const r = Object.values(asRecord(v.titles));
    const out: Record<string, string> = {};
    if (r.length && !r.includes("target")) out.titles = "At least one title is a target";
    else if (r.length && !r.includes("exclude")) out.titles = "At least one title to exclude — staying open to everything reads as clear about nothing";
    return out;
  },
  done: (p) => list(p.jhg?.trueNorth?.titles?.target),
  read: (p) => {
    const t = p.jhg?.trueNorth?.titles ?? {};
    const r: Record<string, string> = {};
    for (const x of t.target ?? []) r[x] = "target";
    for (const x of t.analog ?? []) r[x] = "analog";
    for (const x of t.exclude ?? []) r[x] = "exclude";
    return { titles: r };
  },
  patch: (v, p) => {
    const r = asRecord(v.titles);
    const by = (k: string) => Object.entries(r).filter(([, c]) => c === k).map(([t]) => t);
    const target = by("target"), analog = by("analog"), exclude = by("exclude");
    return { jhg: { trueNorth: { titles: { target, analog, exclude } } }, watchlist: { positive: target, negative: [...exclude, ...(b(p).excludeLevels ?? [])] } };
  },
  summary: (v) => {
    const r = asRecord(v.titles);
    const by = (k: string) => Object.entries(r).filter(([, c]) => c === k).map(([t]) => t);
    return [`target: ${by("target").join(", ")}`, by("analog").length && `analog: ${by("analog").join(", ")}`, `exclude: ${by("exclude").join(", ")}`].filter(Boolean).join(" · ");
  },
};

export const TRUE_NORTH_SCRIPT: CoachScript = { coach: "trueNorth", steps: [pay, rights, place, move, culture, never, negotiation, reviewA, boards, keepers, titles] };
