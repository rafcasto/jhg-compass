import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { BookOpen, FileText } from "lucide-react";

// A sectioned page whose sections are rows of the shell's menu passes
// rail={false} (JobHacking → Artefacts, decision 2026-11-08): the desktop rail
// is gone — the sidebar is the rail — while the mobile overview rows and the
// section itself render as on every page.

import SectionsPage from "@/components/profile/SectionsPage";

const items = [
  { key: "story-bank", label: "Story Bank", title: "Story Bank", ask: "Your proof points.", href: "/jobhacking/artefacts?section=story-bank", icon: BookOpen },
  { key: "master-cv", label: "Master CV", title: "Master CV", ask: "The one CV.", href: "/jobhacking/artefacts?section=master-cv", icon: FileText },
] as const;
const rows = [{ key: "story-bank", state: "done", summary: "3 stories" }, { key: "master-cv", state: "empty", summary: "Not set" }] as const;
const page = (rail?: boolean) => (
  <SectionsPage id="t" backHref="/jobhacking/artefacts" eyebrow="JobHacking" title="Artefacts" intro="What you bring." items={items} rows={rows} active="master-cv" rail={rail} panel={(k) => <p>panel {k}</p>} />
);

describe("SectionsPage without its rail", () => {
  it("by default both the rail and the mobile rows list the sections", () => {
    render(page());
    expect(screen.getAllByRole("navigation", { name: "Artefacts sections" })).toHaveLength(2);
  });
  it("rail={false}: only the mobile rows remain; the section, its heading and the back row are untouched", () => {
    render(page(false));
    const lists = screen.getAllByRole("navigation", { name: "Artefacts sections" });
    expect(lists).toHaveLength(1);
    expect(lists[0].tagName).toBe("DIV"); // the rows variant, not the rail's <nav>
    expect(screen.getByRole("heading", { level: 2, name: /Master CV/ })).toBeInTheDocument();
    expect(screen.getByText("panel master-cv")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Artefacts/ })).toHaveAttribute("href", "/jobhacking/artefacts");
    expect(screen.queryByRole("progressbar")).toBeInTheDocument(); // the mobile overview still carries it
  });
});
