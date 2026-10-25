import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DEFAULT_TEXT } from "@/lib/content";

vi.mock("@/lib/firestore/content", () => ({
  useContent: () => ({ t: (k: string) => DEFAULT_TEXT[k] ?? k, stages: [] }),
}));

import { Sheet, SheetFooter, useSheetSlot } from "@/components/tracker/Sheet";

describe("Sheet", () => {
  it("names the dialog by its title, closes on Esc and ×, and returns focus to the opener", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const { rerender } = render(<><button>opener</button><Sheet title="Add job" onClose={onClose}><input aria-label="Company" /></Sheet></>);
    expect(screen.getByRole("dialog", { name: "Add job" })).toBeInTheDocument();
    expect(screen.getByLabelText("Company")).toHaveFocus();

    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: DEFAULT_TEXT["tracker.close"] }));
    expect(onClose).toHaveBeenCalledTimes(2);

    screen.getByRole("button", { name: "opener" }).focus();
    rerender(<><button>opener</button><Sheet title="Add job" onClose={onClose}><input aria-label="Company" /></Sheet></>);
    rerender(<><button>opener</button></>);
    expect(screen.getByRole("button", { name: "opener" })).toHaveFocus();
  });

  it("only the top-most sheet handles Esc", async () => {
    const user = userEvent.setup();
    const outer = vi.fn(), inner = vi.fn();
    render(
      <Sheet title="Detail" onClose={outer}>
        <p>outer body</p>
        <Sheet title="Edit" onClose={inner}><input aria-label="Role" /></Sheet>
      </Sheet>,
    );
    await user.keyboard("{Escape}");
    expect(inner).toHaveBeenCalledTimes(1);
    expect(outer).not.toHaveBeenCalled();
  });

  it("ignores a backdrop click while dirty but still closes from × ", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const { container } = render(<Sheet title="Edit contact" onClose={onClose} dirty><input aria-label="Name" /></Sheet>);
    fireEvent.click(container.firstElementChild!); // the scrim
    expect(onClose).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: DEFAULT_TEXT["tracker.close"] }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes on a backdrop click when clean", () => {
    const onClose = vi.fn();
    const { container } = render(<Sheet title="Add" onClose={onClose}><input aria-label="Name" /></Sheet>);
    fireEvent.click(container.firstElementChild!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("lets a body view supply the footer and dirty flag through the slot", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onSave = vi.fn();
    function Body() {
      useSheetSlot(<SheetFooter primary={{ label: "Save", onClick: onSave }} secondary={{ label: "Cancel", onClick: onClose }} />, true);
      return <input aria-label="Name" />;
    }
    const { container } = render(<Sheet title="Edit" onClose={onClose}><Body /></Sheet>);
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(onSave).toHaveBeenCalled();
    fireEvent.click(container.firstElementChild!);
    expect(onClose).not.toHaveBeenCalled(); // slot dirty guards the backdrop
  });

  it("locks page scroll while open and releases it when the last sheet closes", () => {
    const { unmount } = render(<Sheet title="A" onClose={() => {}}><p>a</p></Sheet>);
    expect(document.body.style.overflow).toBe("hidden");
    unmount();
    expect(document.body.style.overflow).toBe("");
  });
});
