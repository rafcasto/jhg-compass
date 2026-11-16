import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import JobStatus, { splitCount } from "@/components/coach/JobStatus";

// The research status line (docs/UX_COACH_AGENTIC.md §2): a pulsing dot, the verb phrase, a mono count,
// a tertiary Stop; a bare ✓ line when it lands; one red line when it fails.

const live = { data: null as Record<string, unknown> | null };
vi.mock("@/lib/firestore/db", () => ({ paths: { engineJob: (uid: string, id: string) => `users/${uid}/engineJobs/${id}` }, useLiveDoc: () => ({ data: live.data, loading: false }) }));
vi.mock("@/lib/firebase/client", () => ({ auth: { currentUser: { getIdToken: async () => "tok" } } }));
vi.mock("next/link", () => ({ default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a> }));

const job = { id: "20261116T100000-0a1b2c3d", type: "postings", label: "Reading postings" };
const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ ok: true }) }));
beforeEach(() => { live.data = null; fetchMock.mockClear(); vi.stubGlobal("fetch", fetchMock); });

describe("JobStatus", () => {
  it("splits the count out of the progress line", () => {
    expect(splitCount("Opening links · 7 of 20")).toEqual({ phrase: "Opening links", count: "7 of 20" });
    expect(splitCount("Searching postings")).toEqual({ phrase: "Searching postings", count: null });
  });

  it("shows the running job as one line with a mono count and a Stop that cancels it", async () => {
    live.data = { status: "running", progress: "Opening links · 7 of 20" };
    render(<JobStatus uid="u1" job={job} href="/jobhacking/true-north" />);
    const line = screen.getByRole("status");
    expect(line).toHaveTextContent("Opening links");
    expect(line).toHaveTextContent("7 of 20");
    expect(line.querySelector(".animate-pulse")).not.toBeNull();
    await userEvent.setup().click(screen.getByRole("button", { name: "Stop" }));
    expect(fetchMock).toHaveBeenCalledWith(`/api/engine/jobs/${job.id}`, expect.objectContaining({ method: "DELETE" }));
  });

  it("says Starting while queued, lands as a check line with the count and a View link, fails in one red line", () => {
    const { rerender } = render(<JobStatus uid="u1" job={job} href="/jobhacking/true-north" />);
    expect(screen.getByRole("status")).toHaveTextContent("Starting");
    live.data = { status: "done", progress: "18 postings on your True North page", result: { count: 18 } };
    rerender(<JobStatus uid="u1" job={job} href="/jobhacking/true-north" />);
    expect(screen.getByRole("status")).toHaveTextContent("Reading postings · 18 found");
    expect(screen.getByRole("link", { name: "View ›" })).toHaveAttribute("href", "/jobhacking/true-north");
    expect(screen.queryByRole("button", { name: "Stop" })).toBeNull();
    live.data = { status: "failed", error: "No posting could be opened" };
    rerender(<JobStatus uid="u1" job={job} />);
    expect(screen.getByRole("status")).toHaveTextContent("Couldn't finish reading postings — No posting could be opened. Ask your coach to try again.");
    expect(screen.getByRole("status")).toHaveClass("text-jh-red");
  });
});
