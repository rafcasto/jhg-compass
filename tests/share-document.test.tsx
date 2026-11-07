import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import type { ShareDocument as Doc } from "@/lib/jobhacking/share";

vi.mock("react-markdown", () => ({ default: ({ children }: { children: string }) => <div data-testid="markdown">{children}</div> }));
vi.mock("remark-gfm", () => ({ default: () => undefined }));
vi.mock("next/image", () => ({ default: (p: Record<string, unknown>) => <img alt="" src={String(p.src)} /> }));

import SharedDocument, { NotShared } from "@/components/share/SharedDocument";

// /share/<token> — the page as a document (docs/UX_SHARE.md): title, author
// line, a heading per section, blocks under it. No buttons, no state glyphs.

const doc: Doc = {
  page: "true-north", title: "True North", author: "Ana Ferreira",
  lead: "In 60 days, I'm working as Senior Delivery Lead, in Freight dispatch software.",
  sections: [
    { key: "roles", title: "Target roles", blocks: [
      { kind: "text", text: "Senior Delivery Lead" },
      { kind: "entries", label: "Archetypes", entries: [{ title: "Delivery Lead", meta: "Axes: cadence", text: "They buy: predictability" }] },
      { kind: "list", label: "Target titles", items: ["Delivery Lead", "Delivery Manager"] },
    ] },
    { key: "salary", title: "Salary range", blocks: [{ kind: "facts", facts: [{ label: "Range", value: "NZD 150,000–175,000" }, { label: "Source", value: "Seek", url: "https://seek.example" }] }] },
    { key: "master-cv", title: "Master CV", blocks: [{ kind: "markdown", text: "# Ana\n\n- Led things" }] },
  ],
};

describe("SharedDocument", () => {
  it("renders the title, the author line, the lead and one heading per section", () => {
    render(<SharedDocument doc={doc} sharedAt={Date.UTC(2026, 10, 7, 12)} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("True North");
    expect(screen.getByText("Ana Ferreira · shared 7 Nov 2026")).toBeInTheDocument();
    expect(screen.getByText(/^In 60 days/)).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual(["Target roles", "Salary range", "Master CV"]);
  });

  it("draws every block kind, with labels that recede and links only where the data has a URL", () => {
    render(<SharedDocument doc={doc} sharedAt={Date.now()} />);
    const roles = screen.getByRole("region", { name: "Target roles" });
    expect(within(roles).getByText("Senior Delivery Lead")).toBeInTheDocument();
    expect(within(roles).getByText("Archetypes")).toHaveClass("label");
    expect(within(roles).getByText("Delivery Lead", { selector: "p" })).toBeInTheDocument();
    expect(within(roles).getByText("They buy: predictability")).toBeInTheDocument();
    expect(roles.querySelectorAll("ol > li")).toHaveLength(1);
    expect(Array.from(roles.querySelectorAll("ul > li")).map((li) => li.textContent)).toEqual(["Delivery Lead", "Delivery Manager"]);
    const salary = screen.getByRole("region", { name: "Salary range" });
    expect(within(salary).getByText("NZD 150,000–175,000")).toBeInTheDocument();
    expect(within(salary).getByRole("link", { name: "Seek" })).toHaveAttribute("href", "https://seek.example");
    expect(screen.getByTestId("markdown")).toHaveTextContent("Led things");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("says when there is nothing on the page, and has a quiet dead-link page", () => {
    const { unmount } = render(<SharedDocument doc={{ ...doc, lead: undefined, sections: [] }} sharedAt={Date.now()} />);
    expect(screen.getByText("Nothing on this page yet.")).toBeInTheDocument();
    unmount();
    render(<NotShared />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("This link is no longer shared");
  });
});
