import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DEFAULT_TEXT, mergeContent, hiddenActivities, visibleActivities, weeklyTargetsFrom } from "@/lib/content";
import type { Contact, Opportunity } from "@/lib/types";

// ---- mocks -------------------------------------------------------------------
const importRecords = vi.fn(async (_uid: string, sub: string, docs: unknown[]) => docs.map((_, i) => `${sub}-${i + 1}`));
const attach = vi.fn(async () => {});
vi.mock("@/lib/firestore/db", () => ({
  importRecords: (...a: any[]) => (importRecords as any)(...a),
  attachContactsToOpportunities: (...a: any[]) => (attach as any)(...a),
}));
const track = vi.fn();
vi.mock("@/lib/track-client", () => ({ track: (...a: any[]) => track(...a) }));
vi.mock("@/lib/firestore/content", () => ({
  useContent: () => {
    const config = mergeContent(null);
    return {
      loading: false, config,
      hidden: hiddenActivities(config), visible: visibleActivities(config),
      weeklyTargets: weeklyTargetsFrom(config), effortSplit: config.effortSplit, stages: config.stages,
      t: (k: string) => config.text[k] ?? DEFAULT_TEXT[k] ?? "",
    };
  },
}));

import ImportSheet from "@/components/tracker/ImportSheet";

const t = (k: string) => DEFAULT_TEXT[k];
const jane: Contact = { id: "c1", fullName: "Jane Doe", company: "Acme", email: "jane@acme.com", type: "peer" };
const noOpps: Opportunity[] = [];
const acmePm: Opportunity = { id: "o1", company: "Acme", role: "PM", market: "hidden", stage: "outreach", contactIds: [] };
const globex: Opportunity = { id: "o2", company: "Globex", role: "CTO", market: "hidden", stage: "wishlist", contactIds: [] };

beforeEach(() => { importRecords.mockClear(); attach.mockClear(); track.mockClear(); });

async function pasteAndPreview(user: ReturnType<typeof userEvent.setup>, csv: string) {
  await user.click(screen.getByRole("button", { name: t("import.pasteToggle") }));
  await user.click(screen.getByLabelText(t("import.pasteToggle")));
  await user.paste(csv);
  await user.click(screen.getByRole("button", { name: t("import.preview") }));
}

