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

import { profileToSetupPatch, type ProfileFile } from "../careerops/profile-file";
import type { DiffKind } from "../careerops/profile-diff";
import type { CareerOpsSetupV2, JhgFileKey } from "../careerops/types";
import type { FileSectionKey } from "../profile-sections";
import type { Profile } from "../types";
import { BASE_OF, findJhPage, jhFieldsEmpty, jhSectionFields, jhSectionHref, jhSectionSummaries, jhSectionsFor, type JhPageKey, type JhSectionKey, type PortalOptions } from "./sections";
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
  /** The profile.yml sections it carries. */
  sections: readonly FileSectionKey[];
  /** What the file carries that no section of its page shows — stored for the agents, said in one line under the preview. */
  alsoKept: string;
}

export const JH_FILES = [
  { key: "narrative", label: "Narrative", filename: "narrative.yml", page: "narrative", carries: "Contact details, headline, bridge story, core competencies.", sections: ["contact", "targeting", "narrative", "jhg"], alsoKept: "your lead skills and the one-line bridge story" },
  { key: "trueNorth", label: "True North", filename: "true-north.yml", page: "true-north", carries: "Target industry, roles, seniority, salary range, location, company type, boundaries.", sections: ["northstar", "contact", "targeting", "watchlist", "notes", "jhg"], alsoKept: "your title keywords, work rights, negotiation scripts and notes, and the titles, clusters and postings behind the roles" },
  { key: "targetCompanies", label: "Target companies", filename: "target-companies.yml", page: "companies", carries: "Top 3, Top 10, Top 40, watchlist.", sections: ["watchlist", "companyLists", "notes", "jhg"], alsoKept: "your notes and the research behind the lists" },
  { key: "artefacts", label: "Artefacts", filename: "artefacts.yml", page: "artefacts", carries: "Story Bank, master CV, LinkedIn profile.", sections: ["contact", "targeting", "artefacts", "linkedin", "cv", "notes", "jhg"], alsoKept: "your adaptive framing, portfolio, notes, CV house rules and story facts" },
] as const satisfies readonly JhFile[];

export const findJhFile = (key: string | null | undefined): JhFile | undefined => (JH_FILES as readonly JhFile[]).find((f) => f.key === key);
export const jhFilePage = (key: JhgFileKey) => findJhPage(findJhFile(key)!.page)!;

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

// ---- what a file writes, and what the preview says ----
//
// Rule (decision 2026-11-07): a file fills the editable fields of ITS page,
// and the upload preview lists exactly that page's sections — one row per
// section, in the page's order, nothing more, nothing less. The page's own
// file wins a field two files carry.

const text = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/** "Laurent Simon" → first name Laurent, last name Simon; a one-word name is a first name. */
export function splitFullName(fullName: string): { firstName: string; lastName: string } {
  const [first = "", ...rest] = fullName.trim().split(/\s+/).filter(Boolean);
  return { firstName: first, lastName: rest.join(" ") };
}

/**
 * The member's name as the Narrative file carries it (`jhg.identity.fullName`) — first and last
 * name live on the account (users/{uid}), not in the profile, so the unpack writes them there.
 * Null when the file is not the Narrative one or carries no name.
 */
export function jhFileName(key: JhgFileKey | null, incoming: Pick<ProfileFile, "jhg">): { firstName: string; lastName: string } | null {
  const full = key === "narrative" ? text(incoming.jhg?.identity?.fullName) : "";
  return full ? splitFullName(full) : null;
}

/** The account as it will be once the file is unpacked — the name from the file over what is stored. */
export function jhFileProfile(key: JhgFileKey | null, incoming: Pick<ProfileFile, "jhg">, profile: Profile | null | undefined): Profile | null | undefined {
  const name = jhFileName(key, incoming);
  if (!name) return profile;
  return { ...(profile ?? { email: "" }), ...name };
}

/**
 * The parsed file as the page reads it. The Narrative file's positioning line is the
 * Headline field, its superpowers are the Core competencies field, the coach's
 * location is the contact location. The Artefacts file carries a CV headline and core
 * competencies too; those belong to the Narrative page, so it fills them only while blank.
 */
