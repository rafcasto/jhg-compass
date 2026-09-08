import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ProgressCms from "@/components/admin/cms/ProgressCms";
import { DEFAULT_CONTENT } from "@/lib/content";
import { DEFAULT_STAGES } from "@/lib/stages";

vi.mock("@/lib/firebase/client", () => ({
  auth: { currentUser: { getIdToken: async () => "tok" } },
}));

const fetchMock = vi.fn();
const posts = () => fetchMock.mock.calls.filter(([, init]) => (init as RequestInit)?.method === "POST");

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("confirm", vi.fn(() => true));
  fetchMock.mockImplementation(async (_url: string, init?: RequestInit) => {
    if (init?.method === "POST") {
      const body = JSON.parse(String(init.body));
      return { ok: true, json: async () => ({ ok: true, content: { ...DEFAULT_CONTENT, ...body.content, text: { ...DEFAULT_CONTENT.text, ...body.content.text } }, meta: { updatedAt: 1_760_000_000_000, updatedBy: "admin@jobhackers.global" } }) };
    }
    return { ok: true, json: async () => ({ ok: true, content: DEFAULT_CONTENT, meta: { updatedAt: null, updatedBy: null } }) };
  });
});

const loaded = () => waitFor(() => expect(screen.getByLabelText("Stage 1 name")).toHaveValue("Wishlist"));

describe("CMS → Progress", () => {
  it("lists the stages in order beside the Progress copy, with a board preview", async () => {
    render(<ProgressCms />);
    await loaded();
    const names = DEFAULT_STAGES.map((_, i) => (screen.getByLabelText(`Stage ${i + 1} name`) as HTMLInputElement).value);
    expect(names).toEqual(DEFAULT_STAGES.map((s) => s.label));
    expect(screen.getByLabelText("Eyebrow")).toHaveValue(DEFAULT_CONTENT.text["tracker.eyebrow"]);
    // preview shows one column per stage
    const preview = screen.getByRole("img", { name: /live preview/i });
    for (const s of DEFAULT_STAGES) expect(preview).toHaveTextContent(s.label);
  });

  it("edits stages + copy and saves ONLY the Progress slice", async () => {
    const user = userEvent.setup();
    render(<ProgressCms />);
    await loaded();

    await user.click(screen.getByRole("button", { name: /add stage/i }));
    const last = screen.getByLabelText(`Stage ${DEFAULT_STAGES.length + 1} name`);
    await user.clear(last); await user.type(last, "Follow-up");
    await user.click(screen.getAllByRole("button", { name: "Move up" })[DEFAULT_STAGES.length]);
    await user.click(screen.getAllByRole("button", { name: "Remove stage" })[0]);

    const eyebrow = screen.getByLabelText("Eyebrow");
    await user.clear(eyebrow); await user.type(eyebrow, "Pipeline");

    await user.click(screen.getByRole("button", { name: "Save Progress tab" }));
    await waitFor(() => expect(posts()).toHaveLength(1));
    const body = JSON.parse(String((posts()[0][1] as RequestInit).body));

    expect(Object.keys(body.content).sort()).toEqual(["stages", "text"]);
    expect(body.content.stages.map((s: { label: string }) => s.label)).toEqual([
      ...DEFAULT_STAGES.slice(1, -1).map((s) => s.label), "Follow-up", DEFAULT_STAGES[DEFAULT_STAGES.length - 1].label,
    ]);
    expect(body.content.text["tracker.eyebrow"]).toBe("Pipeline");
    // nothing from other tabs leaks into this save
    expect(body.content.text["perf.title"]).toBeUndefined();
    expect(body.content.text["compass.title"]).toBeUndefined();
    expect(body.content.activities).toBeUndefined();
    await waitFor(() => expect(screen.getByText(/Last saved/)).toHaveTextContent("admin@jobhackers.global"));
  });

  it("refuses to save a blank stage name", async () => {
    const user = userEvent.setup();
    render(<ProgressCms />);
    await loaded();
    await user.clear(screen.getByLabelText("Stage 2 name"));
    await user.click(screen.getByRole("button", { name: "Save Progress tab" }));
    expect(screen.getByRole("status")).toHaveTextContent("Every stage needs a name.");
    expect(posts()).toHaveLength(0);
  });
});
