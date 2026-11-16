import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Composer from "@/components/coach/Composer";
import CvStart from "@/components/coach/CvStart";

// The CV-first surfaces (docs/UX_COACH_AGENTIC.md §3): the empty state with one primary action and a link,
// and the composer's Paperclip — a file arrives as a pill and goes with the next turn.

const md = (name: string, text = "# CV -- Ana\n\n## Work Experience\n### Acme") => new File([text], name, { type: "text/markdown" });

describe("Start from your CV", () => {
  it("offers one primary action and a tertiary link, and starts with the file read in the browser", async () => {
    const onStart = vi.fn();
    render(<CvStart coachLabel="Narrative" onStart={onStart} />);
    expect(screen.getByRole("heading", { name: "Start from your CV" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add your CV" })).toHaveClass("btn-primary");
    expect(screen.getByRole("button", { name: "Start without one" })).toHaveClass("link");
    const user = userEvent.setup();
    await user.upload(document.querySelector('input[type="file"]') as HTMLInputElement, md("ana-cv.md"));
    await waitFor(() => expect(onStart).toHaveBeenCalledWith({ name: "ana-cv.md", text: "# CV -- Ana\n\n## Work Experience\n### Acme" }));
    await user.click(screen.getByRole("button", { name: "Start without one" }));
    expect(onStart).toHaveBeenLastCalledWith(null);
  });

  it("refuses a file that is not Markdown or text, in one red line", async () => {
    const onStart = vi.fn();
    render(<CvStart coachLabel="Narrative" onStart={onStart} />);
    await userEvent.setup({ applyAccept: false }).upload(document.querySelector('input[type="file"]') as HTMLInputElement, new File(["%PDF"], "cv.pdf", { type: "application/pdf" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Markdown or plain text"));
    expect(onStart).not.toHaveBeenCalled();
  });
});

describe("the composer's Paperclip", () => {
  it("attaches a file as a pill, sends it with the next turn, and lets the member remove it", async () => {
    const onSend = vi.fn();
    render(<Composer onSend={onSend} />);
    const user = userEvent.setup();
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
    await user.upload(document.querySelector('input[type="file"]') as HTMLInputElement, md("cv.txt", "plain cv"));
    await waitFor(() => expect(screen.getByText("cv.txt")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Send" })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "Remove cv.txt" }));
    expect(screen.queryByText("cv.txt")).toBeNull();
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
    await user.upload(document.querySelector('input[type="file"]') as HTMLInputElement, md("cv.txt", "plain cv"));
    await waitFor(() => expect(screen.getByText("cv.txt")).toBeInTheDocument());
    await user.type(screen.getByRole("textbox", { name: "Your answer" }), "my latest");
    await user.click(screen.getByRole("button", { name: "Send" }));
    expect(onSend).toHaveBeenCalledWith("my latest", { name: "cv.txt", text: "plain cv" });
    expect(screen.queryByText("cv.txt")).toBeNull();
  });

  it("sends words alone with no document", async () => {
    const onSend = vi.fn();
    render(<Composer onSend={onSend} />);
    const user = userEvent.setup();
    await user.type(screen.getByRole("textbox", { name: "Your answer" }), "hello{Enter}");
    expect(onSend).toHaveBeenCalledWith("hello", null);
    expect(screen.getByRole("button", { name: "Add a document" })).toHaveClass("icon-btn");
  });
});
