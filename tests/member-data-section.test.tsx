import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MemberData from "@/components/admin/tofu/MemberData";
import type { MemberAccessRow } from "@/lib/access";

vi.mock("@/lib/firebase/client", () => ({ auth: { currentUser: { getIdToken: async () => "tok" } } }));

// Admin → Member data: counts first, then reset (confirm quotes the counts) and delete (email typed out).

const ada: MemberAccessRow = { uid: "ada123", email: "ada@x.io", firstName: "Ada", lastName: "Lovelace", status: "active", storedStatus: "active", durationDays: 60, startsAt: 0, expiresAt: 1, redeemBy: null, careerOps: false };
const fetchMock = vi.fn();
let counts: Record<string, number>;

beforeEach(() => {
  counts = { coachSessions: 2, opportunities: 5 };
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
    const summary = () => ({ uid: "ada123", email: "ada@x.io", counts, hasAccount: true, hasGrant: true, hasAuthUser: true });
    if (String(url).endsWith("/reset")) {
      const { scope } = JSON.parse(String(init?.body));
      const removed = Object.keys(counts).filter((k) => scope === "all" || k === "coachSessions");
      counts = Object.fromEntries(Object.entries(counts).filter(([k]) => !removed.includes(k)));
      return { ok: true, json: async () => ({ ok: true, result: { uid: "ada123", scope, removed, shareLinks: 0 }, summary: summary() }) };
    }
    if (init?.method === "DELETE") {
      const { email } = JSON.parse(String(init.body));
      return email === "ada@x.io" ? { ok: true, json: async () => ({ ok: true, result: {} }) } : { ok: false, json: async () => ({ ok: false, error: "the email typed does not match the member's" }) };
    }
    return { ok: true, json: async () => ({ ok: true, summary: summary() }) };
  });
});

describe("Member data", () => {
  it("counts what the member has, then resets the coach alone — the confirm quotes the counts", async () => {
    vi.stubGlobal("confirm", vi.fn(() => true));
    render(<MemberData member={ada} onDeleted={vi.fn()} />);
    await waitFor(() => expect(screen.getByText("Coach conversations")).toBeInTheDocument());
    expect(screen.getByText("Opportunities")).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "Reset coach" }));
    expect(String((confirm as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0])).toContain("Removes: 2 coach conversations.");
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Coach reset for Ada Lovelace — cleared 1 collection."));
    expect(screen.queryByText("Coach conversations")).toBeNull();
    expect(screen.getByText("Opportunities")).toBeInTheDocument();
  });

  it("does nothing when the admin cancels the confirm", async () => {
    vi.stubGlobal("confirm", vi.fn(() => false));
    render(<MemberData member={ada} onDeleted={vi.fn()} />);
    await waitFor(() => expect(screen.getByText("Coach conversations")).toBeInTheDocument());
    await userEvent.setup().click(screen.getByRole("button", { name: "Reset all data" }));
    expect(fetchMock.mock.calls.filter(([, i]) => (i as RequestInit)?.method === "POST")).toHaveLength(0);
  });

  it("deletes only when the member's email is typed, and tells the list", async () => {
    const onDeleted = vi.fn();
    vi.stubGlobal("prompt", vi.fn(() => "wrong@x.io"));
    render(<MemberData member={ada} onDeleted={onDeleted} />);
    await waitFor(() => expect(screen.getByText("Coach conversations")).toBeInTheDocument());
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Delete member" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Couldn't delete: the email typed does not match the member's"));
    expect(onDeleted).not.toHaveBeenCalled();
    vi.stubGlobal("prompt", vi.fn(() => "ada@x.io"));
    await user.click(screen.getByRole("button", { name: "Delete member" }));
    await waitFor(() => expect(onDeleted).toHaveBeenCalled());
  });
});
