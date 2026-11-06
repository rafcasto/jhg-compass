// The four Packer files — docs/UX_JOBHACKING.md §4 (decision 2026-11-07).
//
// The Packer writes a member's profile as four .yml files, one per JobHacking
// page: narrative · true-north · target-companies · artefacts. Each is a
// subset of the one profile.yml schema, with a `jhg.progress.<file>` stamp
// that says which it is. The Settings page has one slot per file; a member
// drops one, or all four at once, and each lands in its slot. A whole
// profile.yml (no stamp) still works — it fills every slot.
//
// Pure — no React. Tested.

import type { ProfileFile } from "../careerops/profile-file";
import type { CareerOpsSetupV2, JhgFileKey } from "../careerops/types";
import type { FileSectionKey } from "../profile-sections";
import { JH_PAGES, type JhPageKey } from "./sections";
import { isoDate } from "./workbook";

export type { JhgFileKey };

export interface JhFile {
  key: JhgFileKey;
  /** The slot's name — the page it fills. */
  label: string;
  /** What the Packer names it. */
  filename: string;
  /** The JobHacking page it fills. */
  page: JhPageKey;
  /** One line: what is in it. */
  carries: string;
  /** The profile.yml sections it carries, for the review. */
  sections: readonly FileSectionKey[];
}

export const JH_FILES = [
  { key: "narrative", label: "Narrative", filename: "narrative.yml", page: "narrative", carries: "Contact details, bridge story, your headline and superpowers, lead skills.", sections: ["contact", "targeting", "narrative", "jhg"] },
  { key: "trueNorth", label: "True North", filename: "true-north.yml", page: "true-north", carries: "Target role, seniority, industry, salary and location; archetypes, comp and location policy; title keywords; boundaries, titles and clusters.", sections: ["northstar", "contact", "targeting", "watchlist", "notes", "jhg"] },
  { key: "targetCompanies", label: "Target companies", filename: "target-companies.yml", page: "companies", carries: "The watchlist, the ranked Top 3 · Top 10 · Top 40 with scores, and the research behind them.", sections: ["watchlist", "companyLists", "notes", "jhg"] },
  { key: "artefacts", label: "Artefacts", filename: "artefacts.yml", page: "artefacts", carries: "Proof points, STAR stories and snapshots, your master CV, the LinkedIn profile to build, adaptive framing and portfolio.", sections: ["contact", "targeting", "artefacts", "linkedin", "cv", "notes", "jhg"] },
] as const satisfies readonly JhFile[];

export const findJhFile = (key: string | null | undefined): JhFile | undefined => (JH_FILES as readonly JhFile[]).find((f) => f.key === key);
export const jhFilePage = (key: JhgFileKey) => JH_PAGES.find((p) => p.key === findJhFile(key)!.page)!;

const FILENAME_HINT: Record<JhgFileKey, RegExp> = {
  narrative: /narrative/i,
  trueNorth: /true[-_ ]?north/i,
  targetCompanies: /target[-_ ]?compan|companies/i,
  artefacts: /artefact|artifact/i,
};

/**
 * Which of the four a parsed file is: its own `jhg.progress` stamp first,
 * then the filename. null for a file that is neither — a whole profile.yml.
 */
export function detectJhFile(profile: Pick<ProfileFile, "jhg">, filename?: string): JhgFileKey | null {
  const stamped = (JH_FILES as readonly JhFile[]).filter((f) => !!profile.jhg?.progress?.[f.key]);
  if (stamped.length === 1) return stamped[0].key;
  if (stamped.length > 1) return null;
  const name = filename ?? "";
  const byName = (JH_FILES as readonly JhFile[]).find((f) => FILENAME_HINT[f.key].test(name));
  return byName?.key ?? null;
}

export interface JhFileStatus {
  key: JhgFileKey;
  /** The member has unpacked this file at least once. */
  uploaded: boolean;
  /** "narrative.sample.yml" — the last filename unpacked. */
  filename?: string;
  /** When it was unpacked here, as a date. */
  uploadedOn?: string;
  /** The Packer's own stamp from the file — "complete · 6 Nov 2026". */
  packer?: string;
}

/** The state of each slot on the Settings page. */
export function jhFileStatuses(setup: CareerOpsSetupV2 | null | undefined): JhFileStatus[] {
  return (JH_FILES as readonly JhFile[]).map((f) => {
    const rec = setup?.profileFiles?.[f.key];
    const stamp = setup?.jhg?.progress?.[f.key];
    const packer = stamp ? [stamp.status?.trim(), stamp.updated ? isoDate(stamp.updated) : ""].filter(Boolean).join(" · ") : "";
    return {
      key: f.key,
      uploaded: !!rec || !!stamp,
      filename: rec?.filename,
      uploadedOn: rec ? new Date(rec.at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : undefined,
      packer: packer || undefined,
    };
  });
}

/** "2 of 4 files uploaded" */
export const jhFilesProgress = (statuses: readonly JhFileStatus[]): { done: number; total: number } =>
  ({ done: statuses.filter((s) => s.uploaded).length, total: statuses.length });
