// JobHacking → Artefacts → Story Bank — docs/UX_JOBHACKING.md §3d.
//
// The Packer's artefacts, read as the member's story bank: narrative.proofPoints
// (a named result and the one number that proves it), stories (what happened,
// how sure the member is of the figure) and snapshots (a story pointed at one
// target company, with the figures to lead with). Read-only in the portal —
// the Packer writes them, the member reads them here; nothing here invents a
// field. Pure — no React. Tested.

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