describe("ImportSheet", () => {
  it("contacts: shows the column guide, previews counts, skips duplicates by default and imports the rest", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<ImportSheet kind="contacts" uid="u1" contacts={[jane]} opps={noOpps} onClose={onClose} />);

    expect(screen.getByRole("dialog", { name: t("import.contacts.title") })).toBeInTheDocument();
    expect(screen.getByText("Full name")).toBeInTheDocument();
    expect(screen.getByText(t("import.required"))).toBeInTheDocument();
    expect(screen.getByRole("button", { name: t("import.template") })).toBeInTheDocument();

    await pasteAndPreview(user, "Full name,Email\nJane Doe,jane@acme.com\n,x@y.z\nBob Builder,bob@b.c\n");

    expect(screen.getByText("1 ready to import")).toBeInTheDocument();
    expect(screen.getAllByText("1 skipped").length).toBeGreaterThan(0);
    expect(screen.getByText("Missing full name").textContent).toBe("Line 3 · Missing full name");
    const skip = screen.getByRole("checkbox", { name: "Skip 1 already on your list" });
    expect(skip).toBeChecked();
    await user.click(skip);
    expect(screen.getByText("2 ready to import")).toBeInTheDocument();
    await user.click(skip);

    await user.click(screen.getByRole("button", { name: "Import 1" }));
    expect(await screen.findByText("1 contacts added to your network.")).toBeInTheDocument();
    expect(importRecords).toHaveBeenCalledTimes(1);
    const [uid, sub, docs] = importRecords.mock.calls[0];
    expect(uid).toBe("u1");
    expect(sub).toBe("contacts");
    expect(docs).toEqual([{ fullName: "Bob Builder", company: "", role: "", type: "hiring_manager", email: "bob@b.c", phone: "", linkedinUrl: "", log: [] }]);
    expect(attach).not.toHaveBeenCalled();
    expect(track).toHaveBeenCalledWith("IMPORT_CONTACTS", { props: { count: 1, linked: 0, skippedErrors: 1, skippedDuplicates: 1 } });

    await user.click(screen.getByRole("button", { name: t("import.close") }));
    expect(onClose).toHaveBeenCalled();
  });

  it("contacts: attaches new contacts to the jobs they name — or every job at their company — after creating them", async () => {
    const user = userEvent.setup();
    render(<ImportSheet kind="contacts" uid="u1" contacts={[]} opps={[acmePm, globex]} onClose={() => {}} />);
    await pasteAndPreview(user, "Full name,Company,Jobs\nAmy,Acme,\nBen,Globex,Acme / PM\nCal,Initech,\n");

    expect(screen.getByText("3 ready to import")).toBeInTheDocument();
    const auto = screen.getByRole("checkbox", { name: t("import.contacts.autoLink") });
    expect(auto).toBeChecked();
    // preview "Jobs" column: Amy → 1 (Acme), Ben → 1 (explicit), Cal → 0
    const cells = screen.getAllByRole("row").slice(1).map((r) => r.lastElementChild!.textContent);
    expect(cells).toEqual(["1", "1", "0"]);

    await user.click(screen.getByRole("button", { name: "Import 3" }));
    expect(await screen.findByText(/3 contacts added to your network\. 2 attached to jobs on your board\./)).toBeInTheDocument();
    expect(attach).toHaveBeenCalledTimes(1);
    expect(attach).toHaveBeenCalledWith("u1", [{ opportunityId: "o1", contactIds: ["contacts-1", "contacts-2"] }]);
    expect(track).toHaveBeenCalledWith("IMPORT_CONTACTS", expect.objectContaining({ props: expect.objectContaining({ count: 3, linked: 2 }) }));
  });

  it("contacts: turning auto-attach off keeps only the explicit Jobs references", async () => {
    const user = userEvent.setup();
    render(<ImportSheet kind="contacts" uid="u1" contacts={[]} opps={[acmePm, globex]} onClose={() => {}} />);
    await pasteAndPreview(user, "Full name,Company,Jobs\nAmy,Acme,\nBen,Globex,Acme / PM\n");
    await user.click(screen.getByRole("checkbox", { name: t("import.contacts.autoLink") }));
    const cells = screen.getAllByRole("row").slice(1).map((r) => r.lastElementChild!.textContent);
    expect(cells).toEqual(["0", "1"]);
    await user.click(screen.getByRole("button", { name: "Import 2" }));
    await screen.findByText(/2 contacts added/);
    expect(attach).toHaveBeenCalledWith("u1", [{ opportunityId: "o1", contactIds: ["contacts-2"] }]);
  });

  it("opportunities: reads an uploaded file, resolves stages and links contacts", async () => {
    const user = userEvent.setup();
    render(<ImportSheet kind="opportunities" uid="u1" contacts={[jane]} opps={noOpps} onClose={() => {}} />);

    const csv = "Company,Role,Stage,Contacts\nAcme,PM,Outreach,jane@acme.com\nGlobex,Designer,Nowhere,\n";
    const file = new File([csv], "jobs.csv", { type: "text/csv" });
    await user.upload(screen.getByLabelText(t("import.chooseFile")), file);

    expect(await screen.findByText("2 ready to import")).toBeInTheDocument();
    // preview table shows the resolved stage label and the linked-contact count
    expect(screen.getByText("Outreach")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /1 warnings/ })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Import 2" }));
    expect(await screen.findByText(/2 jobs added to your board\. 1 have contacts attached\./)).toBeInTheDocument();
    expect(attach).not.toHaveBeenCalled();
    const [, sub, docs] = importRecords.mock.calls[0];
    expect(sub).toBe("opportunities");
    expect(docs).toEqual([
      { company: "Acme", role: "PM", market: "hidden", stage: "outreach", source: "", url: "", notes: "", contactIds: ["c1"], log: [] },
      { company: "Globex", role: "Designer", market: "hidden", stage: "wishlist", source: "", url: "", notes: "", contactIds: [], log: [] },
    ]);
    expect(track).toHaveBeenCalledWith("IMPORT_OPPORTUNITIES", expect.anything());
  });

  it("blocks the import when a required column is missing, and lets you start over", async () => {
    const user = userEvent.setup();
    render(<ImportSheet kind="contacts" uid="u1" contacts={[]} opps={noOpps} onClose={() => {}} />);
    await pasteAndPreview(user, "Email\nx@y.z\n");
    expect(screen.getByText("Missing required column: Full name")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Import \d+$/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: t("import.back") }));
    expect(screen.getByRole("button", { name: t("import.pasteToggle") })).toBeInTheDocument();
    expect(importRecords).not.toHaveBeenCalled();
  });
});
