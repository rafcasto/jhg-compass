// JobHacking → Artefacts → Story Bank — docs/UX_JOBHACKING.md §3d.
//
// The artefacts as the member's story bank: narrative.proofPoints (a named
// result and the one number that proves it), stories (what happened, how sure
// the member is of the figure) and snapshots (a story pointed at one target
// company, with the figures to lead with). The Packer writes them; the member
// reads them here and, since 2026-11-05, edits them — add, change, remove —
// through the same three lists. Nothing here invents a field. Pure — no React. Tested.

import type { CareerOpsSetupV2, ProofPoint, Snapshot, Story } from "../careerops/types";

export interface StoryBankSource { narrative?: CareerOpsSetupV2["narrative"]; stories?: Story[]; snapshots?: Snapshot[] }

export interface StoryBankCounts { proofPoints: number; stories: number; snapshots: number; total: number }

const rows = <T,>(v: readonly T[] | null | undefined): T[] => (Array.isArray(v) ? v.filter(Boolean) : []);

export const proofPoints = (s: StoryBankSource | null | undefined): ProofPoint[] => rows(s?.narrative?.proofPoints).filter((p) => !!p.name?.trim());
export const stories = (s: StoryBankSource | null | undefined): Story[] => rows(s?.stories).filter((x) => !!x.title?.trim());
export const snapshots = (s: StoryBankSource | null | undefined): Snapshot[] => rows(s?.snapshots).filter((x) => !!x.company?.trim());

export function storyBankCounts(s: StoryBankSource | null | undefined): StoryBankCounts {
  const n = { proofPoints: proofPoints(s).length, stories: stories(s).length, snapshots: snapshots(s).length };
  return { ...n, total: n.proofPoints + n.stories + n.snapshots };
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** "3 stories · 3 proof points · 2 snapshots" — only the parts the file carries; "" when it carries none. */
export function storyBankSummary(s: StoryBankSource | null | undefined): string {
  const n = storyBankCounts(s);
  return [n.stories ? plural(n.stories, "story", "stories") : "", n.proofPoints ? plural(n.proofPoints, "proof point") : "", n.snapshots ? plural(n.snapshots, "snapshot") : ""]
    .filter(Boolean).join(" · ");
}

/** A story with the snapshots that point it at a company (matched on storyId). */
export interface StoryRow { story: Story; snapshots: Snapshot[] }

/** Stories in file order, each with its snapshots; then the snapshots no story claims (a dangling storyId, or none). */
export function storyRows(s: StoryBankSource | null | undefined): { stories: StoryRow[]; unlinked: Snapshot[] } {
  const all = snapshots(s);
  const claimed = new Set<Snapshot>();
  const out = stories(s).map((story) => {
    const id = story.id?.trim();
    const mine = id ? all.filter((snap) => snap.storyId?.trim() === id) : [];
    mine.forEach((m) => claimed.add(m));
    return { story, snapshots: mine };
  });
  return { stories: out, unlinked: all.filter((snap) => !claimed.has(snap)) };
}

/** The Packer's provenance word as the member reads it: "verified" → Verified; anything else is shown as written. */
export function provenanceLabel(v: string | null | undefined): string {
  const t = (v ?? "").trim();
  if (!t) return "";
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** "monthly → fortnightly" — the figures a snapshot leads with, in order. */
export const snapshotFigures = (snap: Snapshot): string => rows(snap.results).map((r) => r.trim()).filter(Boolean).join(" → ");

// ---- editing ----

/** The provenance words the Packer uses; a stored value outside them is kept and offered as it is. */
export const PROVENANCES = ["verified", "estimate"] as const;

/** 50 of each — the schema's row cap. */
export const STORY_BANK_CAP = 50;

/** What the editor holds: the three lists, blanks and all, as typed. */
export interface StoryBankDraft { proofPoints: ProofPoint[]; stories: Story[]; snapshots: Snapshot[] }

export const storyBankDraft = (s: StoryBankSource | null | undefined): StoryBankDraft => ({
  proofPoints: rows(s?.narrative?.proofPoints).map((p) => ({ ...p })),
  stories: rows(s?.stories).map((x) => ({ ...x })),
  snapshots: rows(s?.snapshots).map((x) => ({ ...x, results: [...(x.results ?? [])] })),
});

/** The next free "S<n>" — the Packer's own id shape, never reusing one still in the bank. */
export function nextStoryId(existing: readonly Story[]): string {
  const used = new Set(existing.map((s) => (s.id ?? "").trim()).filter(Boolean));
  let n = existing.length + 1;
  while (used.has(`S${n}`)) n += 1;
  // Fill a gap first: S1, S2, S4 → S3, so ids stay short.
  for (let i = 1; i <= existing.length + 1; i += 1) if (!used.has(`S${i}`)) return `S${i}`;
  return `S${n}`;
}

const trim = (v: string | undefined) => (v ?? "").trim();
const cleanRow = <T extends object>(o: T): T => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== "" && !(Array.isArray(v) && !v.length))) as T;

/**
 * What a save writes: strings trimmed, rows without their one required field dropped
 * (a proof point needs a name, a story a title, a snapshot a company), capped at 50
 * each, empty lists kept as empty lists so a cleared bank clears the document.
 */
export function cleanStoryBank(d: StoryBankDraft): { narrative: { proofPoints: ProofPoint[] }; stories: Story[]; snapshots: Snapshot[] } {
  // The editor edits a few fields of each row; the rest (a proof point's URL, a story's situation · task ·
  // action · reflection, a snapshot's context and activities — the Packer's, 2026-11-07) ride along untouched.
  const proofPoints = d.proofPoints.map((p) => cleanRow({ ...p, name: trim(p.name), heroMetric: trim(p.heroMetric) })).filter((p) => p.name).slice(0, STORY_BANK_CAP);
  const stories = d.stories.map((s) => cleanRow({ ...s, id: trim(s.id), title: trim(s.title), result: trim(s.result), provenance: trim(s.provenance) })).filter((s) => s.title).slice(0, STORY_BANK_CAP);
  const ids = new Set(stories.map((s) => s.id).filter(Boolean));
  const snapshots = d.snapshots
    .map((x) => cleanRow({ ...x, company: trim(x.company), storyId: ids.has(trim(x.storyId)) ? trim(x.storyId) : "", title: trim(x.title), results: rows(x.results).map((r) => r.trim()).filter(Boolean) }))
    .filter((x) => x.company).slice(0, STORY_BANK_CAP);
  return { narrative: { proofPoints }, stories, snapshots };
}

/** "Situation · Task · Action · Reflection" — the STAR-R lines of a story the Packer wrote, in order, only the ones present. */
export const storyStar = (s: Story): { label: string; text: string }[] =>
  ([["Situation", s.situation], ["Task", s.task], ["Action", s.action], ["Reflection", s.reflection]] as const)
    .filter(([, v]) => !!v?.trim()).map(([label, v]) => ({ label, text: v!.trim() }));

/** The lines a snapshot carries beyond its figures: context, challenge, role, activities, relevance, key decisions. */
export const snapshotDetail = (x: Snapshot): { label: string; text?: string; items?: string[] }[] =>
  ([
    { label: "Context", text: x.context?.trim() },
    { label: "Challenge", text: x.challenge?.trim() },
    { label: "Role", text: x.role?.trim() },
    { label: "What I did", items: rows(x.activities).map((a) => a.trim()).filter(Boolean) },
    { label: "Why it matters here", text: x.relevance?.trim() },
    { label: "Key decisions", items: rows(x.keyDecisions).map((a) => a.trim()).filter(Boolean) },
  ]).filter((d) => d.text || d.items?.length);
