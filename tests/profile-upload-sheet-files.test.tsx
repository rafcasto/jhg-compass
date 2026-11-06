import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import path from "node:path";
import { DEFAULT_TEXT } from "@/lib/content";

// The upload sheet with one of the four Packer files, end to end: drop →
// review lists the page's sections, nothing more → Unpack writes the page's
// fields (docs/UX_JOBHACKING.md §4, decision 2026-11-07).

const setDoc = vi.fn<(ref: unknown, data: Record<string, unknown>, opts?: unknown) => Promise<void>>(async () => {});
vi.mock("firebase/firestore", () => ({ setDoc: (ref: unknown, data: Record<string, unknown>, opts?: unknown) => setDoc(ref, data, opts) }));
vi.mock("@/lib/firestore/db", () => ({ paths: { careerOpsSetup: (uid: string) => `users/${uid}/careerOps/setup` } }));
vi.mock("@/lib/firestore/content", () => ({ useContent: () => ({ t: (k: string) => DEFAULT_TEXT[k] ?? k, stages: [] }) }));

import ProfileUploadSheet from "@/components/profile/ProfileUploadSheet";
import { profileFromSetup } from "@/lib/careerops/profile-file";
import type { CareerOpsSetupV2 } from "@/lib/careerops/types";

const read = (name: string) => readFileSync(path.resolve(__dirname, `../public/${name}.example.yml`), "utf8");

function mount(setup: CareerOpsSetupV2 | null, files: File[], expect?: "narrative" | "trueNorth" | "targetCompanies" | "artefacts") {
  const onDone = vi.fn();
  render(
    <ProfileUploadSheet
      uid="u1" setup={setup} profile={{ email: "rafael@mailinator.com", firstName: "Rafael", lastName: "M" } as never}
      current={profileFromSetup({ profile: null, setup })} initialFiles={files} expect={expect ?? null}
      fileSectionHref={() => null} onClose={() => {}} onDone={onDone} onDownloadCurrent={() => {}}
    />,
  );
  return onDone;
}

const rowsOf = async () => {
  const list = await screen.findByRole("list");
  return within(list).getAllByRole("listitem").map((li) => li.textContent ?? "");
};

beforeEach(() => setDoc.mockClear());

describe("ProfileUploadSheet — the four files", () => {
  it("narrative.yml reviews as Contact details · Headline · Bridge story · Core competencies, and unpacks into those fields", async () => {
    const onDone = mount(null, [new File([read("narrative")], "narrative.yml", { type: "application/yaml" })], "narrative");
    const rows = await rowsOf();
    expect(rows).toHaveLength(4);
    expect(rows[0]).toMatch(/^Contact detailsadds/);
    expect(rows[1]).toMatch(/^Headlineadds.*I help SaaS scale-ups ship predictably/);
    expect(rows[2]).toMatch(/^Bridge storyadds.*I was the operations analyst/);
    expect(rows[3]).toMatch(/^Core competenciesadds.*Release management; Incident management; Programme delivery/);
    expect(screen.queryByText(/Contact & logistics|Targeting|Workbook/)).not.toBeInTheDocument();
    expect(setDoc).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: /Unpack it/ }));
    await waitFor(() => expect(setDoc).toHaveBeenCalledTimes(1));
    const [, data, opts] = setDoc.mock.calls[0];
    expect(opts).toEqual({ merge: true });
    const d = data as CareerOpsSetupV2;
    expect(d.contact).toEqual({ phone: "+64 21 555 0199", linkedin: "https://www.linkedin.com/in/example-ana-ferreira", portfolio: "https://ana-ferreira.example/release-cadence-playbook", title: "I help SaaS scale-ups ship predictably while headcount doubles through release management, incident management, and programme delivery", location: "Wellington, New Zealand" });
    expect(d.personalization?.exitNarrative).toMatch(/^I was the operations analyst/);
    expect(d.personalization?.crossCuttingAdvantage).toBe("Release management; Incident management; Programme delivery");
    expect(d.narrative?.superpowers).toHaveLength(3);
    expect(d.jhg?.narrative?.leadSkills).toHaveLength(3);
    expect(d.profileFiles?.narrative?.filename).toBe("narrative.yml");
    expect(onDone).toHaveBeenCalledWith(
      [{ label: "Contact details", href: "/jobhacking/narrative?section=contact" }, { label: "Headline", href: "/jobhacking/narrative?section=headline" }, { label: "Bridge story", href: "/jobhacking/narrative?section=story" }, { label: "Core competencies", href: "/jobhacking/narrative?section=competencies" }],
      ["narrative"],
    );
  });

  it("true-north.yml reviews as the seven True North sections; dropping all four at once lists each page", async () => {
    mount(null, [
      new File([read("true-north")], "true-north.yml"),
      new File([read("target-companies")], "target-companies.yml"),
      new File([read("artefacts")], "artefacts.yml"),
    ]);
    // The review's section lists are the `.card` ones; a file's warnings render as a list too.
    const lists = (await screen.findAllByRole("list")).filter((l) => l.classList.contains("card"));
    const labels = lists.map((l) => within(l).getAllByRole("listitem").map((li) => (li.textContent ?? "").replace(/(adds|replaces|same as now|not in the file).*$/, "")));
    expect(labels).toEqual([
      ["Target industry", "Target roles", "Seniority", "Salary range", "Location", "Company type", "Boundaries"],
      ["Top 3", "Top 10", "Top 40", "Watchlist"],
      ["Story Bank", "Master CV", "LinkedIn profile"],
    ]);
    expect(screen.getByRole("button", { name: /Unpack 3 files/ })).toBeInTheDocument();
  });
});
