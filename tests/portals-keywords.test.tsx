import { describe, it, expect, vi } from "vitest";
import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import Portals, { keywordList } from "@/components/agents/Portals";
import type { CareerOpsPortals } from "@/lib/careerops/types";

// Watchlist editor → title keywords. Defect (2026-11-05): a comma or a space
// could not be typed — the textarea re-rendered from the parsed list on every
// keystroke, which trimmed them away before they showed. The text the member
// types must stay as typed; only the list behind it is normalised.

function Harness({ onChange }: { onChange: (v: CareerOpsPortals) => void }) {
  const [v, setV] = useState<CareerOpsPortals>({ companies: [], positive: ["Product Owner"], negative: [] });
  return <Portals value={v} onChange={(n) => { setV(n); onChange(n); }} suggested={["Product Manager"]} />;
}

describe("Portals — title keywords", () => {
  it("keeps a trailing comma and space as typed, and parses the list behind it", () => {
    const seen = vi.fn();
    render(<Harness onChange={seen} />);
    const include = screen.getByLabelText("Include keywords") as HTMLTextAreaElement;
    expect(include.value).toBe("Product Owner");
    fireEvent.change(include, { target: { value: "Product Owner, " } });
    expect(include.value).toBe("Product Owner, ");
    expect(seen).toHaveBeenLastCalledWith(expect.objectContaining({ positive: ["Product Owner"] }));
    fireEvent.change(include, { target: { value: "Product Owner, Head of Prod" } });
    expect(include.value).toBe("Product Owner, Head of Prod");
    expect(seen).toHaveBeenLastCalledWith(expect.objectContaining({ positive: ["Product Owner", "Head of Prod"] }));
  });

  it("re-syncs the text only when the list changes from outside — a suggested chip", () => {
    render(<Harness onChange={() => {}} />);
    const include = screen.getByLabelText("Include keywords") as HTMLTextAreaElement;
    fireEvent.change(include, { target: { value: "Product Owner, " } });
    fireEvent.click(screen.getByRole("button", { name: "+ Product Manager" }));
    expect(include.value).toBe("Product Owner, Product Manager");
  });

  it("parses commas and newlines, trims, and drops blanks", () => {
    expect(keywordList("Product Owner, Product Manager")).toEqual(["Product Owner", "Product Manager"]);
    expect(keywordList(" a ,, b \n c ,")).toEqual(["a", "b", "c"]);
    expect(keywordList("")).toEqual([]);
  });
});