export function shapeJhFile(key: JhgFileKey | null, incoming: ProfileFile, current: ProfileFile): ProfileFile {
  if (key === "narrative") {
    const out: ProfileFile = { ...incoming };
    const contact = { ...(incoming.contact ?? {}) };
    if (text(incoming.narrative?.headline)) contact.title = text(incoming.narrative?.headline);
    if (!text(contact.location) && text(incoming.jhg?.identity?.location)) contact.location = text(incoming.jhg?.identity?.location);
    if (Object.keys(contact).length) out.contact = contact;
    const superpowers = (incoming.narrative?.superpowers ?? []).map(text).filter(Boolean);
    if (superpowers.length) out.personalization = { ...(incoming.personalization ?? {}), crossCuttingAdvantage: text(incoming.personalization?.crossCuttingAdvantage) || superpowers.join("; ") };
    return out;
  }
  if (key === "artefacts") {
    const out: ProfileFile = { ...incoming };
    if (incoming.contact?.title !== undefined && text(current.contact?.title)) {
      const { title: _title, ...rest } = incoming.contact;
      out.contact = Object.keys(rest).length ? rest : undefined;
    }
    if (incoming.personalization?.crossCuttingAdvantage !== undefined && text(current.personalization?.crossCuttingAdvantage)) {
      const { crossCuttingAdvantage: _cca, ...rest } = incoming.personalization;
      out.personalization = Object.keys(rest).length ? rest : undefined;
    }
    return out;
  }
  return incoming;
}

export interface JhPreviewRow {
  key: JhSectionKey;
  label: string;
  href: string;
  /** Whether the file carries anything for this section. */
  inFile: boolean;
  kind: DiffKind;
  /** "adds" · "replaces" · "same as now" · "not in the file — left as it is". */
  headline: string;
  /** The section's row line as it will read after the unpack. */
  detail?: string;
}

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/**
 * One row per section of the file's page: what the file carries for it, and whether
 * that adds, replaces or keeps what is stored — `before` is the setup as it is,
 * `after` as it will be once this file (and any before it) is unpacked.
 */
export function jhFilePreview(key: JhgFileKey, shaped: ProfileFile, before: Partial<CareerOpsSetupV2> | null | undefined, after: Partial<CareerOpsSetupV2>, profile: Profile | null | undefined, opts: PortalOptions = {}): JhPreviewRow[] {
  const page = findJhFile(key)!.page;
  const base = BASE_OF[opts.portal ?? "jobhacking"];
  const fileOnly = profileToSetupPatch(shaped).setup;
  // The Narrative file also carries the member's name, which the Contact details editor shows from the account.
  const fileName = jhFileName(key, shaped);
  const fileProfile: Profile | null = fileName ? { email: "", ...fileName } : null;
  const profileAfter = jhFileProfile(key, shaped, profile);
  const afterRows = new Map(jhSectionSummaries({ setup: after as CareerOpsSetupV2, profile: profileAfter }).map((r) => [r.key, r]));
  return jhSectionsFor(page, opts).map((s) => {
    const base_ = { key: s.key, label: s.label, href: jhSectionHref(s.key, base) };
    const inFile = !jhFieldsEmpty(jhSectionFields(s.key, { setup: fileOnly as CareerOpsSetupV2, profile: fileProfile }));
    if (!inFile) return { ...base_, inFile, kind: "keep", headline: "not in the file — left as it is" };
    const b = jhSectionFields(s.key, { setup: before as CareerOpsSetupV2, profile });
    const a = jhSectionFields(s.key, { setup: after as CareerOpsSetupV2, profile: profileAfter });
    const kind: DiffKind = jhFieldsEmpty(b) ? "add" : same(a, b) ? "keep" : "replace";
    const detail = afterRows.get(s.key)?.summary;
    return { ...base_, inFile, kind, headline: kind === "add" ? "adds" : kind === "keep" ? "same as now" : "replaces", detail: kind === "keep" ? undefined : detail };
  });
}
