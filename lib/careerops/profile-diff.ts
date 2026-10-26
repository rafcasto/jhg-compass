// What an uploaded profile.yml would change — per section, before anything is
// written. The review step renders exactly this.
//
// Honest about the patch's semantics (profileToSetupPatch): a section that is
// in the file REPLACES the stored section as a whole, so a stored field the
// file does not carry is dropped — and that is reported as "drops", never
// hidden. A section absent from the file is left exactly as it is.
//
// Pure — no React. Tested.

import type { ProfileFile } from "./profile-file";
import { SECTIONS, SECTION_COPY, type Personalization } from "./personalization";
import { cvReadiness } from "./intake";
import type { ActiveSectionKey } from "@/lib/profile-sections";

export type DiffKind = "add" | "replace" | "keep";

export interface SectionDiff {
  key: ActiveSectionKey;
  /** Whether the file carries this section at all. */
  inFile: boolean;
  kind: DiffKind;
  /** The one-line verdict: "replaces", "adds 4, keeps 1", "not in the file — left as it is". */
  headline: string;
  /** Optional second line quoting the change. */
  detail?: string;
}

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const list = (xs: string[]) => xs.join(", ");

function fieldDiff(cur: Record<string, unknown>, inc: Record<string, unknown>) {
  const added: string[] = [], replaced: string[] = [], kept: string[] = [], dropped: string[] = [];
  for (const k of Object.keys(inc)) {
    if (!(k in cur)) added.push(k);
    else if (same(cur[k], inc[k])) kept.push(k);
    else replaced.push(k);
  }
  for (const k of Object.keys(cur)) if (!(k in inc)) dropped.push(k);
  return { added, replaced, kept, dropped };
}

function counts({ added, replaced, kept, dropped }: ReturnType<typeof fieldDiff>): string {
  if (!added.length && !replaced.length && !dropped.length) return "same as now";
  const parts: string[] = [];
  if (replaced.length) parts.push(`replaces ${replaced.length}`);
  if (added.length) parts.push(`adds ${added.length}`);
  if (kept.length) parts.push(`keeps ${kept.length}`);
  if (dropped.length) parts.push(`drops ${dropped.length}`);
  return parts.join(", ");
}

const kindOf = (d: ReturnType<typeof fieldDiff>): DiffKind =>
  d.replaced.length || d.dropped.length ? "replace" : d.added.length ? "add" : "keep";

const absent = (key: ActiveSectionKey): SectionDiff => ({ key, inFile: false, kind: "keep", headline: "not in the file — left as it is" });

