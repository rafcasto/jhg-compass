import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

// The owner's Share control — docs/UX_SHARE.md: one secondary button in the
// page header; a sheet that turns the link on, or copies / stops it; a status
// line under the header while the link is on. The token is minted by the
// server (POST /api/share), never here.

const getIdToken = vi.fn(async () => "id-token");
vi.mock("@/components/AuthProvider", () => ({ useAuth: () => ({ user: { uid: "u1", getIdToken } }) }));
vi.mock("@/lib/firestore/db", () => ({ paths: { share: (uid: string, page: string) => `users/${uid}/shares/${page}` }, useLiveDoc: () => ({ data: null, loading: false }) }));
vi.mock("@/lib/firestore/content", () => ({ useContent: () => ({ t: (k: string) => k }) }));

import { ShareButton, ShareStatus } from "@/components/jobhacking/SharePage";

const record = { token: "4f1c9a2e4f1c9a2e4f1c9a2e4f1c9a2e", createdAt: Date.UTC(2026, 10, 7, 12) };

beforeEach(() => {
  vi.restoreAllMocks();
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ ok: true }) })));
  Object.assign(navigator, { clipboard: { writeText: vi.fn(async () => undefined) } });
});

describe("ShareButton", () => {
  it("is hidden while the page has nothing to share and no link is on", () => {
    const { container } = render(<ShareButton page="narrative" record={null} empty />);
    expect(container).toBeEmptyDOMElement();
  });

  it("opens a sheet whose one action turns the link on through the server", async () => {
    render(<ShareButton page="true-north" record={null} />);
    fireEvent.click(screen.getByRole("button", { name: /Share/ }));
    const dialog = screen.getByRole("dialog", { name: "Share True North" });
    expect(dialog).toHaveTextContent("Anyone with the link can read this page");
    fireEvent.click(screen.getByRole("button", { name: "Turn on link" }));
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    const [url, init] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/share");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({ authorization: "Bearer id-token" });
    expect(JSON.parse(String(init.body))).toEqual({ page: "true-north" });
  });

  it("shows the link to copy and a Stop sharing action once the link is on", async () => {
    render(<ShareButton page="true-north" record={record} empty />);
    fireEvent.click(screen.getByRole("button", { name: /Share/ }));
    const input = screen.getByLabelText("Link") as HTMLInputElement;
    expect(input.value).toMatch(new RegExp(`/share/${record.token}$`));
    expect(input).toHaveAttribute("readonly");
    expect(screen.getByText(/Shared 7 Nov 2026/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Copy link" }));
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expect.stringMatching(new RegExp(`/share/${record.token}$`))));
    expect(await screen.findByRole("button", { name: "Copied" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Stop sharing" }));
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    expect(((fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1] as RequestInit).method).toBe("DELETE");
  });
});

describe("ShareStatus", () => {
  it("renders nothing while the link is off", () => {
    const { container } = render(<ShareStatus page="narrative" record={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("is one status line with Copy link and Stop sharing as text, no URL on screen", async () => {
    render(<ShareStatus page="narrative" record={record} />);
    const line = screen.getByRole("status");
    expect(line).toHaveTextContent("Shared — anyone with the link can read this page.");
    expect(line).not.toHaveTextContent(record.token);
    fireEvent.click(screen.getByRole("button", { name: /Copy link/ }));
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: "Stop sharing" }));
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    expect(((fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1] as RequestInit).method).toBe("DELETE");
  });
});
