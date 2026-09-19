import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AccessRenewals from "@/components/admin/tofu/AccessRenewals";
import { DAY, type MemberAccessRow } from "@/lib/access";

vi.mock("@/lib/firebase/client", () => ({
  auth: { currentUser: { getIdToken: async () => "tok" } },
}));

const NOW = Date.now();
const row = (p: Partial<MemberAccessRow> & { uid: string; status: MemberAccessRow["status"] }): MemberAccessRow => ({
  email: `${p.uid}@x.io`, storedStatus: p.status, durationDays: 60, startsAt: NOW - 90 * DAY, expiresAt: NOW - 30 * DAY, redeemBy: null, careerOps: false, ...p,
});
let rows: MemberAccessRow[];

const fetchMock = vi.fn();
const posts = () => fetchMock.mock.calls.filter(([, init]) => (init as RequestInit)?.method === "POST");

beforeEach(() => {
  rows = [
    row({ uid: "ada", status: "expired", firstName: "Ada", lastName: "Lovelace" }),
    row({ uid: "bob", status: "active", firstName: "Bob", expiresAt: NOW + 10 * DAY }),
    row({ uid: "cy", status: "expired", email: "cy@acme.com" }),
  ];
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("confirm", vi.fn(() => true));
  fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
    if (init?.method === "POST" && String(url).endsWith("/features")) {
      const body = JSON.parse(String(init.body));
      rows = rows.map((r) => body.uids.includes(r.uid) ? { ...r, careerOps: body.careerOps } : r);
      return { ok: true, json: async () => ({ ok: true, updated: body.uids.map((uid: string) => ({ uid, email: `${uid}@x.io` })), missing: [], rows }) };
    }
    if (init?.method === "POST") {
      const body = JSON.parse(String(init.body));
      const renewed = body.uids.map((uid: string) => ({ uid, email: `${uid}@x.io`, expiresAt: NOW + body.durationDays * DAY }));
      rows = rows.map((r) => body.uids.includes(r.uid) ? { ...r, status: "active", expiresAt: NOW + body.durationDays * DAY, renewedAt: NOW, renewedBy: "admin@jobhackers.global" } : r);
      return { ok: true, json: async () => ({ ok: true, renewed, missing: [], rows }) };
    }
    return { ok: true, json: async () => ({ ok: true, rows }) };
  });
});

const loaded = () => waitFor(() => expect(screen.getByText("Ada Lovelace")).toBeInTheDocument());

describe("TOFU → Access renewals", () => {
  it("lists expired members by default with counts on the filter chips", async () => {
    render(<AccessRenewals />);
    await loaded();
    expect(screen.getByText("cy@acme.com")).toBeInTheDocument();
    expect(screen.queryByText("Bob")).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Expired 2/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: /Active 1/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Select members below" })).toBeDisabled();
  });

  it("grants access to one member and shows the new end date", async () => {
    const user = userEvent.setup();
    render(<AccessRenewals />);
    await loaded();
    await user.click(screen.getByRole("checkbox", { name: "Select Ada Lovelace" }));
    // NumberField clamps to min on every keystroke, so set the value in one change
    fireEvent.change(screen.getByLabelText("Access (days)"), { target: { value: "30" } });
    await user.click(screen.getByRole("button", { name: "Grant 30 days to 1 member" }));

    await waitFor(() => expect(posts()).toHaveLength(1));
    const [url, init] = posts()[0];
    expect(url).toBe("/api/admin/access");
    expect(JSON.parse(String((init as RequestInit).body))).toEqual({ uids: ["ada"], durationDays: 30 });
    expect(await screen.findByRole("status")).toHaveTextContent(/Access granted to 1 member — access until/);
    // list refreshed from the response: Ada is now active, so she leaves the Expired view
    await waitFor(() => expect(screen.queryByText("Ada Lovelace")).not.toBeInTheDocument());
    expect(screen.getByRole("tab", { name: /Expired 1/ })).toBeInTheDocument();
  });

  it("select-all grants to every member shown, and the search narrows what's shown", async () => {
    const user = userEvent.setup();
    render(<AccessRenewals />);
    await loaded();
    await user.type(screen.getByLabelText("Search members"), "acme");
    expect(screen.queryByText("Ada Lovelace")).not.toBeInTheDocument();
    await user.clear(screen.getByLabelText("Search members"));
    await user.click(screen.getByRole("checkbox", { name: "Select all shown" }));
    await user.click(screen.getByRole("button", { name: "Grant 60 days to 2 members" }));
    await waitFor(() => expect(posts()).toHaveLength(1));
    expect(JSON.parse(String((posts()[0][1] as RequestInit).body)).uids.sort()).toEqual(["ada", "cy"]);
    expect(await screen.findByRole("status")).toHaveTextContent("Access granted to 2 members.");
  });

  it("does nothing when the admin cancels the confirmation", async () => {
    vi.stubGlobal("confirm", vi.fn(() => false));
    const user = userEvent.setup();
    render(<AccessRenewals />);
    await loaded();
    await user.click(screen.getByRole("checkbox", { name: "Select Ada Lovelace" }));
    await user.click(screen.getByRole("button", { name: /Grant 60 days to 1 member/ }));
    expect(posts()).toHaveLength(0);
  });

  it("shows active members with their renewal audit under the Active chip", async () => {
    const user = userEvent.setup();
    rows[1] = { ...rows[1], renewedAt: NOW - DAY, renewedBy: "admin@jobhackers.global" };
    render(<AccessRenewals />);
    await loaded();
    await user.click(screen.getByRole("tab", { name: /Active/ }));
    const bob = screen.getByText("Bob").closest("tr")!;
    expect(within(bob).getByText("active")).toBeInTheDocument();
    expect(within(bob).getByText(/by admin@jobhackers.global/)).toBeInTheDocument();
  });

  it("switches the Agents tab on for the selected members from the same screen", async () => {
    const user = userEvent.setup();
    render(<AccessRenewals />);
    await loaded();
    expect(screen.getByRole("columnheader", { name: "Agents" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Enable for selected" })).toBeDisabled();
    await user.click(screen.getByRole("checkbox", { name: "Select Ada Lovelace" }));
    await user.click(screen.getByRole("button", { name: "Enable for 1" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Agents enabled for 1 member"));
    const [url, init] = posts().find(([u]) => String(u).endsWith("/features"))!;
    expect(url).toBe("/api/admin/access/features");
    expect(JSON.parse(String((init as RequestInit).body))).toEqual({ uids: ["ada"], careerOps: true });
    const ada = screen.getByText("Ada Lovelace").closest("tr")!;
    expect(within(ada).getByText("on")).toBeInTheDocument();
  });
});
