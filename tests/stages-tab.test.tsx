import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import StagesTab from "@/components/admin/StagesTab";
import { DEFAULT_STAGES } from "@/lib/stages";

vi.mock("@/lib/firebase/client", () => ({
  auth: { currentUser: { getIdToken: async () => "tok" } },
}));

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("confirm", vi.fn(() => true));
  fetchMock.mockImplementation(async (_url: string, init?: RequestInit) => {
    if (init?.method === "POST") {
      const body = JSON.parse(String(init.body));
      return { ok: true, json: async () => ({ ok: true, content: { stages: body.content.stages } }) };
    }
    return { ok: true, json: async () => ({ ok: true, content: { stages: DEFAULT_STAGES } }) };
  });
});

describe("StagesTab", () => {
  it("loads and lists the current stages in order", async () => {
    render(<StagesTab />);
    await waitFor(() => expect(screen.getByLabelText("Stage 1 name")).toHaveValue("Wishlist"));
    const inputs = screen.getAllByRole("textbox").map((i) => (i as HTMLInputElement).value);
    expect(inputs).toEqual(DEFAULT_STAGES.map((s) => s.label));
  });

  it("adds, renames, reorders and removes stages, then saves only `stages`", async () => {
    const user = userEvent.setup();
    render(<StagesTab />);
    await waitFor(() => expect(screen.getByLabelText("Stage 1 name")).toHaveValue("Wishlist"));

    await user.click(screen.getByRole("button", { name: /add stage/i }));
    const last = screen.getByLabelText("Stage 10 name");
    expect(last).toHaveValue("New stage");
    await user.clear(last);
    await user.type(last, "Second round");

    // move the new stage up one
    const moveUps = screen.getAllByRole("button", { name: "Move up" });
    await user.click(moveUps[moveUps.length - 1]);
    expect(screen.getByLabelText("Stage 9 name")).toHaveValue("Second round");
    expect(screen.getByLabelText("Stage 10 name")).toHaveValue("❌ Rejected");

    // remove Outreach (row 2)
    await user.click(screen.getAllByRole("button", { name: "Remove stage" })[1]);
    expect(screen.getByLabelText("Stage 2 name")).toHaveValue("Information interview");

    await user.click(screen.getByRole("button", { name: /save stages/i }));
    await waitFor(() => expect(screen.getByText(/saved/i)).toBeInTheDocument());

    const post = fetchMock.mock.calls.find(([, init]) => (init as RequestInit)?.method === "POST")!;
    const body = JSON.parse(String((post[1] as RequestInit).body));
    expect(Object.keys(body.content)).toEqual(["stages"]);
    const labels = body.content.stages.map((s: { label: string }) => s.label);
    expect(labels).toEqual([
      "Wishlist", "Information interview", "Application", "Job interview", "Offer",
      "Negotiation", "✅ Accepted", "Second round", "❌ Rejected",
    ]);
    // existing ids are preserved; the new one is a slug of its initial label
    expect(body.content.stages.map((s: { id: string }) => s.id)).toContain("new_stage");
    expect(body.content.stages.map((s: { id: string }) => s.id)).toContain("accepted");
  });

  it("refuses to save a stage with a blank name", async () => {
    const user = userEvent.setup();
    render(<StagesTab />);
    await waitFor(() => expect(screen.getByLabelText("Stage 1 name")).toHaveValue("Wishlist"));
    await user.clear(screen.getByLabelText("Stage 1 name"));
    await user.click(screen.getByRole("button", { name: /save stages/i }));
    expect(await screen.findByText(/every stage needs a name/i)).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([, init]) => (init as RequestInit)?.method === "POST")).toBe(false);
  });

  it("cannot remove the last remaining stage", async () => {
    fetchMock.mockImplementation(async () => ({
      ok: true, json: async () => ({ ok: true, content: { stages: [{ id: "only", label: "Only", color: "grey" }] } }),
    }));
    render(<StagesTab />);
    await waitFor(() => expect(screen.getByLabelText("Stage 1 name")).toHaveValue("Only"));
    expect(screen.getByRole("button", { name: "Remove stage" })).toBeDisabled();
  });
});