export function profileDiff(current: ProfileFile, incoming: ProfileFile): SectionDiff[] {
  const out: SectionDiff[] = [];

  // North Star — only counts when the file's goal has a role (the patch ignores it otherwise).
  if (incoming.goal) {
    if (!incoming.goal.role?.trim()) {
      out.push({ key: "northstar", inFile: true, kind: "keep", headline: "no job title in the file — not applied" });
    } else if (!current.goal?.role?.trim()) {
      out.push({ key: "northstar", inFile: true, kind: "add", headline: "adds", detail: incoming.goal.role });
    } else if (same(current.goal, incoming.goal)) {
      out.push({ key: "northstar", inFile: true, kind: "keep", headline: "same as now" });
    } else {
      const d = fieldDiff(current.goal as Record<string, unknown>, incoming.goal as Record<string, unknown>);
      out.push({
        key: "northstar", inFile: true, kind: "replace", headline: "replaces",
        detail: current.goal.role !== incoming.goal.role ? `${current.goal.role}  →  ${incoming.goal.role}` : `changes ${list(d.replaced.concat(d.added))}`,
      });
    }
  } else out.push(absent("northstar"));

  // Contact & logistics — two stored objects, one section.
  if (incoming.contact || incoming.policy) {
    const cur = { ...(current.contact ?? {}), ...(current.policy ?? {}) } as Record<string, unknown>;
    const inc = { ...(incoming.contact ?? {}), ...(incoming.policy ?? {}) } as Record<string, unknown>;
    // Only the halves the file carries are replaced; keep the other half's keys out of the comparison.
    if (!incoming.contact) for (const k of Object.keys(current.contact ?? {})) delete cur[k];
    if (!incoming.policy) for (const k of Object.keys(current.policy ?? {})) delete cur[k];
    const d = fieldDiff(cur, inc);
    const detail = [
      d.added.length ? `adds ${list(d.added)}` : "",
      d.replaced.length ? `replaces ${list(d.replaced)}` : "",
      d.dropped.length ? `drops ${list(d.dropped)}` : "",
    ].filter(Boolean).join(" · ");
    out.push({ key: "contact", inFile: true, kind: kindOf(d), headline: counts(d), detail: detail || undefined });
  } else out.push(absent("contact"));

  // Targeting — the eight sections.
  if (incoming.personalization) {
    const cur = (current.personalization ?? {}) as Record<string, unknown>;
    const inc = incoming.personalization as Record<string, unknown>;
    const d = fieldDiff(cur, inc);
    const name = (id: string) => SECTION_COPY[id as keyof Personalization].label.toLowerCase();
    const n = SECTIONS.filter((s) => inc[s.id] !== undefined).length;
    const detail = [
      d.replaced.length ? `replaces ${list(d.replaced.map(name))}` : "",
      d.added.length ? `adds ${list(d.added.map(name))}` : "",
      d.dropped.length ? `drops ${list(d.dropped.map(name))}` : "",
    ].filter(Boolean).join(" · ");
    out.push({ key: "targeting", inFile: true, kind: kindOf(d), headline: `${n} of ${SECTIONS.length} sections — ${counts(d)}`, detail: detail || undefined });
  } else out.push(absent("targeting"));

  // Watchlist — companies by name.
  if (incoming.watchlist?.companies.length) {
    const curNames = new Set((current.watchlist?.companies ?? []).map((c) => c.name));
    const incNames = incoming.watchlist.companies.map((c) => c.name);
    const added = incNames.filter((n) => !curNames.has(n));
    const dropped = [...curNames].filter((n) => !incNames.includes(n));
    const kept = incNames.length - added.length;
    const kind: DiffKind = !curNames.size ? "add" : same(current.watchlist, incoming.watchlist) ? "keep" : "replace";
    const headline = kind === "keep" ? "same as now" : `${incNames.length} ${incNames.length === 1 ? "company" : "companies"}, ${incoming.watchlist.positive.length} include, ${incoming.watchlist.negative.length} exclude`;
    const detail = kind === "keep" ? undefined : [
      added.length ? `adds ${list(added.slice(0, 5))}${added.length > 5 ? ` +${added.length - 5}` : ""}` : "",
      kept ? `keeps ${kept}` : "",
      dropped.length ? `drops ${list(dropped.slice(0, 5))}${dropped.length > 5 ? ` +${dropped.length - 5}` : ""}` : "",
    ].filter(Boolean).join(" · ");
    out.push({ key: "watchlist", inFile: true, kind, headline, detail: detail || undefined });
  } else out.push(absent("watchlist"));

  // Notes.
  if (incoming.notes) {
    const kind: DiffKind = !current.notes ? "add" : current.notes === incoming.notes ? "keep" : "replace";
    out.push({ key: "notes", inFile: true, kind, headline: kind === "add" ? "new" : kind === "keep" ? "same as now" : "replaces", detail: incoming.notes.split("\n")[0] });
  } else out.push(absent("notes"));

  // CV.
  if (incoming.cv) {
    const r = cvReadiness(incoming.cv);
    const kind: DiffKind = !current.cv ? "add" : current.cv === incoming.cv ? "keep" : "replace";
    out.push({ key: "cv", inFile: true, kind, headline: kind === "add" ? "adds" : kind === "keep" ? "same as now" : "replaces", detail: `${r.words} words · ${r.scoreable ? "Ready to score" : "A bit thin"}` });
  } else out.push(absent("cv"));

  return out;
}

/** True when at least one stored section would be overwritten — the cue to offer "Download current profile". */
export const diffReplaces = (diff: SectionDiff[]): boolean => diff.some((d) => d.kind === "replace");
