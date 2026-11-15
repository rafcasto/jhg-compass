import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Circle } from "lucide-react";
import SectionsPage from "@/components/profile/SectionsPage";

vi.mock("next/link", () => ({ default: ({ href, children, onClick }: { href: string; children: React.ReactNode; onClick?: () => void }) => <a href={href} onClick={onClick}>{children}</a> }));
vi.mock("@/components/shell/PageHeader", () => ({ default: ({ title }: { title: string }) => <h1>{title}</h1> }));

// The empty-row link and the flash (docs/UX_COACH_AGENTIC.md §6): an empty section offers the coach as one
// tertiary link under its ask; a filled one does not; a write lights the rows it names.

const items = [
  { key: "contact", label: "Contact details", title: "Contact details", ask: "How to reach you.", href: "/jobhacking/narrative?section=contact", icon: Circle },
  { key: "headline", label: "Headline", title: "Headline", ask: "Ten seconds.", href: "/jobhacking/narrative?section=headline", icon: Circle },
] as const;
type K = (typeof items)[number]["key"];

const mount = (active: K, rows: { key: K; state: "done" | "partial" | "empty"; summary: string }[], extra: Partial<Parameters<typeof SectionsPage<K>>[0]> = {}) => {
  const onClick = vi.fn();
  render(<SectionsPage<K> id="t" backHref="/jobhacking/narrative" eyebrow="JobHacking" title="Narrative" intro="" items={items} rows={rows} active={active} panel={(k) => <div>panel {k}</div>} coachLink={{ label: "Fill this in with your coach", onClick }} {...extra} />);
  return onClick;
};

describe("the empty section's coach link", () => {
  it("shows under the ask of an empty section and opens the coach on that section", async () => {
    const onClick = mount("headline", [{ key: "contact", state: "done", summary: "x" }, { key: "headline", state: "empty", summary: "Not set" }]);
    const link = screen.getByRole("button", { name: "Fill this in with your coach ›" });
    await userEvent.setup().click(link);
    expect(onClick).toHaveBeenCalledWith("headline");
  });

  it("is not there on a section that has something", () => {
    mount("contact", [{ key: "contact", state: "done", summary: "x" }, { key: "headline", state: "empty", summary: "Not set" }]);
    expect(screen.queryByRole("button", { name: /with your coach/ })).toBeNull();
  });

  it("is not there without a coach", () => {
    render(<SectionsPage<K> id="t" backHref="/" eyebrow="JobHacking" title="Narrative" intro="" items={items} rows={[{ key: "headline", state: "empty", summary: "Not set" }]} active="headline" panel={() => null} />);
    expect(screen.queryByRole("button", { name: /with your coach/ })).toBeNull();
  });

  it("lights the rows a write names and the open card", () => {
    mount("headline", [{ key: "headline", state: "partial", summary: "x" }], { flash: { keys: ["headline"], key: 7 } });
    expect(screen.getByText("panel headline").parentElement?.parentElement).toHaveClass("jh-flash");
    const rail = screen.getAllByRole("link", { name: /Headline/ });
    expect(rail.some((a) => a.className.includes("jh-flash") || a.parentElement?.className.includes("jh-flash"))).toBe(true);
    expect(screen.getAllByRole("link", { name: /Contact details/ }).every((a) => !a.className.includes("jh-flash") && !a.parentElement?.className.includes("jh-flash"))).toBe(true);
  });
});
